// @title Swarm Graph API
// @version 0.0.0
// @description API for rendering swarm graphs and inspecting docker resources.
// @contact.name Catalyst Dev
// @contact.email dev@example.com
// @host localhost:8080
// @BasePath /
package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"swarm-graph/internal/store"
	"swarm-graph/internal/utils"
	"text/template"
	"time"

	httpSwagger "github.com/swaggo/http-swagger"

	// Import docs package to ensure swagger info is initialized
	_ "swarm-graph/internal/httpapi/docs"

	// embed swagger.json so we can serve /swagger/doc.json even if the swag
	// generated docs.go (docs.ReadDoc) is not present. This keeps the dev
	// experience simple: the generated swagger.json/yaml in internal/httpapi/docs
	// will be included in the binary.
	_ "embed"
)

//go:embed docs/swagger.json
var swaggerJSON []byte

/*
   Endpoints:
     GET /graph.mmd   -> Mermaid source (text/plain)
     GET /graph.json  -> Graph snapshot (application/json)
     GET /graph.svg   -> Rendered SVG via Kroki
     GET /graph.png   -> Rendered PNG via Kroki
     GET /docker/inspect -> Docker resource inspection via API (application/json)
     GET /health      -> "ok"
*/

// We serve frontend static files directly from the frontend/dist directory during
// development. go:embed cannot reach outside the package with ../ paths, so
// prefer http.Dir at runtime. In production you may want to embed the files.

type Options struct {
	Logger   *slog.Logger
	KrokiURL string        // e.g. "https://kroki.io" or your self-hosted URL
	Timeout  time.Duration // HTTP client timeout for Kroki; default 5s
	// CacheMaxAge controls browser cache headers for rendered images
	CacheMaxAge time.Duration // default 30s
}

func Handler(st *store.MemoryStore, optFns ...func(*Options)) http.Handler {
	opts := Options{
		Logger:      slog.Default(),
		KrokiURL:    envOr("KROKI_URL", "https://kroki.io"),
		Timeout:     5 * time.Second,
		CacheMaxAge: 30 * time.Second,
	}
	for _, fn := range optFns {
		fn(&opts)
	}
	log := opts.Logger.With("component", "httpapi")

	// Create router with middleware support
	router := NewRouter(log)

	// Initialize controllers
	graphController := NewGraphController(st, log, opts)

	// Create a shared Docker client for the HTTP handlers so we avoid creating a
	// new client per request. If creation fails, continue but mark docker as
	// unavailable (nil) and log the error.
	var dockerClient *utils.DockerClient
	if dc, err := utils.NewDockerClient(log); err != nil {
		log.Warn("failed to create shared docker client for http handlers", "err", err.Error())
	} else {
		dockerClient = dc
	}

	dockerController := NewDockerController(st, log, dockerClient)
	healthController := NewHealthController(log)

	// Register routes
	router.HandleFunc("/graph.mmd", graphController.MermaidHandler)
	router.HandleFunc("/graph.json", graphController.JSONHandler)
	router.HandleFunc("/graph.svg", graphController.SVGHandler)
	router.HandleFunc("/graph.png", graphController.PNGHandler)
	router.HandleFunc("/docker/inspect", dockerController.InspectHandler)
	router.HandleFunc("/health", healthController.HealthHandler)

	// Swagger UI (served if swag generated docs exist). Install the swag CLI
	// and run `swag init -g internal/httpapi/server.go -o internal/httpapi/docs`
	// to generate docs. The UI will then be available at /swagger/index.html
	// Serve a minimal doc JSON at /swagger/doc.json so the UI can load it.
	// Serve the generated swagger.json embedded in the binary so the UI can load it.
	router.HandleFunc("/swagger/doc.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		// Try to unmarshal the embedded swagger JSON and inject the current
		// request host and scheme so the Swagger UI will point to the right
		// server/port at runtime (swag init embeds a static host otherwise).
		var doc map[string]any
		if err := json.Unmarshal(swaggerJSON, &doc); err == nil {
			// Set host to the request Host (preserves port if present)
			doc["host"] = r.Host
			// Determine scheme: prefer TLS or X-Forwarded-Proto when behind a proxy
			scheme := "http"
			if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
				scheme = "https"
			}
			doc["schemes"] = []string{scheme}
			if b, err := json.Marshal(doc); err == nil {
				_, _ = w.Write(b)
				return
			}
		}
		// Fallback: write the raw embedded JSON
		_, _ = w.Write(swaggerJSON)
	})
	// Serve the Swagger UI; point it to our doc.json
	router.Handle("/swagger/", httpSwagger.WrapHandler)

	// Static assets
	// router.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(uiFS))))

	// Apply CORS and access logging middleware to entire API
	corsOrigin := envOr("CORS_ORIGIN", "*")
	return router.Handler(corsOrigin)
}

/* ---------- helpers ---------- */

func setCommonHeaders(w http.ResponseWriter, ctype, etag string, maxAge time.Duration) {
	w.Header().Set("Content-Type", ctype)
	if etag != "" {
		w.Header().Set("ETag", etag)
	}
	if maxAge > 0 {
		w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(maxAge.Seconds())))
	}
}

func etagFor(s string) string {
	sum := sha256.Sum256([]byte(s))
	return `W/"` + hex.EncodeToString(sum[:16]) + `"` // short weak ETag is enough
}

func checkIfNoneMatch(w http.ResponseWriter, r *http.Request, etag string) bool {
	if etag == "" {
		return false
	}
	if inm := r.Header.Get("If-None-Match"); inm != "" && inm == etag {
		w.WriteHeader(http.StatusNotModified)
		return true
	}
	return false
}

func httpError(log *slog.Logger, w http.ResponseWriter, r *http.Request, code int, msg string, args ...any) {
	log.Warn("http error", "path", r.URL.Path, "code", code, "err", fmt.Sprintf(msg, args...))
	http.Error(w, http.StatusText(code), code)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

/* ---------- tiny HTML viewers (embedded) ---------- */

// Fallback page shown when Kroki is unavailable.
var tmplFallbackHTML = template.Must(template.New("fallback").Parse(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Swarm Graph (Fallback)</title>
  <style>textarea{width:100%;height:40vh}</style>
</head>
<body>
  <h1>Kroki unavailable</h1>
  <p>{{ .Error }}</p>
  <p>Diagram source:</p>
  <textarea readonly>{{ .Diagram }}</textarea>
</body>
</html>`))

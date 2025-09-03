package httpapi

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"text/template"
	"time"

	"swarm-graph/internal/mermaid"
	"swarm-graph/internal/store"
	"swarm-graph/internal/utils"
)

/*
   Endpoints:
     GET /graph.mmd   -> Mermaid source (text/plain)
     GET /graph.json  -> Graph snapshot (application/json)
     GET /graph.svg   -> Rendered SVG via Kroki
     GET /graph.png   -> Rendered PNG via Kroki
     GET /docker/inspect -> Docker resource inspection via API (application/json)
     GET /health      -> "ok"
*/

//go:embed assets/*
var uiFS embed.FS

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

	mux := http.NewServeMux()

	// Raw Mermaid source
	mux.HandleFunc("/graph.mmd", func(w http.ResponseWriter, r *http.Request) {
		g := st.Snapshot()
		txt, err := mermaid.RenderToString(g, mermaid.DefaultOptions(), nil, nil, log)
		if err != nil {
			httpError(log, w, r, http.StatusInternalServerError, "render mermaid: %v", err)
			return
		}
		etag := etagFor(txt)
		if checkIfNoneMatch(w, r, etag) {
			return
		}
		setCommonHeaders(w, "text/plain; charset=utf-8", etag, opts.CacheMaxAge)
		_, _ = io.WriteString(w, txt)
	})

	// Graph JSON
	mux.HandleFunc("/graph.json", func(w http.ResponseWriter, r *http.Request) {
		snap := st.Snapshot()
		setCommonHeaders(w, "application/json; charset=utf-8", "", 0)
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		_ = enc.Encode(snap)
	})

	// Server-side Mermaid → SVG/PNG via Kroki
	mux.HandleFunc("/graph.svg", func(w http.ResponseWriter, r *http.Request) {
		serveRendered(w, r, st, opts, log, "svg", "image/svg+xml")
	})
	mux.HandleFunc("/graph.png", func(w http.ResponseWriter, r *http.Request) {
		serveRendered(w, r, st, opts, log, "png", "image/png")
	})

	// Health
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		setCommonHeaders(w, "text/plain; charset=utf-8", "", 0)
		_, _ = io.WriteString(w, "ok")
	})

	// Docker inspect proxy: returns inspect data using Docker API
	// Query param: id=<container-or-task-id>
	mux.HandleFunc("/docker/inspect", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			httpError(log, w, r, http.StatusBadRequest, "missing id param")
			return
		}

		// Create Docker client
		dockerClient, err := utils.NewDockerClient(log)
		if err != nil {
			httpError(log, w, r, http.StatusInternalServerError, "failed to create docker client: %v", err)
			return
		}
		defer dockerClient.Close()

		// Short timeout for docker API calls
		ctx := r.Context()
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		// Try to inspect the resource
		data, err := dockerClient.InspectAny(ctx, id)
		if err != nil {
			// Log warning and return a 500 with error message for easier debugging
			log.Warn("docker inspect failed", "id", id, "err", err.Error())
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			http.Error(w, fmt.Sprintf("docker inspect error: %s", err.Error()), http.StatusInternalServerError)
			return
		}

		// Return the JSON from docker inspect
		setCommonHeaders(w, "application/json; charset=utf-8", "", 0)
		_, _ = w.Write(data)
	})

	// Optional: static UI at /assets/
	mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(uiFS))))

	// Wrap with a tiny access log and simple CORS middleware
	corsOrigin := envOr("CORS_ORIGIN", "*")
	return accessLog(log, corsMiddleware(mux, corsOrigin))
}

// corsMiddleware sets basic CORS headers and handles OPTIONS preflight.
// The origin parameter may be '*' or a specific origin like 'http://localhost:5173'.
func corsMiddleware(next http.Handler, origin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow the configured origin. In production you may want to restrict this.
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			// Preflight request - no body
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

/* ---------- helpers ---------- */

func serveRendered(w http.ResponseWriter, r *http.Request, st *store.MemoryStore, opts Options, log *slog.Logger, format, ctype string) {
	ctx := r.Context()

	g := st.Snapshot()
	txt, err := mermaid.RenderToString(g, mermaid.DefaultOptions(), nil, nil, log)
	if err != nil {
		httpError(log, w, r, http.StatusInternalServerError, "render mermaid: %v", err)
		return
	}

	etag := etagFor(txt + "|" + format)
	if checkIfNoneMatch(w, r, etag) {
		return
	}

	img, err := krokiRender(ctx, txt, format, opts)
	if err != nil {
		// Fallback: return HTML viewer if Kroki fails (keeps things usable offline)
		log.Warn("kroki render failed; falling back to html", "err", err.Error())
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = tmplFallbackHTML.Execute(w, struct {
			Error   string
			Diagram string
		}{Error: err.Error(), Diagram: txt})
		return
	}

	setCommonHeaders(w, ctype, etag, opts.CacheMaxAge)
	_, _ = w.Write(img)
}

func krokiRender(ctx context.Context, mermaidSrc, format string, opts Options) ([]byte, error) {
	// Determine Kroki base URL: prefer opts, then env, then Docker Compose service default.
	baseURL := strings.TrimSpace(opts.KrokiURL)
	if baseURL == "" {
		// envOr is defined elsewhere in this file and will pick up envrc/.env vars.
		baseURL = envOr("KROKI_URL", "http://kroki:8000")
	}
	// Ensure a scheme is present (Docker Compose service names are typically used with http).
	if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
		baseURL = "http://" + baseURL
	}

	// POST raw source per Kroki spec: POST {KROKI}/mermaid/{format}
	// Body is plain text of the diagram.
	url := strings.TrimRight(baseURL, "/") + "/mermaid/" + format

	// Short, sane timeout per request
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(mermaidSrc))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	req.Header.Set("Accept", "*/*")

	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   3 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			MaxIdleConns:          100,
			MaxConnsPerHost:       0,
			IdleConnTimeout:       90 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("kroki status %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return io.ReadAll(resp.Body)
}

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

func accessLog(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &wr{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		log.Info("access",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.status,
			"dur_ms", time.Since(start).Milliseconds(),
			"ua", r.UserAgent(),
		)
	})
}

type wr struct {
	http.ResponseWriter
	status int
}

func (w *wr) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
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

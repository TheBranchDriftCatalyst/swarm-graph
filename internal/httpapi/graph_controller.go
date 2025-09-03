package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"swarm-graph/internal/mermaid"
	"swarm-graph/internal/store"
)

// GraphController handles graph-related API endpoints
type GraphController struct {
	store   *store.MemoryStore
	logger  *slog.Logger
	options Options
}

// NewGraphController creates a new GraphController
func NewGraphController(store *store.MemoryStore, logger *slog.Logger, opts Options) *GraphController {
	return &GraphController{
		store:   store,
		logger:  logger.With("controller", "graph"),
		options: opts,
	}
}

// MermaidHandler returns raw Mermaid source
// @Summary Mermaid source
// @Description Return raw Mermaid diagram source (text/plain) with optional query filters
// @Produce text/plain
// @Param stack query string false "Filter by stack attribute"
// @Param exclude_orphans query string false "Exclude nodes with zero degree (1/true)"
// @Param kinds query string false "Comma-separated kinds to include (container,image,network,volume)"
// @Param dir query string false "Layout direction (LR, RL, TB, BT)"
// @Param name query string false "Name substring filter (case-insensitive)"
// @Param min_degree query int false "Minimum incident edges to include node"
// @Param exclude_kinds query string false "Comma-separated kinds to exclude"
// @Param show_ids query string false "Append short IDs to labels (1/true)"
// @Param max_label_runes query int false "Truncate labels to this many runes (0 disables)"
// @Param group_by query string false "Group nodes by this attribute into subgraphs"
// @Param theme query string false "Theme name (synthwave/cyberpunk/neon)"
// @Param include_legend query string false "Include legend in output (1/true)"
// @Success 200 {string} string
// @Failure 500 {string} string
// @Router /graph.mmd [get]
func (gc *GraphController) MermaidHandler(w http.ResponseWriter, r *http.Request) {
	g := gc.store.Snapshot()
	// Parse filtering query params
	opts := mermaid.DefaultOptions()
	q := r.URL.Query()
	// Direction (LR, RL, TB, BT)
	if d := strings.TrimSpace(q.Get("dir")); d != "" {
		opts.Direction = d
	}
	if s := strings.TrimSpace(q.Get("stack")); s != "" {
		opts.FilterStack = s
	}
	if q.Get("exclude_orphans") == "1" || strings.ToLower(q.Get("exclude_orphans")) == "true" {
		opts.ExcludeOrphans = true
	}
	if name := strings.TrimSpace(q.Get("name")); name != "" {
		opts.FilterNameContains = name
	}
	if md := strings.TrimSpace(q.Get("min_degree")); md != "" {
		// best-effort parse
		if v, err := strconv.Atoi(md); err == nil && v > 0 {
			opts.MinDegree = v
		}
	}
	if sk := strings.TrimSpace(q.Get("exclude_kinds")); sk != "" {
		for _, kk := range strings.Split(sk, ",") {
			switch strings.TrimSpace(kk) {
			case "container":
				opts.ExcludeKinds = append(opts.ExcludeKinds, mermaid.NodeContainer)
			case "image":
				opts.ExcludeKinds = append(opts.ExcludeKinds, mermaid.NodeImage)
			case "network":
				opts.ExcludeKinds = append(opts.ExcludeKinds, mermaid.NodeNetwork)
			case "volume":
				opts.ExcludeKinds = append(opts.ExcludeKinds, mermaid.NodeVolume)
			}
		}
	}
	if q.Get("show_ids") == "1" || strings.ToLower(q.Get("show_ids")) == "true" {
		opts.ShowNodeIDs = true
	}
	if mr := strings.TrimSpace(q.Get("max_label_runes")); mr != "" {
		if v, err := strconv.Atoi(mr); err == nil {
			opts.MaxLabelRunes = v
		}
	}
	if gb := strings.TrimSpace(q.Get("group_by")); gb != "" {
		opts.GroupByAttr = gb
	}
	if th := strings.TrimSpace(q.Get("theme")); th != "" {
		opts.Theme = th
	}
	if q.Get("include_legend") == "1" || strings.ToLower(q.Get("include_legend")) == "true" {
		opts.IncludeLegend = true
	}
	if kinds := strings.TrimSpace(q.Get("kinds")); kinds != "" {
		// comma-separated list of kinds (container,image,network,volume)
		for _, k := range strings.Split(kinds, ",") {
			kk := strings.TrimSpace(k)
			switch kk {
			case "container":
				opts.FilterKinds = append(opts.FilterKinds, mermaid.NodeContainer)
			case "image":
				opts.FilterKinds = append(opts.FilterKinds, mermaid.NodeImage)
			case "network":
				opts.FilterKinds = append(opts.FilterKinds, mermaid.NodeNetwork)
			case "volume":
				opts.FilterKinds = append(opts.FilterKinds, mermaid.NodeVolume)
			}
		}
	}

	txt, err := mermaid.RenderToString(g, opts, nil, nil, gc.logger)
	if err != nil {
		httpError(gc.logger, w, r, http.StatusInternalServerError, "render mermaid: %v", err)
		return
	}
	etag := etagFor(txt)
	if checkIfNoneMatch(w, r, etag) {
		return
	}
	setCommonHeaders(w, "text/plain; charset=utf-8", etag, gc.options.CacheMaxAge)
	_, _ = io.WriteString(w, txt)
}

// JSONHandler returns graph snapshot as JSON
// @Summary Graph JSON snapshot
// @Produce application/json
// @Success 200 {object} map[string]interface{}
// @Router /graph.json [get]
func (gc *GraphController) JSONHandler(w http.ResponseWriter, r *http.Request) {
	snap := gc.store.Snapshot()
	setCommonHeaders(w, "application/json; charset=utf-8", "", 0)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(snap)
}

// SVGHandler returns rendered SVG via Kroki
// @Summary Rendered SVG
// @Produce image/svg+xml
// @Param stack query string false "Filter by stack"
// @Param exclude_orphans query string false "Exclude nodes with zero degree (1/true)"
// @Param kinds query string false "Comma-separated kinds to include (container,image,network,volume)"
// @Param dir query string false "Layout direction (LR, RL, TB, BT)"
// @Param name query string false "Name substring filter (case-insensitive)"
// @Param min_degree query int false "Minimum incident edges to include node"
// @Param exclude_kinds query string false "Comma-separated kinds to exclude"
// @Param show_ids query string false "Append short IDs to labels (1/true)"
// @Param max_label_runes query int false "Truncate labels to this many runes (0 disables)"
// @Param group_by query string false "Group nodes by this attribute into subgraphs"
// @Param theme query string false "Theme name (synthwave/cyberpunk/neon)"
// @Param include_legend query string false "Include legend in output (1/true)"
// @Success 200 {file} file
// @Router /graph.svg [get]
func (gc *GraphController) SVGHandler(w http.ResponseWriter, r *http.Request) {
	serveRendered(w, r, gc.store, gc.options, gc.logger, "svg", "image/svg+xml")
}

// PNGHandler returns rendered PNG via Kroki
// @Summary Rendered PNG
// @Produce image/png
// @Param stack query string false "Filter by stack"
// @Param exclude_orphans query string false "Exclude nodes with zero degree (1/true)"
// @Param kinds query string false "Comma-separated kinds to include (container,image,network,volume)"
// @Param dir query string false "Layout direction (LR, RL, TB, BT)"
// @Param name query string false "Name substring filter (case-insensitive)"
// @Param min_degree query int false "Minimum incident edges to include node"
// @Param exclude_kinds query string false "Comma-separated kinds to exclude"
// @Param show_ids query string false "Append short IDs to labels (1/true)"
// @Param max_label_runes query int false "Truncate labels to this many runes (0 disables)"
// @Param group_by query string false "Group nodes by this attribute into subgraphs"
// @Param theme query string false "Theme name (synthwave/cyberpunk/neon)"
// @Param include_legend query string false "Include legend in output (1/true)"
// @Success 200 {file} file
// @Router /graph.png [get]
func (gc *GraphController) PNGHandler(w http.ResponseWriter, r *http.Request) {
	serveRendered(w, r, gc.store, gc.options, gc.logger, "png", "image/png")
}

func serveRendered(w http.ResponseWriter, r *http.Request, st *store.MemoryStore, opts Options, log *slog.Logger, format, ctype string) {
	ctx := r.Context()

	// Snapshot and apply filters from query params
	g := st.Snapshot()
	mopts := mermaid.DefaultOptions()
	q := r.URL.Query()
	if s := strings.TrimSpace(q.Get("stack")); s != "" {
		mopts.FilterStack = s
	}
	if q.Get("exclude_orphans") == "1" || strings.ToLower(q.Get("exclude_orphans")) == "true" {
		mopts.ExcludeOrphans = true
	}
	if kinds := strings.TrimSpace(q.Get("kinds")); kinds != "" {
		for _, k := range strings.Split(kinds, ",") {
			kk := strings.TrimSpace(k)
			switch kk {
			case "container":
				mopts.FilterKinds = append(mopts.FilterKinds, mermaid.NodeContainer)
			case "image":
				mopts.FilterKinds = append(mopts.FilterKinds, mermaid.NodeImage)
			case "network":
				mopts.FilterKinds = append(mopts.FilterKinds, mermaid.NodeNetwork)
			case "volume":
				mopts.FilterKinds = append(mopts.FilterKinds, mermaid.NodeVolume)
			}
		}
	}

	txt, err := mermaid.RenderToString(g, mopts, nil, nil, log)
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

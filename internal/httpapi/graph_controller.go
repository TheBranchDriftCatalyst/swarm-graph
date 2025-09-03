package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

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
func (gc *GraphController) JSONHandler(w http.ResponseWriter, r *http.Request) {
	snap := gc.store.Snapshot()
	setCommonHeaders(w, "application/json; charset=utf-8", "", 0)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(snap)
}

// SVGHandler returns rendered SVG via Kroki
func (gc *GraphController) SVGHandler(w http.ResponseWriter, r *http.Request) {
	serveRendered(w, r, gc.store, gc.options, gc.logger, "svg", "image/svg+xml")
}

// PNGHandler returns rendered PNG via Kroki
func (gc *GraphController) PNGHandler(w http.ResponseWriter, r *http.Request) {
	serveRendered(w, r, gc.store, gc.options, gc.logger, "png", "image/png")
}

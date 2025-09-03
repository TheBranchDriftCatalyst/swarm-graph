package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

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
	txt, err := mermaid.RenderToString(g, mermaid.DefaultOptions(), nil, nil, gc.logger)
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

package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"swarm-graph/internal/store"
	"swarm-graph/internal/utils"
)

// DockerController handles Docker-related API endpoints
type DockerController struct {
	store  *store.MemoryStore
	logger *slog.Logger
	docker *utils.DockerClient
}

// NewDockerController creates a new DockerController
func NewDockerController(store *store.MemoryStore, logger *slog.Logger, docker *utils.DockerClient) *DockerController {
	return &DockerController{
		store:  store,
		logger: logger.With("controller", "docker"),
		docker: docker,
	}
}

// InspectHandler handles Docker inspect requests
// @Summary Inspect Docker resource
// @Produce application/json
// @Param id query string true "docker resource id or name"
// @Success 200 {object} object
// @Failure 400 {string} string
// @Failure 404 {string} string
// @Router /docker/inspect [get]
func (dc *DockerController) InspectHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		httpError(dc.logger, w, r, http.StatusBadRequest, "missing id param")
		return
	}
	start := time.Now()
	// Ensure a docker client is available
	if dc.docker == nil {
		dc.logger.Warn("inspect requested but docker client unavailable", "id", id, "remote", r.RemoteAddr)
		httpError(dc.logger, w, r, http.StatusServiceUnavailable, "docker client unavailable")
		return
	}

	// Short timeout for docker API calls
	ctx := r.Context()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	data, err := dc.docker.InspectAny(ctx, id)
	if err != nil {
		// Distinguish not-found vs other errors
		dc.logger.Warn("docker inspect failed", "id", id, "err", err.Error())
		code := http.StatusInternalServerError
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			code = http.StatusNotFound
		}
		httpError(dc.logger, w, r, code, "docker inspect error: %v", err)
		return
	}

	elapsed := time.Since(start)
	dc.logger.Info("docker inspect ok", "id", id, "size", len(data), "took_ms", elapsed.Milliseconds(), "remote", r.RemoteAddr)

	// Return the JSON from docker inspect
	setCommonHeaders(w, "application/json; charset=utf-8", "", 0)
	_, _ = w.Write(data)
}

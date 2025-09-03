package httpapi

import (
	"context"
	"fmt"
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
}

// NewDockerController creates a new DockerController
func NewDockerController(store *store.MemoryStore, logger *slog.Logger) *DockerController {
	return &DockerController{
		store:  store,
		logger: logger.With("controller", "docker"),
	}
}

// InspectHandler handles Docker inspect requests
func (dc *DockerController) InspectHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		httpError(dc.logger, w, r, http.StatusBadRequest, "missing id param")
		return
	}

	// Create Docker client
	dockerClient, err := utils.NewDockerClient(dc.logger)
	if err != nil {
		httpError(dc.logger, w, r, http.StatusInternalServerError, "failed to create docker client: %v", err)
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
		dc.logger.Warn("docker inspect failed", "id", id, "err", err.Error())
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		http.Error(w, fmt.Sprintf("docker inspect error: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	// Return the JSON from docker inspect
	setCommonHeaders(w, "application/json; charset=utf-8", "", 0)
	_, _ = w.Write(data)
}

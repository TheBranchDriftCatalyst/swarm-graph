package httpapi

import (
	"io"
	"log/slog"
	"net/http"
)

// HealthController handles health check endpoints
type HealthController struct {
	logger *slog.Logger
}

// NewHealthController creates a new HealthController
func NewHealthController(logger *slog.Logger) *HealthController {
	return &HealthController{
		logger: logger.With("controller", "health"),
	}
}

// HealthHandler returns service health status
// @Summary Health check
// @Produce text/plain
// @Success 200 {string} string
// @Router /health [get]
func (hc *HealthController) HealthHandler(w http.ResponseWriter, r *http.Request) {
	setCommonHeaders(w, "text/plain; charset=utf-8", "", 0)
	_, _ = io.WriteString(w, "ok")
}

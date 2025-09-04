package httpapi

import (
	"log/slog"
	"net/http"
	"time"
)

// Router handles HTTP routing with middleware support
type Router struct {
	mux    *http.ServeMux
	logger *slog.Logger
}

// NewRouter creates a new router with middleware
func NewRouter(logger *slog.Logger) *Router {
	return &Router{
		mux:    http.NewServeMux(),
		logger: logger,
	}
}

// Handle registers a handler for the given pattern
func (r *Router) Handle(pattern string, handler http.Handler) {
	r.mux.Handle(pattern, handler)
}

// HandleFunc registers a handler function for the given pattern
func (r *Router) HandleFunc(pattern string, handler http.HandlerFunc) {
	r.mux.HandleFunc(pattern, handler)
}

// Handler returns the router's handler with all middleware applied
func (r *Router) Handler(corsOrigin string) http.Handler {
	// Apply middleware in order: CORS -> Access Log -> Routes
	return r.corsMiddleware(
		r.accessLogMiddleware(r.mux),
		corsOrigin,
	)
}

// corsMiddleware sets basic CORS headers and handles OPTIONS preflight.
// The origin parameter may be '*' or a specific origin like 'http://localhost:5173'.
func (r *Router) corsMiddleware(next http.Handler, origin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Allow the configured origin. In production you may want to restrict this.
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization")

		if req.Method == http.MethodOptions {
			// Preflight request - no body
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, req)
	})
}

// accessLogMiddleware logs HTTP requests
func (r *Router) accessLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		start := time.Now()
		ww := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, req)
		r.logger.Info("access",
			"method", req.Method,
			"path", req.URL.Path,
			"status", ww.status,
			"dur_ms", time.Since(start).Milliseconds(),
			"ua", req.UserAgent(),
		)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

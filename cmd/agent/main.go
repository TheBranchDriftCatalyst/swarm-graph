package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"swarm-graph/internal/docker"
	"swarm-graph/internal/httpapi"
	"swarm-graph/internal/store"
	"syscall"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{}))
	slog.SetDefault(logger)

	st := store.NewMemoryStore()

	w, err := docker.NewWatcher(st)
	if err != nil {
		logger.Error("failed to init watcher", slog.String("err", err.Error()))
		os.Exit(1)
	}

  go func() {
		srv := &http.Server{
			Addr:    ":9123",
			Handler:      httpapi.Handler(st, func(o *httpapi.Options) {
        o.Logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
            Level: slog.LevelInfo, AddSource: true,
        }))
        // o.KrokiURL = "http://kroki:8000" // if self-hosted in docker-compose
    }),
		}
		logger.Info("serving HTTP", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("http server error", "err", err)
		}
	}()

	ctx, cancel := signal.NotifyContext(context.Background(),
		syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := w.Run(ctx); err != nil && err != context.Canceled {
		logger.Error("watcher exited with error", slog.String("err", err.Error()))
		os.Exit(1)
	}
}

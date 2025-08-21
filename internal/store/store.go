package store

import "swarm-graph/internal/model"

// Store defines the minimal persistence interface used by the watcher and HTTP API.
// It intentionally exposes only Snapshot and Mutate so implementations can be swapped
// for testing or alternative backends.
type Store interface {
    Snapshot() model.InfraGraph
    Mutate(func(g *model.InfraGraph))
}

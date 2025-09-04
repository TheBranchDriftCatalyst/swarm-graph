package store

import (
	"sync"

	"swarm-graph/internal/model"
)

type MemoryStore struct {
	mu    sync.RWMutex
	graph *model.InfraGraph
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{graph: model.NewInfraGraph()}
}

// Snapshot returns a deep(ish) copy for read-only uses.
func (s *MemoryStore) Snapshot() model.InfraGraph {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Shallow copy nodes map entries; Nodes themselves are values (copy).
	nodes := make(map[string]model.Node, len(s.graph.Nodes))
	for k, v := range s.graph.Nodes {
		// copy attributes map to prevent external mutation
		attrs := make(map[string]string, len(v.Attributes))
		for ak, av := range v.Attributes {
			attrs[ak] = av
		}
		v.Attributes = attrs
		nodes[k] = v
	}
	edges := make([]model.Edge, len(s.graph.Edges))
	copy(edges, s.graph.Edges)

	return model.InfraGraph{Nodes: nodes, Edges: edges}
}

// Mutate runs an atomic mutation.
func (s *MemoryStore) Mutate(fn func(g *model.InfraGraph)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn(s.graph)
}

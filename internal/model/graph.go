package model

// InfraGraph is the canonical DTO that the mermaid layer will consume.
// Keep it minimal, deterministic, and easy to test.
type InfraGraph struct {
	Nodes map[string]Node `json:"nodes"` // keyed by Node.ID
	Edges []Edge          `json:"edges"`
}

// NewInfraGraph returns an empty graph.
func NewInfraGraph() *InfraGraph {
	return &InfraGraph{
		Nodes: make(map[string]Node),
		Edges: make([]Edge, 0, 256),
	}
}

// UpsertNode inserts or updates a node.
func (g *InfraGraph) UpsertNode(n Node) {
	g.Nodes[n.ID] = n
}

// RemoveNode deletes a node by ID and prunes associated edges.
func (g *InfraGraph) RemoveNode(id string) {
	delete(g.Nodes, id)
	// prune edges
	dst := g.Edges[:0]
	for _, e := range g.Edges {
		if e.Src == id || e.Dst == id {
			continue
		}
		dst = append(dst, e)
	}
	g.Edges = dst
}

// AddEdge appends an edge if both endpoints exist.
// Caller ensures existence; we keep it dumb & fast.
func (g *InfraGraph) AddEdge(e Edge) {
	g.Edges = append(g.Edges, e)
}

// RemoveEdgesWhere removes edges that satisfy predicate (used for rewiring on updates).
func (g *InfraGraph) RemoveEdgesWhere(pred func(Edge) bool) {
	dst := g.Edges[:0]
	for _, e := range g.Edges {
		if pred(e) {
			continue
		}
		dst = append(dst, e)
	}
	g.Edges = dst
}

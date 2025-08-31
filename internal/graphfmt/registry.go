package graphfmt

import (
	"reflect"
	"swarm-graph/internal/model"
)

type NodeFormatter func(n model.Node, g *model.InfraGraph) model.Node
type EdgeFormatter func(e model.Edge, g *model.InfraGraph) model.Edge

type Registry struct {
	nodeAll []NodeFormatter
	edgeAll []EdgeFormatter
	nodeByK map[model.NodeKind][]NodeFormatter
	edgeByK map[model.EdgeKind][]EdgeFormatter
}

func NewRegistry() *Registry {
	return &Registry{
		nodeByK: make(map[model.NodeKind][]NodeFormatter),
		edgeByK: make(map[model.EdgeKind][]EdgeFormatter),
	}
}

// Global formatters
func (r *Registry) UseNodeAll(f NodeFormatter) { r.nodeAll = append(r.nodeAll, f) }
func (r *Registry) UseEdgeAll(f EdgeFormatter) { r.edgeAll = append(r.edgeAll, f) }

// Per-kind formatters
func (r *Registry) UseNode(kind model.NodeKind, f NodeFormatter) {
	r.nodeByK[kind] = append(r.nodeByK[kind], f)
}
func (r *Registry) UseEdge(kind model.EdgeKind, f EdgeFormatter) {
	r.edgeByK[kind] = append(r.edgeByK[kind], f)
}

// Apply in deterministic order: globals first, then per-kind in registration order.
func (r *Registry) ApplyNode(n model.Node, g *model.InfraGraph) model.Node {
	for _, f := range r.nodeAll {
		n = f(n, g)
	}
	if v, ok := r.nodeByK[n.Kind]; ok {
		for _, f := range v {
			n = f(n, g)
		}
	}
	return n
}

func (r *Registry) ApplyEdge(e model.Edge, g *model.InfraGraph) model.Edge {
	for _, f := range r.edgeAll {
		e = f(e, g)
	}
	if v, ok := r.edgeByK[e.Kind]; ok {
		for _, f := range v {
			e = f(e, g)
		}
	}
	return e
}

// Utilities: allow removal/replacement if you need reconfiguration at runtime.
func (r *Registry) ClearNode(kind model.NodeKind) { delete(r.nodeByK, kind) }
func (r *Registry) ClearEdge(kind model.EdgeKind) { delete(r.edgeByK, kind) }

func (r *Registry) RemoveNodeAll(f NodeFormatter) {
	fp := reflect.ValueOf(f).Pointer()
	idx := -1
	for i, v := range r.nodeAll {
		if reflect.ValueOf(v).Pointer() == fp {
			idx = i
			break
		}
	}
	if idx >= 0 {
		r.nodeAll = append(r.nodeAll[:idx], r.nodeAll[idx+1:]...)
	}
}
func (r *Registry) RemoveEdgeAll(f EdgeFormatter) {
	fp := reflect.ValueOf(f).Pointer()
	idx := -1
	for i, v := range r.edgeAll {
		if reflect.ValueOf(v).Pointer() == fp {
			idx = i
			break
		}
	}
	if idx >= 0 {
		r.edgeAll = append(r.edgeAll[:idx], r.edgeAll[idx+1:]...)
	}
}

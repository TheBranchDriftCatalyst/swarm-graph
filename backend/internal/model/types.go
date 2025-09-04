package model

// NodeKind is a coarse type used for mermaid grouping/styling later.
type NodeKind string

const (
	NodeContainer NodeKind = "container"
	NodeImage     NodeKind = "image"
	NodeNetwork   NodeKind = "network"
	NodeVolume    NodeKind = "volume"
)

// EdgeKind defines the semantic relation between nodes.
type EdgeKind string

const (
	// Container -> Image (derived from)
	EdgeDerivedFrom EdgeKind = "derived_from"
	// Container -> Network (connected to)
	EdgeConnectedTo EdgeKind = "connected_to"
	// Volume -> Container (mounted into)
	EdgeMountedInto EdgeKind = "mounted_into"
)
  
// Node is a mermaid-friendly graph node.
// Keep Attributes flat-string for easy templating later.
type Node struct {
	ID         string            `json:"id"`
	Kind       NodeKind          `json:"kind"`
	Name       string            `json:"name"`
	Attributes map[string]string `json:"attributes,omitempty"`
}

// Edge is a directional relationship (Mermaid supports directional edges).
type Edge struct {
	Src        string            `json:"src"`
	Dst        string            `json:"dst"`
	Kind       EdgeKind          `json:"kind"`
	Attributes map[string]string `json:"attributes,omitempty"`
}

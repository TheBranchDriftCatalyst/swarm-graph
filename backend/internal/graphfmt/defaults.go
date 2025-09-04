package graphfmt

import (
	"fmt"
	"strings"
	"swarm-graph/internal/model"
)

// ShortID: sha256:abcdef... -> abcdef
func ShortID(id string) string {
	if id == "" {
		return ""
	}
	if i := strings.IndexByte(id, ':'); i >= 0 && i+1 < len(id) {
		id = id[i+1:]
	}
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

// nameOrShortID: prefer non-empty name, else fallback to short id
func nameOrShortID(name, id string) string {
	if strings.TrimSpace(name) != "" {
		return name
	}
	return ShortID(id)
}

// ContainerFriendlyName sets Node.Name (if empty) and/or attributes["display_name"] to "<imageName>@<shortID>".
// It expects container node has Attributes["image_id"] or Attributes["image"] already set by the caller.
func ContainerFriendlyName() NodeFormatter {
	return func(n model.Node, g *model.InfraGraph) model.Node {
		if n.Kind != model.NodeContainer {
			return n
		}
		// Resolve image name
		imgName := n.Attributes["image"]
		if imgID := n.Attributes["image_id"]; imgID != "" {
			if in, ok := g.Nodes[imgID]; ok {
				imgName = nameOrShortID(in.Name, in.ID)
			} else if imgName == "" {
				imgName = nameOrShortID("", imgID)
			}
		}
		if imgName == "" {
			imgName = "container"
		}

		display := fmt.Sprintf("%s@%s", imgName, ShortID(n.ID))
		n.Attributes["display_name"] = display
		// Only override n.Name if it's empty; keep explicit names stable.
		if strings.TrimSpace(n.Name) == "" {
			n.Name = display
		}
		return n
	}
}

// EdgeConnectedToIP annotates connected_to edges with a display label "<ip>" when present.
func EdgeConnectedToIP() EdgeFormatter {
	return func(e model.Edge, g *model.InfraGraph) model.Edge {
		if e.Kind != model.EdgeConnectedTo {
			return e
		}
		ip := e.Attributes["ip"]
		if ip != "" {
			e.Attributes["label"] = ip
		}
		return e
	}
}

// Tag network nodes with a short, stable display_name
func NetworkDisplayName() NodeFormatter {
	return func(n model.Node, g *model.InfraGraph) model.Node {
		if n.Kind != model.NodeNetwork {
			return n
		}
		if n.Attributes == nil {
			n.Attributes = map[string]string{}
		}
		n.Attributes["display_name"] = nameOrShortID(n.Name, n.ID)
		return n
	}
}

// Label mounted_into edges as "/path (rw|ro)"
func MountedIntoLabel() EdgeFormatter {
	return func(e model.Edge, g *model.InfraGraph) model.Edge {
		if e.Kind != model.EdgeMountedInto {
			return e
		}
		t := e.Attributes["target"]
		rw := e.Attributes["rw"]
		if t != "" && rw != "" {
			e.Attributes["label"] = t + " (" + rw + ")"
		}
		return e
	}
}

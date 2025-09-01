package mermaid

import (
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"
	"swarm-graph/internal/model"
)

// Options controls rendering behavior.
type Options struct {
	Direction       string                    // "TB", "LR", "BT", "RL"
	ClusterByKind   bool                      // group nodes in subgraphs by NodeKind
	IncludeStopped  bool                      // include containers with state != "running"
	ShortenIDs      bool                      // show short IDs for names if Name empty
	HideSystemNets  bool                      // hide default docker networks (bridge, host, none)
	NodeStyles      map[model.NodeKind]string // Mermaid style for nodes by kind (optional)
	EdgeLabels      bool                      // label edges by EdgeKind
	ExtraNodeFields []string                  // attributes to surface in node labels (e.g., ["image","state"])
}

// TODO: add params to filter node and edges by type
// TODO: add custom layer vendor icons/logos
// FFor example we can label the container image with the logo for sonarr,radarrr
// We want to be able to define these configs as a json as well. services.json which
// would store the logo,.

// DefaultOptions returns sensible defaults.
func DefaultOptions() Options {
	return Options{
		Direction:      "TB",
		ClusterByKind:  true,
		IncludeStopped: true,
		ShortenIDs:     true,
		HideSystemNets: true,
		NodeStyles: map[model.NodeKind]string{
			model.NodeContainer: "fill:#1f6feb,stroke:#0d419d,stroke-width:1px,color:#fff",
			model.NodeImage:     "fill:#6e7781,stroke:#30363d,stroke-width:1px,color:#fff",
			model.NodeNetwork:   "fill:#238636,stroke:#0e4429,stroke-width:1px,color:#fff",
			model.NodeVolume:    "fill:#8957e5,stroke:#553098,stroke-width:1px,color:#fff",
		},
		EdgeLabels:      true,
		ExtraNodeFields: []string{"image", "state", "driver"},
	}
}

// Render returns a Mermaid flowchart ("flowchart <dir>\n...") for the provided graph.
// The result is deterministic (stable ordering of nodes and edges).
func Render(g model.InfraGraph, opts Options) (string, error) {
	if opts.Direction == "" {
		opts = DefaultOptionsOverride(opts)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "flowchart %s\n", sanitizeDirection(opts.Direction))

	// Filter nodes as requested
	nodes := make([]model.Node, 0, len(g.Nodes))
	for _, n := range g.Nodes {
		// Skip image nodes; image information will be attached to containers instead
		if n.Kind == model.NodeImage {
			continue
		}
		if n.Kind == model.NodeNetwork && opts.HideSystemNets {
			if isSystemNetwork(n.Name, n.Attributes["driver"]) {
				continue
			}
		}
		if n.Kind == model.NodeContainer && !opts.IncludeStopped {
			state := strings.ToLower(n.Attributes["state"])
			if state != "" && state != "running" {
				continue
			}
		}
		nodes = append(nodes, n)
	}

	// Sort nodes deterministically
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].Kind != nodes[j].Kind {
			return nodes[i].Kind < nodes[j].Kind
		}
		return stableName(nodes[i], opts) < stableName(nodes[j], opts)
	})

	// Build index for quick existence checks after filtering
	allowed := make(map[string]struct{}, len(nodes))
	for _, n := range nodes {
		allowed[n.ID] = struct{}{}
	}

	// Group by kind if requested
	if opts.ClusterByKind {
		for _, kind := range sortedKindsPresent(nodes) {
			id := fmt.Sprintf("cluster_%s", string(kind))
			title := strings.ToUpper(string(kind))
			fmt.Fprintf(&b, "  subgraph %s[%s]\n", idSafe(id), escapeText(title))
			// style for subgraph (optional): not styling subgraph by default to keep contrast OK.
			// Emit nodes of this kind
			for _, n := range nodes {
				if n.Kind != kind {
					continue
				}
				writeNode(&b, n, opts)
			}
			fmt.Fprintf(&b, "  end\n")
		}
	} else {
		for _, n := range nodes {
			writeNode(&b, n, opts)
		}
	}

	// Render edges: only those whose endpoints survived filtering
	edges := make([]model.Edge, 0, len(g.Edges))
	edges = append(edges, g.Edges...)
	sort.SliceStable(edges, func(i, j int) bool {
		if edges[i].Kind != edges[j].Kind {
			return edges[i].Kind < edges[j].Kind
		}
		if edges[i].Src != edges[j].Src {
			return edges[i].Src < edges[j].Src
		}
		return edges[i].Dst < edges[j].Dst
	})

	for _, e := range edges {
		if _, ok := allowed[e.Src]; !ok {
			continue
		}
		if _, ok := allowed[e.Dst]; !ok {
			continue
		}
		// Mermaid edge; we use --> for direction.
		label := ""
		if opts.EdgeLabels {
			label = edgeLabel(e)
		}
		fmt.Fprintf(&b, "  %s -->%s %s\n",
			nodeRef(g.Nodes[e.Src], opts),
			label,
			nodeRef(g.Nodes[e.Dst], opts),
		)
	}

	// Optional styling for nodes by kind
	if len(opts.NodeStyles) > 0 {
		// Collect nodes by kind for style application
		byKind := make(map[model.NodeKind][]model.Node)
		for _, n := range nodes {
			byKind[n.Kind] = append(byKind[n.Kind], n)
		}

		// Convert iterator to slice
		var kinds []model.NodeKind
		for kind := range maps.Keys(byKind) {
			kinds = append(kinds, kind)
		}

		slices.SortFunc(kinds, func(a, b model.NodeKind) int {
			if a < b {
				return -1
			}
			if a > b {
				return 1
			}
			return 0
		})
		for _, kind := range kinds {
			style, ok := opts.NodeStyles[kind]
			if !ok || style == "" {
				continue
			}
			for _, n := range byKind[kind] {
				fmt.Fprintf(&b, "  style %s %s\n", idSafe(nodeID(n, opts)), style)
			}
		}
	}

	return b.String(), nil
}

func DefaultOptionsOverride(in Options) Options {
	d := DefaultOptions()
	// shallow override of provided non-zero values/maps
	if in.Direction != "" {
		d.Direction = in.Direction
	}
	d.ClusterByKind = in.ClusterByKind || d.ClusterByKind && !in.ClusterByKind
	// The above line keeps default true when in.ClusterByKind is false-zero (Go bool defaults to false).
	// To avoid confusion, just copy explicit fields:
	d.ClusterByKind = in.ClusterByKind || (!in.ClusterByKind && d.ClusterByKind)
	d.IncludeStopped = in.IncludeStopped || (!in.IncludeStopped && d.IncludeStopped)
	d.ShortenIDs = in.ShortenIDs || (!in.ShortenIDs && d.ShortenIDs)
	d.HideSystemNets = in.HideSystemNets || (!in.HideSystemNets && d.HideSystemNets)
	if in.NodeStyles != nil {
		d.NodeStyles = in.NodeStyles
	}
	d.EdgeLabels = in.EdgeLabels || (!in.EdgeLabels && d.EdgeLabels)
	if len(in.ExtraNodeFields) > 0 {
		d.ExtraNodeFields = in.ExtraNodeFields
	}
	return d
}

func writeNode(b *strings.Builder, n model.Node, opts Options) {
	id := idSafe(nodeID(n, opts))
	label := nodeLabel(n, opts)
	switch n.Kind {
	case model.NodeContainer:
		// rounded rect
		fmt.Fprintf(b, "    %s(%s)\n", id, label)
	case model.NodeImage:
		// square bracket
		fmt.Fprintf(b, "    %s[%s]\n", id, label)
	case model.NodeNetwork:
		// stadium
		fmt.Fprintf(b, "    %s([%s])\n", id, label)
	case model.NodeVolume:
		// cylinder
		fmt.Fprintf(b, "    %s[(%s)]\n", id, label)
	default:
		fmt.Fprintf(b, "    %s[%s]\n", id, label)
	}
}

func nodeLabel(n model.Node, opts Options) string {
	// Primary: Name or short ID
	base := stableName(n, opts)
	var extras []string
	// Add selected attributes if present
	for _, k := range opts.ExtraNodeFields {
		if v, ok := n.Attributes[k]; ok && v != "" {
			extras = append(extras, fmt.Sprintf("%s: %s", k, trimForLabel(v)))
		}
	}
	if len(extras) > 0 {
		return escapeText(base + "\\n" + strings.Join(extras, "\\n"))
	}
	return escapeText(base)
}

func nodeID(n model.Node, opts Options) string {
	// Keep a stable internal id; prefer original ID to avoid collisions.
	// But Mermaid ids must be alnum + _.
	return toMermaidID(n.ID)
}

func nodeRef(n model.Node, opts Options) string {
	return idSafe(nodeID(n, opts))
}

func stableName(n model.Node, opts Options) string {
	if n.Name != "" {
		return n.Name
	}
	if opts.ShortenIDs && len(n.ID) > 12 {
		return n.ID[:12]
	}
	return n.ID
}

func edgeLabel(e model.Edge) string {
	// Map kinds to short labels
	var lbl string
	switch e.Kind {
	case model.EdgeDerivedFrom:
		lbl = "derived"
	case model.EdgeConnectedTo:
		lbl = "net"
	case model.EdgeMountedInto:
		lbl = "mount"
	default:
		lbl = string(e.Kind)
	}
	// Include a tiny attribute teaser if present (e.g., target path)
	if t := e.Attributes["target"]; t != "" {
		lbl = lbl + " | " + t
	} else if ip := e.Attributes["ip"]; ip != "" {
		lbl = lbl + " | " + ip
	}
	// Mermaid label syntax: |text|
	return fmt.Sprintf("|%s|", escapeBarText(lbl))
}

func isSystemNetwork(name, driver string) bool {
	n := strings.ToLower(name)
	if n == "bridge" || n == "host" || n == "none" {
		return true
	}
	// Some environments name them "docker0" or similar.
	if n == "docker0" {
		return true
	}
	_ = driver // reserved for future heuristics
	return false
}

func trimForLabel(s string) string {
	// Keep labels readable; avoid dumping long digests/arrays.
	if len(s) > 40 {
		return s[:37] + "..."
	}
	return s
}

func sanitizeDirection(dir string) string {
	switch strings.ToUpper(dir) {
	case "TB", "BT", "LR", "RL":
		return strings.ToUpper(dir)
	default:
		return "TB"
	}
}

func idSafe(s string) string { return toMermaidID(s) }

// Mermaid node IDs: letters, digits, underscore. Replace others with underscore.
func toMermaidID(s string) string {
	if s == "" {
		return "_"
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') ||
			(r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') ||
			r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	return b.String()
}

// Escape label text for Mermaid (avoid backticks/quotes breaking the graph).
func escapeText(s string) string {
	// Mermaid is permissive inside [] but newlines must be escaped as \\n in source.
	s = strings.ReplaceAll(s, "`", "'")
	s = strings.ReplaceAll(s, "\"", "'")
	s = strings.ReplaceAll(s, "{", "(")
	s = strings.ReplaceAll(s, "}", ")")
	return s
}

func escapeBarText(s string) string {
	// Label delimiter is |...| — escape stray pipes.
	return strings.ReplaceAll(s, "|", "/")
}

// Utility for sorting kinds present.
func sortedKindsPresent(nodes []model.Node) []model.NodeKind {
	set := make(map[model.NodeKind]struct{})
	for _, n := range nodes {
		set[n.Kind] = struct{}{}
	}
	kinds := make([]model.NodeKind, 0, len(set))
	for k := range set {
		kinds = append(kinds, k)
	}
	sort.Slice(kinds, func(i, j int) bool { return kinds[i] < kinds[j] })
	return kinds
}

// Package mermaid renders an InfraGraph (shared with the D3 frontend) into Mermaid flowchart text.
//
// Usage:
//
//	f, _ := os.Create("graph.mmd")
//	defer f.Close()
//
//	// g := load your InfraGraph JSON (same you send to the frontend)
//	opts := mermaid.RenderOptions{
//	    Direction:        "LR",              // "LR", "TB", "BT", "RL"
//	    GroupByAttr:      "stack",           // group containers etc by "stack" attribute; "" to disable grouping
//	    ShowNodeIDs:      false,             // optionally append short IDs to labels
//	    MaxLabelRunes:    48,                // truncate long labels (0 disables)
//	    IncludeLegend:    true,
//	}
//
//	// Optional: formatting layer for nicer labels.
//	nf := mermaid.NodeFormatterFunc(func(n mermaid.Node) (string, map[string]string) {
//	    // Prefer friendly container label: "<image>:<tag> • <shortID>"
//	    if n.Kind == mermaid.NodeContainer {
//	        img := n.Attributes["image"]
//	        sid := mermaid.ShortID(n.ID)
//	        if img != "" {
//	            return img + " • " + sid, nil
//	        }
//	        return n.Name + " • " + sid, nil
//	    }
//	    // networks/images/volumes fall back to Name or short ID
//	    if n.Name != "" {
//	        return n.Name, nil
//	    }
//	    return mermaid.ShortID(n.ID), nil
//	})
//
//	ef := mermaid.EdgeFormatterFunc(func(e mermaid.Edge) string {
//	    switch e.Kind {
//	    case mermaid.EdgeConnectedTo:
//	        if ip := e.Attributes["ip"]; ip != "" {
//	            return ip
//	        }
//	    case mermaid.EdgeMountedInto:
//	        if tgt := e.Attributes["target"]; tgt != "" {
//	            return tgt
//	        }
//	    }
//	    return ""
//	})
//
//	if err := mermaid.Render(f, g, opts, nf, ef, nil); err != nil {
//	    log.Fatal(err)
//	}
package mermaid

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"swarm-graph/internal/model"
)

// ===== Shared DTOs (kept compatible with the frontend D3 layer) =====

// Use types from the model package
type NodeKind = model.NodeKind

const (
	NodeContainer = model.NodeContainer
	NodeNetwork   = model.NodeNetwork
	NodeImage     = model.NodeImage
	NodeVolume    = model.NodeVolume
)

type EdgeKind = model.EdgeKind

const (
	EdgeDerivedFrom = model.EdgeDerivedFrom
	EdgeConnectedTo = model.EdgeConnectedTo
	EdgeMountedInto = model.EdgeMountedInto
)

type Node = model.Node
type Edge = model.Edge
type InfraGraph = model.InfraGraph

// ===== Formatting Layer =====

// NodeFormatter returns a display label and optional class overrides via extras (unused for now).
type NodeFormatter interface {
	FormatNode(n Node) (label string, extras map[string]string)
}
type NodeFormatterFunc func(n Node) (label string, extras map[string]string)

func (f NodeFormatterFunc) FormatNode(n Node) (string, map[string]string) { return f(n) }

type EdgeFormatter interface {
	FormatEdge(e Edge) (label string)
}
type EdgeFormatterFunc func(e Edge) string

func (f EdgeFormatterFunc) FormatEdge(e Edge) string { return f(e) }

// ===== Render Options =====

type RenderOptions struct {
	// Mermaid direction: "LR", "RL", "TB", "BT"
	Direction string

	// GroupByAttr clusters nodes into Mermaid subgraphs by this attribute (e.g., "stack").
	// Leave empty to disable grouping.
	GroupByAttr string

	// If true, append short IDs to node labels (if they’re not already present).
	ShowNodeIDs bool

	// Truncate labels to at most N runes (0 disables).
	MaxLabelRunes int

	// Include a small legend of classes and kinds.
	IncludeLegend bool

	// Extra class defs (raw Mermaid lines) appended to defaults.
	ExtraClassDefs []string

	// Logger (optional). If nil, a no-op logger is used.
	Logger *slog.Logger
	// VendorLogos maps a vendor/image name (short repo name) to an image URL that
	// will be injected into node labels when available. The renderer will attempt
	// to derive the short repo name from node.Attributes["image"].
	VendorLogos map[string]string

	// Theme selects a built-in theme for default class defs. "synthwave" is the
	// default which produces a dark neon/cyberpunk palette. Callers may append
	// ExtraClassDefs to override specifics.
	Theme string

	// Filtering options applied before rendering. These allow callers to
	// restrict which nodes/edges are included in the output. They are
	// intentionally simple and implemented server-side so the UI can request
	// pre-filtered diagrams via query params.
	// FilterStack, if non-empty, will include only nodes with
	// Attributes["stack"] == FilterStack.
	FilterStack string

	// FilterNameContains restricts nodes to those whose Name (or derived
	// short id) contains this substring (case-insensitive). Empty disables.
	FilterNameContains string

	// MinDegree, when >0, excludes nodes with fewer than MinDegree incident
	// edges (degree computed after other filters are applied).
	MinDegree int

	// ExcludeKinds lists node kinds to exclude from the render (inverse of
	// FilterKinds which is an allow-list). Useful for hiding images/networks.
	ExcludeKinds []NodeKind

	// ExcludeOrphans removes any nodes that have zero incident edges after
	// all other filters are applied.
	ExcludeOrphans bool

	// FilterKinds, when non-empty, restricts nodes to the provided kinds.
	FilterKinds []NodeKind
}

// ===== Public API =====

// Render writes a Mermaid flowchart to w.
func Render(w io.Writer, g InfraGraph, opts RenderOptions, nf NodeFormatter, ef EdgeFormatter, m *slog.Logger) error {
	if w == nil {
		return errors.New("nil writer")
	}
	if m == nil {
		m = opts.Logger
	}
	if m == nil {
		m = slog.New(slog.NewTextHandler(io.Discard, &slog.HandlerOptions{}))
	}

	// Defensive copy & normalize
	nodes := make(map[string]Node, len(g.Nodes))
	for id, n := range g.Nodes {
		n.ID = id // enforce map key as canonical ID
		nodes[id] = n
	}

	edges := append([]Edge(nil), g.Edges...)

	// Deterministic order
	nodeIDs := make([]string, 0, len(nodes))
	for id := range nodes {
		nodeIDs = append(nodeIDs, id)
	}
	sort.Strings(nodeIDs)

	sort.SliceStable(edges, func(i, j int) bool {
		if edges[i].Src != edges[j].Src {
			return edges[i].Src < edges[j].Src
		}
		if edges[i].Dst != edges[j].Dst {
			return edges[i].Dst < edges[j].Dst
		}
		return edges[i].Kind < edges[j].Kind
	})

	// Apply filters (if any) to produce a view of nodes/edges we'll render.
	if opts.FilterStack != "" || opts.ExcludeOrphans || len(opts.FilterKinds) > 0 || opts.FilterNameContains != "" || opts.MinDegree > 0 || len(opts.ExcludeKinds) > 0 {
		m.Debug("applying render filters", "stack", opts.FilterStack, "exclude_orphans", opts.ExcludeOrphans, "kinds", opts.FilterKinds)
		// Build a set of allowed kinds if provided
		allowedKinds := map[NodeKind]struct{}{}
		if len(opts.FilterKinds) > 0 {
			for _, k := range opts.FilterKinds {
				allowedKinds[k] = struct{}{}
			}
		}
		// Build a set of excluded kinds if provided
		excludedKinds := map[NodeKind]struct{}{}
		if len(opts.ExcludeKinds) > 0 {
			for _, k := range opts.ExcludeKinds {
				excludedKinds[k] = struct{}{}
			}
		}

		// Filter nodes by stack and kinds
		filtered := make(map[string]Node, 0)
		nameFilter := strings.ToLower(strings.TrimSpace(opts.FilterNameContains))
		for id, n := range nodes {
			if opts.FilterStack != "" {
				if n.Attributes == nil || n.Attributes["stack"] != opts.FilterStack {
					continue
				}
			}
			if len(allowedKinds) > 0 {
				if _, ok := allowedKinds[n.Kind]; !ok {
					continue
				}
			}
			if len(excludedKinds) > 0 {
				if _, ok := excludedKinds[n.Kind]; ok {
					continue
				}
			}
			if nameFilter != "" {
				name := strings.ToLower(n.Name)
				if name == "" {
					name = strings.ToLower(ShortID(n.ID))
				}
				if !strings.Contains(name, nameFilter) {
					continue
				}
			}
			filtered[id] = n
		}

		// Filter edges to those connecting allowed nodes
		newEdges := make([]Edge, 0, len(edges))
		for _, e := range edges {
			if _, ok := filtered[e.Src]; !ok {
				continue
			}
			if _, ok := filtered[e.Dst]; !ok {
				continue
			}
			newEdges = append(newEdges, e)
		}

		// Optionally exclude orphans: nodes with zero incident edges
		if opts.ExcludeOrphans {
			incident := map[string]int{}
			for _, e := range newEdges {
				incident[e.Src]++
				incident[e.Dst]++
			}
			for id := range filtered {
				if incident[id] == 0 {
					delete(filtered, id)
				}
			}

			// Re-filter edges to remaining nodes
			tmp := newEdges[:0]
			for _, e := range newEdges {
				if _, ok := filtered[e.Src]; !ok {
					continue
				}
				if _, ok := filtered[e.Dst]; !ok {
					continue
				}
				tmp = append(tmp, e)
			}
			newEdges = tmp
		}

		// Optionally apply MinDegree after previous filtering (degree in newEdges)
		if opts.MinDegree > 0 {
			incident := map[string]int{}
			for _, e := range newEdges {
				incident[e.Src]++
				incident[e.Dst]++
			}
			for id := range filtered {
				if incident[id] < opts.MinDegree {
					delete(filtered, id)
				}
			}
			// Re-filter edges to remaining nodes
			tmp := newEdges[:0]
			for _, e := range newEdges {
				if _, ok := filtered[e.Src]; !ok {
					continue
				}
				if _, ok := filtered[e.Dst]; !ok {
					continue
				}
				tmp = append(tmp, e)
			}
			newEdges = tmp
		}

		// Replace nodes/edges for rendering
		nodes = filtered
		edges = newEdges

		// Recompute sorted nodeIDs deterministic order
		nodeIDs = nodeIDs[:0]
		for id := range nodes {
			nodeIDs = append(nodeIDs, id)
		}
		sort.Strings(nodeIDs)
	}

	// Prepare Mermaid
	dir := strings.ToUpper(strings.TrimSpace(opts.Direction))
	if dir == "" {
		dir = "LR"
	}
	var buf bytes.Buffer

	// Emit an init block so Mermaid uses a dark synthwave themeVariables set.
	// This helps ensure a dark background and consistent neon colors are used
	// by renderers (Kroki, Mermaid live, etc.). Users may still override
	// specifics via ExtraClassDefs.
	th := strings.ToLower(strings.TrimSpace(opts.Theme))
	if th == "" {
		th = "synthwave"
	}
	if th == "synthwave" || th == "cyberpunk" || th == "neon" {
		initBlock := `%%{ init: { 'theme': 'dark', 'themeVariables': { 'background':'#0a0e27', 'primaryColor':'#3a86ff', 'primaryTextColor':'#bfe3ff', 'secondaryColor':'#ff006e', 'tertiaryColor':'#8338ec', 'edgeLabelBackground':'#0a0e27', 'clusterBkg':'#071028', 'clusterBorder':'#3a86ff', 'nodeTextColor':'#bfe3ff', 'fontFamily':'"Source Code Pro", "Fira Code", monospace' } } }%%`

		buf.WriteString(initBlock)
	}

	fmt.Fprintf(&buf, "flowchart %s\n", dir)
	// Classes (node kinds)
	writeDefaultClassDefs(&buf, opts)
	for _, extra := range opts.ExtraClassDefs {
		buf.WriteString(extra)
		if !strings.HasSuffix(extra, "\n") {
			buf.WriteByte('\n')
		}
	}

	// Build mermaid-safe IDs for nodes and assign classes
	mermID := make(map[string]string, len(nodes)) // graph ID -> mermaid node id
	used := map[string]struct{}{}
	for _, id := range nodeIDs {
		n := nodes[id]
		mid := sanitizeID(shortPreferName(n))
		// ensure uniqueness
		orig := mid
		i := 2
		for {
			if _, ok := used[mid]; !ok {
				break
			}
			mid = fmt.Sprintf("%s_%d", orig, i)
			i++
		}
		used[mid] = struct{}{}
		mermID[id] = mid
	}

	// Helper functions for building node/edge lines (methods are not allowed
	// on local types inside functions, so use closures).
	nodeLines := func(n Node, mid string) []string {
		label := n.Name
		if nf != nil {
			if l, _ := nf.FormatNode(n); l != "" {
				label = l
			}
		}
		if label == "" {
			label = ShortID(n.ID)
		}
		if opts.ShowNodeIDs && !strings.Contains(label, ShortID(n.ID)) {
			label = label + " • " + ShortID(n.ID)
		}

		var logoPrefix string
		if opts.VendorLogos != nil {
			if imgRef := n.Attributes["image"]; imgRef != "" {
				parts := strings.Split(imgRef, "/")
				last := parts[len(parts)-1]
				key := strings.Split(last, ":")[0]
				if url, ok := opts.VendorLogos[key]; ok {
					logoPrefix = fmt.Sprintf("<img src=\"%s\" width=\"18\" height=\"18\" /> ", esc(url))
				}
			}
		}

		textLabel := label
		if opts.MaxLabelRunes > 0 {
			textLabel = truncateRunes(textLabel, opts.MaxLabelRunes)
		}
		textLabel = esc(textLabel)
		full := logoPrefix + textLabel

		nodeLine := fmt.Sprintf("  %s[\"%s\"]", mid, full)
		kind := strings.ToLower(string(n.Kind))
		switch n.Kind {
		case NodeContainer, NodeNetwork, NodeImage, NodeVolume:
			return []string{nodeLine, fmt.Sprintf("  class %s %s;", mid, kind)}
		default:
			return []string{nodeLine}
		}
	}

	edgeLine := func(e Edge, src, dst string) string {
		lbl := ""
		if ef != nil {
			lbl = ef.FormatEdge(e)
		} else {
			switch e.Kind {
			case EdgeConnectedTo:
				if ip := e.Attributes["ip"]; ip != "" {
					lbl = ip
				}
			case EdgeMountedInto:
				if t := e.Attributes["target"]; t != "" {
					lbl = t
				}
			}
		}
		lbl = esc(lbl)

		arrow := "-->"
		switch e.Kind {
		case EdgeDerivedFrom:
			arrow = "-.->"
		case EdgeMountedInto:
			arrow = "--o"
		case EdgeConnectedTo:
			arrow = "-->"
		}
		if lbl != "" {
			return fmt.Sprintf("  %s %s|\"%s\"| %s", src, arrow, lbl, dst)
		}
		return fmt.Sprintf("  %s %s %s", src, arrow, dst)
	}

	// Grouping
	groupBy := strings.TrimSpace(opts.GroupByAttr)
	if groupBy != "" {
		grouped := map[string][]string{} // groupValue -> []nodeIDs
		for _, id := range nodeIDs {
			n := nodes[id]
			if v := n.Attributes[groupBy]; v != "" {
				grouped[v] = append(grouped[v], id)
			} else {
				grouped["(ungrouped)"] = append(grouped["(ungrouped)"], id)
			}
		}
		// deterministic order of groups
		gkeys := make([]string, 0, len(grouped))
		for k := range grouped {
			gkeys = append(gkeys, k)
		}
		sort.Strings(gkeys)

		for _, gv := range gkeys {
			title := esc(fmt.Sprintf("%s: %s", groupBy, gv))
			fmt.Fprintf(&buf, "  subgraph \"%s\"\n", title)
			for _, id := range grouped[gv] {
				for _, line := range nodeLines(nodes[id], mermID[id]) {
					buf.WriteString(line)
					buf.WriteByte('\n')
				}
			}
			buf.WriteString("  end\n")
		}
	} else {
		// No grouping; just print nodes
		for _, id := range nodeIDs {
			for _, line := range nodeLines(nodes[id], mermID[id]) {
				buf.WriteString(line)
				buf.WriteByte('\n')
			}
		}
	}

	// Edges
	for _, e := range edges {
		src, okS := mermID[e.Src]
		dst, okD := mermID[e.Dst]
		if !okS || !okD {
			m.Warn("edge references missing node", slog.String("src", e.Src), slog.String("dst", e.Dst), slog.String("kind", string(e.Kind)))
			continue
		}
		buf.WriteString(edgeLine(e, src, dst))
		buf.WriteByte('\n')
	}

	// Legend (optional)
	if opts.IncludeLegend {
		buf.WriteString("\n  %% Legend\n")
		buf.WriteString("  subgraph \"Legend\"\n")
		buf.WriteString("    classDef container fill:#0a0e27,stroke:#3a86ff,stroke-width:2px,color:#bfe3ff;\n")
		buf.WriteString("    classDef network   fill:#0a0e27,stroke:#ff006e,stroke-width:2px,color:#ffd1e3;\n")
		buf.WriteString("    classDef image     fill:#0a0e27,stroke:#8338ec,stroke-width:2px,color:#e0d0ff;\n")
		buf.WriteString("    classDef volume    fill:#0a0e27,stroke:#ffbe0b,stroke-width:2px,color:#fff3c4;\n")
		buf.WriteString("    LC[Container]:::container\n")
		buf.WriteString("    LN[Network]:::network\n")
		buf.WriteString("    LI[Image]:::image\n")
		buf.WriteString("    LV[Volume]:::volume\n")
		buf.WriteString("    LC -->|connected_to| LN\n")
		buf.WriteString("    LC --o|mounted_into| LV\n")
		buf.WriteString("    LC -.->|derived_from| LI\n")
		buf.WriteString("  end\n")
	}

	_, err := w.Write(buf.Bytes())
	return err
}

// RenderToFile renders to a path (overwrites).
func RenderToFile(path string, g InfraGraph, opts RenderOptions, nf NodeFormatter, ef EdgeFormatter, m *slog.Logger) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return Render(f, g, opts, nf, ef, m)
}

// RenderToString renders a Mermaid flowchart to a string and returns it.
func RenderToString(g InfraGraph, opts RenderOptions, nf NodeFormatter, ef EdgeFormatter, m *slog.Logger) (string, error) {
	var buf bytes.Buffer
	err := Render(&buf, g, opts, nf, ef, m)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// DefaultOptions returns sensible default options for rendering.
func DefaultOptions() RenderOptions {
	return RenderOptions{
		Direction:     "LR",
		ShowNodeIDs:   false,
		MaxLabelRunes: 48,
		IncludeLegend: false,
	}
}

// LoadInfraGraph reads a graph.json (same as frontend) from r.
func LoadInfraGraph(r io.Reader) (InfraGraph, error) {
	var g InfraGraph
	dec := json.NewDecoder(r)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&g); err != nil {
		return InfraGraph{}, err
	}
	// Normalize IDs
	for id, n := range g.Nodes {
		if n.ID == "" {
			n.ID = id
			g.Nodes[id] = n
		}
	}
	return g, nil
}

// ===== Internals =====

func writeDefaultClassDefs(buf *bytes.Buffer, opts RenderOptions) {
	// Default palettes. Support a "synthwave" theme (dark neon) and a
	// fallback minimal light theme. Callers may append ExtraClassDefs to
	// further customize visuals.
	buf.WriteString("  %% Node classes\n")
	theme := strings.ToLower(strings.TrimSpace(opts.Theme))
	if theme == "" {
		theme = "synthwave"
	}
	switch theme {
	case "synthwave", "cyberpunk", "neon":
		// Dark background friendly neon palette
		buf.WriteString("  classDef container fill:#0a0e27,stroke:#3a86ff,stroke-width:2px,color:#bfe3ff;\n")
		buf.WriteString("  classDef network   fill:#0a0e27,stroke:#ff006e,stroke-width:2px,color:#ffd1e3;\n")
		buf.WriteString("  classDef image     fill:#0a0e27,stroke:#8338ec,stroke-width:2px,color:#e0d0ff;\n")
		buf.WriteString("  classDef volume    fill:#0a0e27,stroke:#ffbe0b,stroke-width:2px,color:#fff3c4;\n")
		// Add some glow-like outline classes for emphasis
		buf.WriteString("  classDef highlight stroke:#00ffb3,stroke-width:3px;\n")
	default:
		// Minimal, accessible light palette
		buf.WriteString("  classDef container fill:#f0f8ff,stroke:#3a86ff,stroke-width:1px,color:#002a4e;\n")
		buf.WriteString("  classDef network   fill:#fff0f6,stroke:#ff006e,stroke-width:1px,color:#3a0020;\n")
		buf.WriteString("  classDef image     fill:#f8f0ff,stroke:#8338ec,stroke-width:1px,color:#2a004e;\n")
		buf.WriteString("  classDef volume    fill:#fffbe6,stroke:#ffbe0b,stroke-width:1px,color:#3a2a00;\n")
	}
}

// ... existing helpers follow

// Prefer Name; fall back to short id.
func shortPreferName(n Node) string {
	if n.Name != "" {
		return n.Name
	}
	return ShortID(n.ID)
}

var nonWord = regexp.MustCompile(`[^A-Za-z0-9_]+`)

func sanitizeID(s string) string {
	if s == "" {
		return "node"
	}
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, " ", "_")
	s = nonWord.ReplaceAllString(s, "_")
	if s[0] >= '0' && s[0] <= '9' {
		s = "n_" + s
	}
	return s
}

func esc(s string) string {
	if s == "" {
		return s
	}
	// Mermaid supports HTML like <br/>. Normalize newlines to <br/>.
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\n", "<br/>")
	// Escape Mermaid quotes/backticks minimally
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "`", "\\`")
	return s
}

func ShortID(id string) string {
	const n = 12
	if len(id) <= n {
		return id
	}
	return id[:n]
}

func truncateRunes(s string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(s) <= limit {
		return s
	}
	var b strings.Builder
	b.Grow(len(s))
	i := 0
	for _, r := range s {
		if i >= limit {
			break
		}
		b.WriteRune(r)
		i++
	}
	b.WriteString("…")
	return b.String()
}

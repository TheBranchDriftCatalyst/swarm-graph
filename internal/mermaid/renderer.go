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

	// Prepare Mermaid
	dir := strings.ToUpper(strings.TrimSpace(opts.Direction))
	if dir == "" {
		dir = "LR"
	}
	var buf bytes.Buffer
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
	if opts.IncludeLegend || true {
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
		IncludeLegend: true,
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
	// Synthwave-friendly default palette; override with ExtraClassDefs if needed.
	// Node class names match NodeKind values for simplicity.
	buf.WriteString("  %% Node classes\n")
	buf.WriteString("  classDef container fill:#0a0e27,stroke:#3a86ff,stroke-width:2px,color:#bfe3ff;\n")
	buf.WriteString("  classDef network   fill:#0a0e27,stroke:#ff006e,stroke-width:2px,color:#ffd1e3;\n")
	buf.WriteString("  classDef image     fill:#0a0e27,stroke:#8338ec,stroke-width:2px,color:#e0d0ff;\n")
	buf.WriteString("  classDef volume    fill:#0a0e27,stroke:#ffbe0b,stroke-width:2px,color:#fff3c4;\n")
}

func writeNodeLine(buf *bytes.Buffer, n Node, mid string, nf NodeFormatter, opts RenderOptions) {
	label := n.Name
	if nf != nil {
		l, _ := nf.FormatNode(n)
		if l != "" {
			label = l
		}
	}
	if label == "" {
		label = ShortID(n.ID)
	}
	if opts.ShowNodeIDs && !strings.Contains(label, ShortID(n.ID)) {
		label = label + " • " + ShortID(n.ID)
	}

	// vendor logo prefix
	var logoPrefix string
	if opts.VendorLogos != nil {
		if imgRef := n.Attributes["image"]; imgRef != "" {
			// derive key: last path element before tag/sha
			parts := strings.Split(imgRef, "/")
			last := parts[len(parts)-1]
			key := strings.Split(last, ":")[0]
			if url, ok := opts.VendorLogos[key]; ok {
				// escape URL then include as small img tag
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
	fmt.Fprintf(buf, "  %s[\"%s\"]\n", mid, full)
	// Assign class by kind
	kind := strings.ToLower(string(n.Kind))
	switch n.Kind {
	case NodeContainer, NodeNetwork, NodeImage, NodeVolume:
		fmt.Fprintf(buf, "  class %s %s;\n", mid, kind)
	default:
		// Unknown kinds will remain unstyled
	}
}

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

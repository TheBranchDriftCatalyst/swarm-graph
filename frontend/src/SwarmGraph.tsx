import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, EdgeKind, NodeKind } from './types';
import { colors, nodeIcons, styles } from './SwarmGraphStyles';

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  name: string;
  attributes: any;
}
interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  kind: EdgeKind;
  attributes?: any;
}

const SwarmGraph: React.FC<{ data: any }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<d3.Selection<SVGLineElement, D3Link, SVGGElement, unknown> | null>(null);
  const labelSelRef = useRef<d3.Selection<SVGTextElement, D3Link, SVGGElement, unknown> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Resize
  useEffect(() => {
    const onResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Initialize / rebuild ONLY when data or canvas size changes
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    const defs = svg.append('defs');
    const bgGradient = defs.append('linearGradient')
      .attr('id', 'bg-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    bgGradient.append('stop').attr('offset', '0%').style('stop-color', '#0A0E27');
    bgGradient.append('stop').attr('offset', '100%').style('stop-color', '#1A1E3A');

    ['container','network','image','volume'].forEach(nodeType => {
      const filter = defs.append('filter')
        .attr('id', `glow-${nodeType}`)
        .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#bg-gradient)');

    const grid = defs.append('pattern')
      .attr('id', 'grid').attr('width', 40).attr('height', 40).attr('patternUnits', 'userSpaceOnUse');
    grid.append('path')
      .attr('d', 'M 40 0 L 0 0 0 40')
      .attr('fill', 'none').attr('stroke', colors.grid as string).attr('stroke-width', '0.5').attr('opacity', '0.3');
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#grid)');

    const g = svg.append('g');
    gRef.current = g;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform as any));
    svg.call(zoom as any);
    zoomRef.current = zoom;

    const nodes: D3Node[] = Object.values(data.nodes).map((n: any) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));
    const links: D3Link[] = data.edges.map((e: any) => ({
      source: e.src, target: e.dst, kind: e.kind, attributes: e.attributes,
    }));

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => (colors.edge as any)[d.kind])
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .style('filter', 'drop-shadow(0 0 3px currentColor)');
    linkSelRef.current = link as any;

    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links.filter(l => l.attributes))
      .enter().append('text')
      .attr('font-size', '10px')
      .attr('fill', '#FFBE0B')
      .attr('text-anchor', 'middle')
      .style('text-shadow', '0 0 5px currentColor')
      .text(d => {
        if (d.kind === 'connected_to' && d.attributes?.ip) return d.attributes.ip;
        if (d.kind === 'mounted_into' && d.attributes?.target) return d.attributes.target;
        return '';
      });
    labelSelRef.current = linkLabel as any;

  const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .on('mouseenter', (_evt, d) => setHoveredNode(d.id))
      .on('mouseleave', () => setHoveredNode(null))
      .on('click', (_evt, d) => setSelectedNode(prev => (prev === d.id ? null : d.id)))
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', (event, d) => {
          if (!event.active && simRef.current) simRef.current.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active && simRef.current) simRef.current.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    node.append('circle')
      .attr('r', 25)
      .attr('fill', d => colors[d.kind] as string)
      .attr('fill-opacity', 0.2)
      .style('filter', d => `url(#glow-${d.kind})`);

    node.append('circle')
      .attr('r', 20)
      .attr('fill', 'none')
      .attr('stroke', d => colors[d.kind] as string)
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 0 5px currentColor)');

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '24px')
      .attr('fill', d => colors[d.kind] as string)
      .style('filter', 'drop-shadow(0 0 3px currentColor)')
      .text(d => nodeIcons[d.kind]);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 35)
      .attr('font-size', '12px')
      .attr('fill', '#FFFFFF')
      .style('text-shadow', '0 0 5px #FF006E, 0 0 10px #FF006E')
      .text(d => d.name);

    node.filter(d => d.kind === 'container')
      .append('circle')
      .attr('r', 5).attr('cx', 15).attr('cy', -15)
      .attr('fill', d => ((d.attributes || {}).status === 'running' ? '#00FF00' : '#FF0000'))
      .style('filter', 'drop-shadow(0 0 3px currentColor)');

    nodeSelRef.current = node as any;

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id)
        .distance(l => {
          switch (l.kind) {
            case 'derived_from': return 100;
            case 'connected_to': return 150;
            case 'mounted_into': return 120;
            default: return 110;
          }
        })
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!);

      linkLabel
        .attr('x', d => (((d.source as D3Node).x! + (d.target as D3Node).x!) / 2))
        .attr('y', d => (((d.source as D3Node).y! + (d.target as D3Node).y!) / 2));

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    const fitToView = () => {
      const group = g.node();
      if (!group) return;
      const bbox = (group as SVGGElement).getBBox();
      const padding = 80;
      const bboxW = Math.max(1, bbox.width + padding);
      const bboxH = Math.max(1, bbox.height + padding);
      const scale = Math.min(4, Math.max(0.1, Math.min(width / bboxW, height / bboxH)));
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      const tx = width / 2 - cx * scale;
      const ty = height / 2 - cy * scale;
      svg.transition().duration(600).call((zoom as any).transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };

    sim.on('end', fitToView);
    const fallback = setTimeout(fitToView, 1200);

    simRef.current = sim;

    return () => {
      clearTimeout(fallback);
      sim.stop();
    };
  }, [data, dimensions]); // <- intentionally minimal

  // Lightweight highlight updates — do NOT rebuild the graph
  useEffect(() => {
    const node = nodeSelRef.current;
    if (!node) return;

    // Stroke width for selected
    node
      .selectAll<SVGCircleElement, D3Node>('circle:nth-child(2)')
      .attr('stroke-width', function (_d, i, nodes) {
        const d = d3.select(nodes[i].parentNode as SVGGElement).datum() as D3Node;
        return d.id === selectedNode ? 4 : 2;
      });

    // Opacity on hover
    node.attr('opacity', function (_d, i, nodes) {
      const d = d3.select(nodes[i] as SVGGElement).datum() as D3Node;
      if (!hoveredNode) return 1;
      return d.id === hoveredNode ? 1 : 0.35;
    });
  }, [hoveredNode, selectedNode]);

  const getNodeInfo = (nodeId: string): GraphNode | undefined => {
    if (!data || !data.nodes) return undefined;
    // direct map lookup
    if (data.nodes[nodeId]) return data.nodes[nodeId];
    // fallback: search values for a matching id field (different datasets use id/ID/Id/Name/name)
    const vals = Object.values(data.nodes) as any[];
    return vals.find(n => (
      String(n.id) === String(nodeId) || String(n.ID) === String(nodeId) || String(n.Id) === String(nodeId)
      || String(n.Name) === String(nodeId) || String(n.name) === String(nodeId)
    ));
  };

  return (
    <div style={styles.container}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />

      {/* Legend (left) */}
      <div style={styles.legend}>
        <h3 style={styles.legendTitle}>DOCKER SWARM</h3>
        <div style={styles.legendList}>
          <div><span style={{ color: colors.container }}>{nodeIcons.container}</span> Container</div>
          <div><span style={{ color: colors.network }}>{nodeIcons.network}</span> Network</div>
          <div><span style={{ color: colors.image }}>{nodeIcons.image}</span> Image</div>
          <div><span style={{ color: colors.volume }}>{nodeIcons.volume}</span> Volume</div>
          <hr style={{ border: 0, borderTop: '1px solid #2b2f55', margin: '8px 0' }} />
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            <div><span style={{ color: (colors.edge as any).connected_to }}>—</span> connected_to</div>
            <div><span style={{ color: (colors.edge as any).mounted_into }}>—</span> mounted_into</div>
            <div><span style={{ color: (colors.edge as any).derived_from }}>—</span> derived_from</div>
          </div>
        </div>
      </div>

      {/* Data panel (right) */}
      {(hoveredNode || selectedNode) && (() => {
        const node = getNodeInfo(hoveredNode || selectedNode || '');
        if (!node) return null;
        return (
          <div style={styles.infoPanel}>
            <h3 style={{ margin: '0 0 10px 0', color: '#3A86FF', textShadow: '0 0 5px currentColor' }}>
              {node.name}
            </h3>
            <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
              <div><strong style={{ color: '#FFBE0B' }}>Type:</strong> {node.kind}</div>
              <div><strong style={{ color: '#FFBE0B' }}>ID:</strong> {String(node.id)?.substring(0, 12)}...</div>
              {node.attributes && Object.entries(node.attributes).map(([key, value]) => (
                <div key={key}>
                  <strong style={{ color: '#FFBE0B' }}>{key}:</strong> {String(value)}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Title (bottom center) */}
      <div style={styles.title}>
        INFRASTRUCTURE GRAPH
      </div>
    </div>
  );
};

export default SwarmGraph;

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  InfraGraphDTO, 
  GraphNode, 
  GraphEdge, 
  NodeKind, 
  EdgeKind,
  isContainerNode,
  isNetworkNode,
  isImageNode,
  isVolumeNode
} from './types';

// sample dataset removed - component uses live hook data


// Use the real hook from the app (returns arrays)
import useDockerGraph from './hooks/useDockerGraph'

// Helper: convert hook's arrays into map form like the sample dataset
function mapifyNodes(hookNodes: any[] | undefined) {
  if (!hookNodes || !hookNodes.length) return undefined
  const m: Record<string, any> = {}
  hookNodes.forEach(n => {
    const id = n.id || n.ID || n.Id || n.Name || n.name || String(Math.random())
    m[String(id)] = n
  })
  return m
}

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

const SwarmGraph: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const data = useDockerGraph();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Synthwave color palette
  const colors = {
    container: '#FF006E',  // Hot pink
    network: '#FFBE0B',    // Golden yellow
    image: '#FB5607',      // Orange flame
    volume: '#8338EC',     // Purple
    background: '#0A0E27',
    grid: '#1E2749',
    glow: '#3A86FF',
    text: '#F72585',
    edge: {
      derived_from: '#FF006E',
      connected_to: '#3A86FF',
      mounted_into: '#FFBE0B'
    }
  };

  const nodeIcons = {
    container: '⬢',  // Hexagon for containers
    network: '◈',    // Diamond for networks
    image: '◉',      // Circle for images
    volume: '▣'      // Square for volumes
  };

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    // Create background gradient
    const defs = svg.append('defs');
    
    const bgGradient = defs.append('linearGradient')
      .attr('id', 'bg-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');
    
    bgGradient.append('stop')
      .attr('offset', '0%')
      .style('stop-color', '#0A0E27');
    
    bgGradient.append('stop')
      .attr('offset', '100%')
      .style('stop-color', '#1A1E3A');

    // Add glow filters for nodes
    Object.keys(colors).forEach(nodeType => {
      if (nodeType === 'background' || nodeType === 'grid' || nodeType === 'glow' || nodeType === 'text' || nodeType === 'edge') return;
      
      const filter = defs.append('filter')
        .attr('id', `glow-${nodeType}`)
        .attr('x', '-50%').attr('y', '-50%')
        .attr('width', '200%').attr('height', '200%');
      
      filter.append('feGaussianBlur')
        .attr('stdDeviation', '4')
        .attr('result', 'coloredBlur');
      
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    // Background rect
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#bg-gradient)');

    // Grid pattern
    const gridPattern = defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', 40)
      .attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse');
    
    gridPattern.append('path')
      .attr('d', 'M 40 0 L 0 0 0 40')
      .attr('fill', 'none')
      .attr('stroke', colors.grid)
      .attr('stroke-width', '0.5')
      .attr('opacity', '0.3');

    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#grid)');

    // Convert data to D3 format
    const nodes: D3Node[] = Object.values(data.nodes).map(node => ({
      ...node,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200
    }));

    const links: D3Link[] = data.edges.map(edge => ({
      source: edge.src,
      target: edge.dst,
      kind: edge.kind,
      attributes: edge.attributes
    }));

    // Create simulation
    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id)
        .distance(d => {
          switch(d.kind) {
            case 'derived_from': return 100;
            case 'connected_to': return 150;
            case 'mounted_into': return 120;
            default: return 100;
          }
        }))
      // soften the charge so nodes don't fling off-screen
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Create container groups
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform as any);
      });

    svg.call(zoom as any);

    // Fit-to-view: compute bounding box of nodes and center/scale the group
    function fitToView() {
      try {
        const node = g.node();
        if (!node) { return; }
        const bbox = (node as SVGGElement).getBBox();
        const padding = 80;
        const bboxW = Math.max(1, bbox.width + padding);
        const bboxH = Math.max(1, bbox.height + padding);
        const scale = Math.min(4, Math.max(0.1, Math.min(width / bboxW, height / bboxH)));
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const tx = width / 2 - cx * scale;
        const ty = height / 2 - cy * scale;
        // apply transform on the svg via zoom
        svg.transition().duration(600).call((zoom as any).transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      } catch (e) {
        // fallback: no-op
        return;
      }
    }

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => colors.edge[d.kind as EdgeKind])
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .style('filter', 'drop-shadow(0 0 3px currentColor)');

    // Draw edge labels
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links.filter(l => l.attributes))
      .enter().append('text')
      .attr('font-size', '10px')
      .attr('fill', '#FFBE0B')
      .attr('text-anchor', 'middle')
      .style('text-shadow', '0 0 5px currentColor')
      .text(d => {
        if (d.kind === 'connected_to' && d.attributes?.ip) {
          return d.attributes.ip;
        }
        if (d.kind === 'mounted_into' && d.attributes?.target) {
          return d.attributes.target;
        }
        return '';
      });

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .on('mouseover', (event, d) => setHoveredNode(d.id))
      .on('mouseout', () => setHoveredNode(null))
      .on('click', (event, d) => setSelectedNode(d.id === selectedNode ? null : d.id))
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node backgrounds (glow effect)
    node.append('circle')
      .attr('r', 25)
      .attr('fill', d => colors[d.kind as NodeKind])
      .attr('fill-opacity', 0.2)
      .style('filter', d => `url(#glow-${d.kind})`);

    // Node circles
    node.append('circle')
      .attr('r', 20)
      .attr('fill', 'none')
      .attr('stroke', d => colors[d.kind as NodeKind])
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 0 5px currentColor)');

    // Node icons
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '24px')
      .attr('fill', d => colors[d.kind as NodeKind])
      .style('filter', 'drop-shadow(0 0 3px currentColor)')
      .text(d => nodeIcons[d.kind as NodeKind]);

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 35)
      .attr('font-size', '12px')
      .attr('fill', '#FFFFFF')
      .style('text-shadow', '0 0 5px #FF006E, 0 0 10px #FF006E')
      .text(d => d.name);

    // Status indicator for containers
    node.filter(d => d.kind === 'container')
      .append('circle')
      .attr('r', 5)
      .attr('cx', 15)
      .attr('cy', -15)
      .attr('fill', d => {
        const { status } = (d.attributes as any) || {};
        return status === 'running' ? '#00FF00' : '#FF0000';
      })
      .style('filter', 'drop-shadow(0 0 3px currentColor)');

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) { simulation.alphaTarget(0.3).restart(); }
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) { simulation.alphaTarget(0); }
      d.fx = null;
      d.fy = null;
    }

  // Update positions on tick
  simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!);

      linkLabel
        .attr('x', d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr('y', d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // When the simulation finishes (alpha cools) fit the view once.
    simulation.on('end', () => {
      fitToView();
    });

  // Fallback: if 'end' isn't reached for some reason, fit after 1s
  const fitTimeout = setTimeout(() => fitToView(), 1000);

    // Cleanup
    return () => {
      simulation.stop();
      clearTimeout(fitTimeout);
    };
  }, [data, dimensions, colors, selectedNode]);

  // Info panel
  const getNodeInfo = (nodeId: string): GraphNode | undefined => {
    return data?.nodes[nodeId];
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative',
      background: 'linear-gradient(to bottom, #0A0E27, #1A1E3A)',
      overflow: 'hidden',
      fontFamily: 'monospace'
    }}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(10, 14, 39, 0.8)',
        border: '1px solid #FF006E',
        borderRadius: '8px',
        padding: '15px',
        color: '#FFFFFF',
        boxShadow: '0 0 20px rgba(255, 0, 110, 0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#FF006E', textShadow: '0 0 5px currentColor' }}>DOCKER SWARM</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div><span style={{ color: colors.container }}>⬢</span> Container</div>
          <div><span style={{ color: colors.network }}>◈</span> Network</div>
          <div><span style={{ color: colors.image }}>◉</span> Image</div>
          <div><span style={{ color: colors.volume }}>▣</span> Volume</div>
        </div>
      </div>

      {/* Node info panel */}
      {(hoveredNode || selectedNode) && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(10, 14, 39, 0.9)',
          border: '1px solid #3A86FF',
          borderRadius: '8px',
          padding: '15px',
          color: '#FFFFFF',
          maxWidth: '300px',
          boxShadow: '0 0 20px rgba(58, 134, 255, 0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          {(() => {
            const node = getNodeInfo(hoveredNode || selectedNode || '');
            if (!node) { return null; }
            
            return (
              <>
                <h3 style={{ margin: '0 0 10px 0', color: '#3A86FF', textShadow: '0 0 5px currentColor' }}>
                  {node.name}
                </h3>
                <div style={{ fontSize: '12px' }}>
                  <div><strong style={{ color: '#FFBE0B' }}>Type:</strong> {node.kind}</div>
                  <div><strong style={{ color: '#FFBE0B' }}>ID:</strong> {node.id.substring(0, 12)}...</div>
                  {Object.entries(node.attributes).map(([key, value]) => (
                    <div key={key}>
                      <strong style={{ color: '#FFBE0B' }}>{key}:</strong> {String(value)}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Title */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '36px',
        fontWeight: 'bold',
        background: 'linear-gradient(90deg, #FF006E, #3A86FF, #FFBE0B)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 0 30px rgba(255, 0, 110, 0.5)',
        letterSpacing: '5px'
      }}>
        INFRASTRUCTURE GRAPH
      </div>
    </div>
  );
};

export default SwarmGraph;
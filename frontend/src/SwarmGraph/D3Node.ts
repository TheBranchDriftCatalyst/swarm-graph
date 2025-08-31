import * as d3 from 'd3';
import { colors, nodeIcons } from './SwarmGraphStyles';

export const drawNodes = (
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: any[],
  { setHoveredNode, setSelectedNode, selectedNode }: { setHoveredNode: (id: string | null) => void, setSelectedNode: any, selectedNode?: string | null }
) => {
  const node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .attr('cursor', 'pointer')
    .on('mouseenter', (_evt, d: any) => setHoveredNode(d.id))
    .on('mouseleave', (_evt, d: any) => {
      // keep details panel if this node is selected; otherwise clear hover
      if (selectedNode === d.id) return;
      setHoveredNode(null);
    })
    .on('click', (_evt, d: any) => setSelectedNode(d.id))
    .call(d3.drag<SVGGElement, any>()
      .on('start', (event, d) => { if (!event.active) event.subject.fx = event.x; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { d.fx = null; d.fy = null; })
    );

  node.append('circle').attr('r', 25).attr('fill', d => colors[d.kind]).attr('fill-opacity', 0.2);
  node.append('circle').attr('r', 20).attr('fill', 'none').attr('stroke', d => colors[d.kind]).attr('stroke-width', 2);
  node.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('font-size', '24px').attr('fill', d => colors[d.kind]).text(d => nodeIcons[d.kind]);
  node.append('text').attr('text-anchor', 'middle').attr('y', 35).attr('font-size', '12px')
    .attr('fill', '#FFF').text(d => d.name);

  return node;
};

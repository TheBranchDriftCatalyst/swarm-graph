import * as d3 from 'd3';
import { colors } from './SwarmGraphStyles';

export const drawEdges = (
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  links: any[],
) => {
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', d => (colors.edge as any)[d.kind])
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.6);
  return link;
};

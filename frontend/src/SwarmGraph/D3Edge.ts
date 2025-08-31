import * as d3 from 'd3'
import { colors } from './SwarmGraphStyles'
import { Logger } from './Logger'

export const drawEdges = (
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  links: any[]
) => {
  const edgeGroup = g.append('g').attr('class', 'links');
  const link = edgeGroup
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', (d) => (colors.edge as any)[d.kind])
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.6);

  // labels: ip / target / fallback to kind
  const labelGroup = g.append('g').attr('class', 'link-labels');
  const labels = labelGroup
    .selectAll('text')
    .data(links)
    .enter()
    .append('text')
    .attr('font-size', 10)
    .attr('fill', '#FFBE0B')
    .attr('text-anchor', 'middle')
    .style('text-shadow', '0 0 5px currentColor')
    .text((d: any) => {
      if (d.kind === 'connected_to' && d.attributes?.ip) return d.attributes.ip;
      if (d.kind === 'mounted_into' && d.attributes?.target) return d.attributes.target;
      return d.kind || '';
    });

  // log structured edges for debugging
  Logger.debug('edges.created', links.map(l => ({ src: l.source?.id || l.src, dst: l.target?.id || l.dst, kind: l.kind, attributes: l.attributes })));

  return { link, labels };
}

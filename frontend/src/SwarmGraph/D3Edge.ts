import * as d3 from 'd3'
import { colors } from './SwarmGraphStyles'
import { Logger } from './Logger'
import { EdgeKind } from '../types'

export const drawEdges = (
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  links: any[]
) => {
  // Create arrow markers for different edge types
  const defs = g.select('defs').empty() ? g.append('defs') : g.select('defs')
  
  Object.keys(colors.edge).forEach(edgeType => {
    const color = colors.edge[edgeType as keyof typeof colors.edge]
    
    // Standard arrowhead
    defs.append('marker')
      .attr('id', `arrow-${edgeType}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color)
  })

  const edgeGroup = g.append('g').attr('class', 'links')
  
  // Use simple straight lines instead of curves
  const link = edgeGroup
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', (d) => colors.edge[d.kind as keyof typeof colors.edge])
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.8)
    .attr('marker-end', (d) => `url(#arrow-${d.kind})`)

  // Simplified labels with better sizing
  const labelGroup = g.append('g').attr('class', 'link-labels')
  const labels = labelGroup
    .selectAll('g')
    .data(links.filter((d: any) => {
      // Only show labels for connections with meaningful info
      return (d.kind === 'connected_to' && d.attributes?.ip) || 
             (d.kind === 'mounted_into' && d.attributes?.target)
    }))
    .enter()
    .append('g')
    .attr('class', 'label-group')

  // Dynamic background sizing based on text content
  labels.each(function(d: any) {
    const g = d3.select(this)
    let text = ''
    
    if (d.kind === 'connected_to' && d.attributes?.ip) {
      text = d.attributes.ip.length > 12 ? d.attributes.ip.substring(0, 12) + '...' : d.attributes.ip
    } else if (d.kind === 'mounted_into' && d.attributes?.target) {
      text = d.attributes.target.length > 12 ? d.attributes.target.substring(0, 12) + '...' : d.attributes.target
    }
    
    const textWidth = text.length * 6 + 8 // Estimate width
    
    g.append('rect')
      .attr('x', -textWidth / 2)
      .attr('y', -8)
      .attr('width', textWidth)
      .attr('height', 16)
      .attr('rx', 4)
      .attr('fill', 'rgba(10, 14, 39, 0.95)')
      .attr('stroke', colors.edge[d.kind as keyof typeof colors.edge])
      .attr('stroke-width', 1)

    g.append('text')
      .attr('font-size', 10)
      .attr('fill', '#FFFFFF')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-weight', '500')
      .text(text)
  })

  // log structured edges for debugging
  Logger.debug('edges.created', links.map(l => ({ src: l.source?.id || l.src, dst: l.target?.id || l.dst, kind: l.kind, attributes: l.attributes })))

  return { link, labels }
}

import * as d3 from 'd3'
import { colors, nodeIcons } from './SwarmGraphStyles'
import { Logger } from './Logger'
import { NodeKind } from '../types'

export const drawNodes = (
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodes: any[],
  {
    setHoveredNode,
    setSelectedNode,
    selectedNode,
  }: {
    setHoveredNode: (id: string | null) => void
    setSelectedNode: any
    selectedNode?: string | null
  }
) => {
  const node = g
    .append('g')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('cursor', 'pointer')
    .on('mouseenter', function(_evt, d: any) {
      // Simple hover effect
      d3.select(this).select('.node-card')
        .transition()
        .duration(150)
        .attr('stroke-width', 3)
      
      setHoveredNode(d.id)
    })
    .on('mouseleave', function(_evt, d: any) {
      // Remove hover effect
      d3.select(this).select('.node-card')
        .transition()
        .duration(150)
        .attr('stroke-width', 2)
      
      // keep details panel if this node is selected; otherwise clear hover
      if (selectedNode === d.id) {
        return
      }
      setHoveredNode(null)
    })
    .on('click', (_evt, d: any) => setSelectedNode(d.id))
  // drag behavior is attached from the graph initializer so it can
  // control the simulation (alphaTarget) and keep the sim running
  // while user drags nodes. See D3Graph.ts for the drag handlers.
  // small mapping from common image names to logo URLs (customize as needed)
  const vendorLogos: Record<string, string> = {
    nginx: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nginx/nginx-original.svg',
    redis: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/redis/redis-original.svg',
    postgres: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/postgresql/postgresql-original.svg',
  }

  // card dimensions - increased for better visual hierarchy and less clutter
  const cardW = 200
  const cardH = 70
  const pad = 12
  const imgSize = 32

  // render as a rounded rect card with optional image + text
  node.append('rect')
    .attr('x', -cardW / 2)
    .attr('y', -cardH / 2)
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('width', cardW)
    .attr('height', cardH)
    .attr('fill', (d: any) => `url(#gradient-${d.kind})`)
    .attr('stroke', (d: any) => colors[d.kind] || '#888')
    .attr('stroke-width', 2)
    .attr('class', 'node-card')

  // Add gradient definitions for each node type (simplified)
  const defs = g.select('defs').empty() ? g.append('defs') : g.select('defs')
  Object.keys(colors).forEach(kind => {
    if (kind !== 'edge' && kind !== 'background' && kind !== 'grid' && kind !== 'glow' && kind !== 'text') {
      const gradient = defs.append('linearGradient')
        .attr('id', `gradient-${kind}`)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '100%')
      
      gradient.append('stop')
        .attr('offset', '0%')
        .style('stop-color', colors[kind])
        .style('stop-opacity', 0.1)
      
      gradient.append('stop')
        .attr('offset', '100%')
        .style('stop-color', colors[kind])
        .style('stop-opacity', 0.05)
    }
  })

  // image or icon
  node.each(function (d: any) {
    const g = d3.select(this)
    const imageRef = (d.attributes && d.attributes.image) || ''
    let logoUrl: string | undefined
    if (imageRef) {
      const parts = String(imageRef).split('/')
      const last = parts[parts.length - 1].split(':')[0]
      if (vendorLogos[last]) {
        logoUrl = vendorLogos[last]
      }
    }
    if (logoUrl) {
      g.append('image')
        .attr('href', logoUrl)
        .attr('x', -cardW / 2 + pad)
        .attr('y', -imgSize / 2)
        .attr('width', imgSize)
        .attr('height', imgSize)
        .attr('preserveAspectRatio', 'xMidYMid meet')
    } else {
      g.append('text')
        .attr('x', -cardW / 2 + pad + imgSize / 2)
        .attr('y', 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', 18)
        .attr('fill', (d: any) => colors[d.kind])
        .text((d: any) => nodeIcons[d.kind as NodeKind])
    }

    // name with better typography
    g.append('text')
      .attr('x', -cardW / 2 + pad + imgSize + 12)
      .attr('y', -8)
      .attr('text-anchor', 'start')
      .attr('font-size', 13)
      .attr('fill', '#FFFFFF')
      .attr('font-weight', '600')
      .text((d: any) => {
        const name = d.name || d.Name || d.id || ''
        return name.length > 18 ? name.substring(0, 18) + '...' : name
      })

    // status line with better styling
    const status = (d.attributes && d.attributes.status) || ''
    g.append('text')
      .attr('x', -cardW / 2 + pad + imgSize + 12)
      .attr('y', 10)
      .attr('text-anchor', 'start')
      .attr('font-size', 10)
      .attr('fill', status === 'running' ? '#7CFC00' : status === 'stopped' ? '#FF6B6B' : '#FFA500')
      .attr('font-weight', '500')
      .text(status.toUpperCase())

    // simple status indicator
    const statusColor = status === 'running' ? '#00FF66' : status === 'stopped' ? '#FF3B30' : '#FFA500'
    g.append('circle')
      .attr('cx', cardW / 2 - pad - 8)
      .attr('cy', -cardH / 2 + pad + 8)
      .attr('r', 4)
      .attr('fill', statusColor)
      .attr('opacity', 0.9)
    
    // simplified type indicator
    g.append('text')
      .attr('x', cardW / 2 - pad - 4)
      .attr('y', cardH / 2 - pad + 2)
      .attr('text-anchor', 'end')
      .attr('font-size', 9)
      .attr('fill', (d: any) => colors[d.kind])
      .attr('opacity', 0.6)
      .attr('font-weight', '500')
      .text((d: any) => d.kind.toUpperCase())
  })

  // structured log for nodes
  node.each(function(d: any) {
    Logger.debug('node.drawn', { id: d.id, kind: d.kind, name: d.name, attributes: d.attributes });
  });

  return node
}

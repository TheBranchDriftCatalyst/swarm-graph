import * as d3 from 'd3'
import { colors, nodeIcons } from './SwarmGraphStyles'
import { Logger } from './Logger';

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
    .on('mouseenter', (_evt, d: any) => setHoveredNode(d.id))
    .on('mouseleave', (_evt, d: any) => {
      // keep details panel if this node is selected; otherwise clear hover
      if (selectedNode === d.id) return
      setHoveredNode(null)
    })
    .on('click', (_evt, d: any) => setSelectedNode(d.id))
    .call(
      d3
        .drag<SVGGElement, any>()
        .on('start', (event, d) => {
          if (!event.active) event.subject.fx = event.x
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          d.fx = null
          d.fy = null
        })
    )
  // small mapping from common image names to logo URLs (customize as needed)
  const vendorLogos: Record<string, string> = {
    nginx: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nginx/nginx-original.svg',
    redis: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/redis/redis-original.svg',
    postgres: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/postgresql/postgresql-original.svg',
  }

  // card dimensions
  const cardW = 160
  const cardH = 52
  const pad = 8
  const imgSize = 28

  // render as a rounded rect card with optional image + text
  node.append('rect')
    .attr('x', -cardW / 2)
    .attr('y', -cardH / 2)
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('width', cardW)
    .attr('height', cardH)
    .attr('fill', (d: any) => colors[d.kind] || '#0b1220')
    .attr('fill-opacity', 0.06)
    .attr('stroke', (d: any) => colors[d.kind] || '#888')
    .attr('stroke-width', 1.5)
    .attr('class', 'node-card')

  // image or icon
  node.each(function (d: any) {
    const g = d3.select(this)
    const imageRef = (d.attributes && d.attributes.image) || ''
    let logoUrl: string | undefined
    if (imageRef) {
      const parts = String(imageRef).split('/')
      const last = parts[parts.length - 1].split(':')[0]
      if (vendorLogos[last]) logoUrl = vendorLogos[last]
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
        .attr('y', 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', 18)
        .attr('fill', (d: any) => colors[d.kind])
        .text((d: any) => nodeIcons[d.kind])
    }

    // name
    g.append('text')
      .attr('x', -cardW / 2 + pad + imgSize + 8)
      .attr('y', -6)
      .attr('text-anchor', 'start')
      .attr('font-size', 12)
      .attr('fill', '#FFF')
      .attr('font-weight', '600')
      .text((d: any) => d.name || d.Name || '')

    // status line
    const status = (d.attributes && d.attributes.status) || ''
    g.append('text')
      .attr('x', -cardW / 2 + pad + imgSize + 8)
      .attr('y', 14)
      .attr('text-anchor', 'start')
      .attr('font-size', 11)
      .attr('fill', status === 'running' ? '#7CFC00' : '#FF6B6B')
      .text(status)

    // small status dot on top-right
    g.append('circle')
      .attr('cx', cardW / 2 - pad - 6)
      .attr('cy', -cardH / 2 + pad + 6)
      .attr('r', 5)
      .attr('fill', status === 'running' ? '#00FF66' : '#FF3B30')
      .attr('opacity', 0.95)
  })

  // structured log for nodes
  node.each(function(d: any) {
    Logger.debug('node.drawn', { id: d.id, kind: d.kind, name: d.name, attributes: d.attributes });
  });

  return node
}

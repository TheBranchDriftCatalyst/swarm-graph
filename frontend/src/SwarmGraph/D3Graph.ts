import * as d3 from 'd3'
import { NodeKind, EdgeKind } from '../types'
import { colors, nodeIcons } from './SwarmGraphStyles'
import { drawNodes } from './D3Node'
import { drawEdges } from './D3Edge'
import { Logger } from './Logger'

interface Props {
  data: any
  svgRef: React.RefObject<SVGSVGElement>
  dimensions: { width: number; height: number }
  visibleNodes: Record<NodeKind, boolean>
  visibleEdges: Record<EdgeKind, boolean>
  setHoveredNode: (id: string | null) => void
  setSelectedNode: React.Dispatch<React.SetStateAction<string | null>>
  hoveredNode: string | null
  selectedNode: string | null
}

export const initGraph = ({
  data,
  svgRef,
  dimensions,
  visibleNodes,
  visibleEdges,
  setHoveredNode,
  setSelectedNode,
  selectedNode,
}: Props) => {
  const svg = d3.select(svgRef.current!)
  svg.selectAll('*').remove()

  const { width, height } = dimensions

  // background gradient + grid
  const defs = svg.append('defs')
  const bgGradient = defs
    .append('linearGradient')
    .attr('id', 'bg-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '100%')
    .attr('y2', '100%')
  bgGradient.append('stop').attr('offset', '0%').style('stop-color', '#0A0E27')
  bgGradient
    .append('stop')
    .attr('offset', '100%')
    .style('stop-color', '#1A1E3A')
  svg
    .append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'url(#bg-gradient)')

  const grid = defs
    .append('pattern')
    .attr('id', 'grid')
    .attr('width', 40)
    .attr('height', 40)
    .attr('patternUnits', 'userSpaceOnUse')
  grid
    .append('path')
    .attr('d', 'M 40 0 L 0 0 0 40')
    .attr('fill', 'none')
    .attr('stroke', colors.grid as string)
    .attr('stroke-width', '0.5')
    .attr('opacity', '0.3')
  svg
    .append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'url(#grid)')

  const g = svg.append('g')
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => g.attr('transform', event.transform as any))
  svg.call(zoom as any)

  // filter nodes
  const rawNodes = Object.values(data.nodes) as any[]
  const nodes = rawNodes.filter((n) => visibleNodes[n.kind as NodeKind])
  const rawLinks = data.edges as any[]
  const nodeMap: any = {}
  nodes.forEach((n: any) => {
    nodeMap[n.id] = n
  })
  const links = rawLinks
    .filter(
      (l: any) =>
        visibleEdges[l.kind as EdgeKind] && nodeMap[l.src] && nodeMap[l.dst]
    )
    .map((l: any) => ({ ...l, source: nodeMap[l.src], target: nodeMap[l.dst] }))

  const { link: linkSel, labels: labelSel } = drawEdges(g, links)
  const nodeSel = drawNodes(g, nodes, {
    setHoveredNode,
    setSelectedNode,
    selectedNode,
  })

  Logger.info('graph.init', { nodeCount: nodes.length, edgeCount: links.length })
  Logger.debug('nodes.created', nodes.map((n: any) => ({ id: n.id, kind: n.kind, name: n.name, attributes: n.attributes })))

  const sim = d3
    .forceSimulation(nodes as any)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d: any) => d.id)
        .distance(120)
    )
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(40))

  sim.on('tick', () => {
    linkSel
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
    // position labels at midpoints
    labelSel
      .attr('x', (d: any) => ((d.source.x + d.target.x) / 2))
      .attr('y', (d: any) => ((d.source.y + d.target.y) / 2))
    nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
  })

  return () => {
    sim.stop()
  }
}

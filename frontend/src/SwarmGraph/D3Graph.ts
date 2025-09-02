import * as d3 from 'd3'
// allow runtime `require` usage in this frontend TS file
declare const require: any
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

  // background gradient + grid with enhanced styling
  const defs = svg.append('defs')
  
  // Enhanced background gradient
  const bgGradient = defs
    .append('radialGradient')
    .attr('id', 'bg-gradient')
    .attr('cx', '50%')
    .attr('cy', '50%')
    .attr('r', '70%')
  bgGradient.append('stop').attr('offset', '0%').style('stop-color', '#1A1E3A')
  bgGradient.append('stop').attr('offset', '50%').style('stop-color', '#0A0E27')
  bgGradient.append('stop').attr('offset', '100%').style('stop-color', '#050817')
  
  svg
    .append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'url(#bg-gradient)')

  // More sophisticated grid pattern
  const grid = defs
    .append('pattern')
    .attr('id', 'grid')
    .attr('width', 60)
    .attr('height', 60)
    .attr('patternUnits', 'userSpaceOnUse')
  
  // Dot grid instead of lines for a more modern look
  grid
    .append('circle')
    .attr('cx', 30)
    .attr('cy', 30)
    .attr('r', 1)
    .attr('fill', colors.grid as string)
    .attr('opacity', '0.4')
  
  grid
    .append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 0.5)
    .attr('fill', colors.grid as string)
    .attr('opacity', '0.2')
    
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
  // compute dagre layout to get a Mermaid-like layered flow
  try {
    // load dagre at runtime to avoid compile-time type issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dagreLib: any = typeof require !== 'undefined' ? require('dagre') : (window as any).dagre
    const gDag = new dagreLib.graphlib.Graph({ compound: false })
    gDag.setGraph({ 
      rankdir: 'LR', 
      nodesep: 120, 
      ranksep: 180,
      marginx: 60,
      marginy: 60
    })
    gDag.setDefaultEdgeLabel(() => ({}))
    // set node sizes to match our card dims with padding
    const cardW = 200
    const cardH = 70
    nodes.forEach((n: any) => {
      gDag.setNode(n.id, { width: cardW, height: cardH })
    })
    links.forEach((l: any) => gDag.setEdge(l.source.id || l.src, l.target.id || l.dst))
    dagreLib.layout(gDag)
    
    // apply dagre positions to nodes with centering offset
    const graphBounds = gDag.graph()
    const offsetX = (width - graphBounds.width) / 2
    const offsetY = (height - graphBounds.height) / 2
    
    nodes.forEach((n: any) => {
      const dn = gDag.node(n.id)
      if (dn) {
        n.x = dn.x + offsetX
        n.y = dn.y + offsetY
        // Fix positions from dagre layout to prevent overlap
        n.fx = n.x
        n.fy = n.y
      }
    })
  } catch (e) {
    // layout failed, fall back to force-only
    Logger.warn('dagre.layout.failed', { message: String(e) })
  }

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
        .distance((d: any) => {
          switch (d.kind) {
          case 'derived_from': return 200
          case 'connected_to': return 250
          case 'mounted_into': return 200
          default: return 200
          }
        })
        .strength(0.1)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('collision', d3.forceCollide().radius(120))
    .alphaDecay(0.1)
    .alpha(0.1)

  sim.on('tick', () => {
    // Use straight lines instead of curves for cleaner appearance
    linkSel
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
    
    // Position label groups at midpoints
    labelSel
      .attr('transform', (d: any) => {
        const midX = (d.source.x + d.target.x) / 2
        const midY = (d.source.y + d.target.y) / 2
        return `translate(${midX}, ${midY})`
      })
    
    nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
  })

  // Attach drag behavior to nodes here so the simulation can be
  // warmed up while dragging and then decay again. This prevents
  // nodes from becoming permanently fixed when the sim cools.
  const drag = d3.drag<SVGGElement, any>()
    .on('start', (event, d: any) => {
      if (!event.active) {
        sim.alphaTarget(0.3).restart()
      }
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', (event, d: any) => {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', (event, d: any) => {
      // lower the alpha target and let the sim settle
      if (!event.active) {
        sim.alphaTarget(0)
      }
      // clear fixed position so node can continue to be simulated
      d.fx = null
      d.fy = null
    })

  nodeSel.call(drag as any)

  return () => {
    sim.stop()
  }
}

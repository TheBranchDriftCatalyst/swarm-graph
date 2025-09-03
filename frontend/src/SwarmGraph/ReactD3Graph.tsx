import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import ReactD3Node, { getNodeDimensions } from './ReactD3Node'
import ReactD3Edge from './ReactD3Edge'
import { colors } from './SwarmGraphStyles'
import { NodeKind, EdgeKind } from '../types'
import { NodeData, EdgeData, ReactD3GraphProps } from './interfaces'
import { Logger } from './Logger'

const ReactD3Graph: React.FC<ReactD3GraphProps> = ({
  data,
  dimensions,
  visibleNodes,
  visibleEdges,
  setHoveredNode,
  setSelectedNode,
  hoveredNode,
  selectedNode,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomLayerRef = useRef<SVGGElement>(null)
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [edges, setEdges] = useState<EdgeData[]>([])
  const [zoomScale, setZoomScale] = useState<number>(1)
  const simulationRef = useRef<d3.Simulation<NodeData, undefined> | null>(null)

  // Initialize graph data and simulation
  useEffect(() => {
    if (!data || !svgRef.current) {
      return
    }

    const { width, height } = dimensions

    // Filter nodes and edges based on visibility
    const rawNodes = Object.values(data.nodes) as NodeData[]
    const filteredNodes = rawNodes.filter((n) => visibleNodes[n.kind])

    const rawLinks = data.edges as any[]
    const nodeMap: Record<string, NodeData> = {}
    filteredNodes.forEach((n) => {
      nodeMap[n.id] = n
    })

    const filteredLinks = rawLinks
      .filter(
        (l: any) =>
          visibleEdges[l.kind as EdgeKind] && nodeMap[l.src] && nodeMap[l.dst]
      )
      .map((l: any) => ({
        ...l,
        source: nodeMap[l.src],
        target: nodeMap[l.dst],
      }))

    // Apply Dagre layout for initial positioning
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dagreLib: any = (window as any).dagre
      if (dagreLib) {
        const gDag = new dagreLib.graphlib.Graph({ compound: false })
        gDag.setGraph({
          rankdir: 'LR',
          nodesep: 120,
          ranksep: 180,
          marginx: 60,
          marginy: 60,
        })
        gDag.setDefaultEdgeLabel(() => ({}))

        // Set dynamic node sizes for Dagre
        filteredNodes.forEach((n) => {
          const { width: nodeWidth, height: nodeHeight } = getNodeDimensions(n)
          gDag.setNode(n.id, { width: nodeWidth, height: nodeHeight })
        })

        filteredLinks.forEach((l: any) =>
          gDag.setEdge(l.source.id || l.src, l.target.id || l.dst)
        )

        dagreLib.layout(gDag)

        // Apply positions with centering
        const graphBounds = gDag.graph()
        const offsetX = (width - graphBounds.width) / 2
        const offsetY = (height - graphBounds.height) / 2

        filteredNodes.forEach((n) => {
          const dn = gDag.node(n.id)
          if (dn) {
            n.x = dn.x + offsetX
            n.y = dn.y + offsetY
            n.fx = n.x
            n.fy = n.y
          }
        })
      }
    } catch (e) {
      Logger.warn('dagre.layout.failed', { message: String(e) })
    }

    // Set up D3 force simulation
    const simulation = d3
      .forceSimulation(filteredNodes)
      .force(
        'link',
        d3
          .forceLink(filteredLinks)
          .id((d: any) => d.id)
          .distance((d: any) => {
            switch (d.kind) {
              case 'derived_from':
                return 200
              case 'connected_to':
                return 250
              case 'mounted_into':
                return 200
              default:
                return 200
            }
          })
          .strength(0.1)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide().radius(120))
      .alphaDecay(0.1)
      .alpha(0.1)

    simulation.on('tick', () => {
      setNodes([...filteredNodes])
      setEdges([...filteredLinks])
    })

    simulationRef.current = simulation
    setNodes(filteredNodes)
    setEdges(filteredLinks)

    Logger.info('react-graph.init', {
      nodeCount: filteredNodes.length,
      edgeCount: filteredLinks.length,
    })

    return () => {
      simulation.stop()
    }
  }, [data, dimensions, visibleNodes, visibleEdges])

  // Drag handlers (stop propagation so zoom/pan doesn't also react)
  const handleDragStart = (node: NodeData) => (event: any) => {
    // Prevent zoom from reacting to the same pointer event
    try {
      event?.sourceEvent?.stopPropagation()
    } catch (e) {}
    if (!simulationRef.current) {
      return
    }
    if (!event.active) {
      simulationRef.current.alphaTarget(0.3).restart()
    }
    node.fx = node.x
    node.fy = node.y
  }

  const handleDrag = (node: NodeData) => (event: any) => {
    try {
      event?.sourceEvent?.stopPropagation()
    } catch (e) {}
    node.fx = event.x
    node.fy = event.y
  }

  const handleDragEnd = (node: NodeData) => (event: any) => {
    try {
      event?.sourceEvent?.stopPropagation()
    } catch (e) {}
    if (!simulationRef.current) {
      return
    }
    if (!event.active) {
      simulationRef.current.alphaTarget(0)
    }
    node.fx = null
    node.fy = null
  }

  // Zoom / pan setup
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) {
      return
    }
    const svg = d3.select(svgRef.current)
    const zoomLayer = d3.select(zoomLayerRef.current)

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform.toString())
        // Keep current scale in React state for nodes to react to
        try {
          setZoomScale(event.transform.k)
        } catch (e) {}
      })

    svg.call(zoom as any)

    // Reset transform when dimensions change to keep view consistent
    zoom.transform(svg.transition().duration(0) as any, d3.zoomIdentity)

    return () => {
      svg.on('.zoom', null)
    }
  }, [dimensions.width, dimensions.height])

  // Node event handlers
  const handleNodeMouseEnter = (nodeId: string) => () => {
    setHoveredNode(nodeId)
  }

  const handleNodeMouseLeave = (nodeId: string) => () => {
    if (selectedNode === nodeId) {
      return
    }
    setHoveredNode(null)
  }

  const handleNodeClick = (nodeId: string) => () => {
    setSelectedNode(nodeId)
  }

  return (
    <svg ref={svgRef} width={dimensions.width} height={dimensions.height}>
      {/* Background and gradients */}
      <defs>
        {/* Background gradient */}
        <radialGradient id="bg-gradient" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#1A1E3A" />
          <stop offset="50%" stopColor="#0A0E27" />
          <stop offset="100%" stopColor="#050817" />
        </radialGradient>

        {/* Grid pattern */}
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="1" fill={colors.grid} opacity="0.4" />
          <circle cx="0" cy="0" r="0.5" fill={colors.grid} opacity="0.2" />
        </pattern>

        {/* Node gradients */}
        {Object.keys(colors).map((kind) => {
          if (
            kind === 'edge' ||
            kind === 'background' ||
            kind === 'grid' ||
            kind === 'glow' ||
            kind === 'text'
          ) {
            return null
          }
          return (
            <linearGradient
              key={kind}
              id={`gradient-${kind}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={colors[kind]} stopOpacity="0.1" />
              <stop offset="100%" stopColor={colors[kind]} stopOpacity="0.05" />
            </linearGradient>
          )
        })}

  {/* Arrow markers for edges */}
        {Object.keys(colors.edge).map((edgeType) => {
          const color = colors.edge[edgeType as EdgeKind]
          return (
            <marker
              key={edgeType}
              id={`arrow-${edgeType}`}
              viewBox="0 -5 10 10"
              refX={8}
              refY={0}
              markerWidth={6}
              markerHeight={6}
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill={color} />
            </marker>
          )
        })}
      </defs>

      {/* Glow/drop-shadow filter used for hovered/selected nodes */}
      <defs>
        <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3A86FF" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Background */}
      <rect
        width={dimensions.width}
        height={dimensions.height}
        fill="url(#bg-gradient)"
      />
      <rect
        width={dimensions.width}
        height={dimensions.height}
        fill="url(#grid)"
      />

      {/* Zoomable layer (pan/zoom applied here) */}
      <g ref={zoomLayerRef} className="zoom-layer">
        {/* Edges */}
        <g className="edges">
          {edges.map((edge, index) => (
            <ReactD3Edge
              key={`${edge.src}-${edge.dst}-${index}`}
              data={edge}
              isDimmed={
                Boolean(
                  hoveredNode &&
                    hoveredNode !== edge.source.id &&
                    hoveredNode !== edge.target.id &&
                    selectedNode !== edge.source.id &&
                    selectedNode !== edge.target.id
                )
              }
            />
          ))}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map((node) => (
            <ReactD3Node
              key={node.id}
              data={node}
              isSelected={selectedNode === node.id}
              isHovered={hoveredNode === node.id}
              zoom={zoomScale}
              isDimmed={Boolean(hoveredNode && hoveredNode !== node.id && selectedNode !== node.id)}
              onMouseEnter={handleNodeMouseEnter(node.id)}
              onMouseLeave={handleNodeMouseLeave(node.id)}
              onClick={handleNodeClick(node.id)}
              onDragStart={handleDragStart(node)}
              onDrag={handleDrag(node)}
              onDragEnd={handleDragEnd(node)}
            />
          ))}
        </g>
      </g>
    </svg>
  )
}

export default ReactD3Graph

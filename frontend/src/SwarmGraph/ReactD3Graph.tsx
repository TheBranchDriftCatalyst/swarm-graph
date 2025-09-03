import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import ReactD3Node, { getNodeDimensions } from './ReactD3Node'
import ReactD3Edge from './ReactD3Edge'
import { colors } from './SwarmGraphStyles'
import { NodeKind, EdgeKind } from '../types'
import { NodeData, EdgeData, ReactD3GraphProps } from './interfaces'
import { enrichGraph, NodeWithHelpers, EdgeWithHelpers } from './utils/GraphNavigator'
import { useGraphState } from './hooks/useGraphState'
import { applyStructuredLayout } from './utils/layouts'
import { Logger } from '../utils'

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
  const [nodes, setNodes] = useState<NodeWithHelpers[] | NodeData[]>([])
  const [edges, setEdges] = useState<EdgeWithHelpers[] | EdgeData[]>([])
  const [zoomScale, setZoomScale] = useState<number>(1)
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null)
  const chargeForceRef = useRef<any>(null)
  const prevNodeCountRef = useRef<number>(0)

  // Initialize graph data and simulation
  const { layout, orthogonalEdges } = useGraphState()

  useEffect(() => {
  if (!data || !svgRef.current) { 
      return
    }

    const { width, height } = dimensions
  // Enrich graph data with navigation helpers and then filter
    const enriched = enrichGraph(data)

    // Convert enriched map into arrays and apply visibility filters
    const allNodes = Object.values(enriched.nodes) as NodeWithHelpers[]
    const filteredNodes = allNodes.filter((n) => visibleNodes[n.kind])

    const rawLinks = enriched.edges as EdgeWithHelpers[]
    const filteredLinks = rawLinks.filter(
      (l) => visibleEdges[l.kind as EdgeKind] && l.source && l.target
    )

    // Apply structured or force layout according to context `layout`.
    if (layout === 'structured') {
      try {
        applyStructuredLayout(filteredNodes as any, { width, height })
      } catch (e) {
        // fallthrough
      }
    }
    if (layout === 'force') {
      // release fixed positions for force layout
      filteredNodes.forEach((n) => {
        n.fx = null
        n.fy = null
      })
    }

  // Apply Dagre layout for initial positioning only when using structured layout
  if (layout === 'structured') {
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
      // For structured layout, do not start the force simulation. Leave nodes fixed at Dagre positions.
      setNodes(filteredNodes)
      setEdges(filteredLinks)
      Logger.info('react-graph.init', {
        nodeCount: filteredNodes.length,
        edgeCount: filteredLinks.length,
        layout: 'structured',
      })
      // No simulation to stop; return early from effect cleanup
      return () => {}
    }

    // Set up D3 force simulation (tuned for larger graphs) for force layout
    const simulation = d3.forceSimulation(filteredNodes)
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
          // slightly lower strength so links don't overpower layout
          .strength(0.08)
      )
      // Reduce charge magnitude so nodes don't push too far apart and create a less "bouncy" layout
      .force('charge', d3.forceManyBody().strength(-80))
      // Smaller collision radius to allow tighter packing when needed
      .force('collision', d3.forceCollide().radius(60))
      // slower decay so layout stabilizes smoothly for larger graphs
      .alphaDecay(0.05)
      .alpha(0.2)

    simulation.on('tick', () => {
      setNodes([...filteredNodes])
      setEdges([...filteredLinks])
    })

    // capture the many-body (charge) force so we can tweak it later for rebalancing
    try {
      const f = (simulation.force as any) ? (simulation.force as any)('charge') : null
      if (f) {
        chargeForceRef.current = f
      }
    } catch (e) {}

    // If node count increased, temporarily increase repulsion and reheat the simulation
    const prevCount = prevNodeCountRef.current || 0
    const newCount = filteredNodes.length
    if (newCount > prevCount && simulationRef.current) {
      try {
        // bump charge strength proportional to growth
        const boost = Math.min(3, Math.max(1.2, newCount / Math.max(1, prevCount || 1)))
        if (chargeForceRef.current && typeof chargeForceRef.current.strength === 'function') {
          // current strength is negative (repulsive); multiply magnitude
          const current = -80
          chargeForceRef.current.strength(-Math.abs(current * boost))
        }
        // reheat simulation
        simulation.alpha(0.6)
        simulation.restart()
        // decay back after a short timeout
        setTimeout(() => {
          if (chargeForceRef.current && typeof chargeForceRef.current.strength === 'function') {
            chargeForceRef.current.strength(-80)
          }
        }, 1200)
      } catch (e) {}
    }
    prevNodeCountRef.current = newCount

    simulationRef.current = simulation
    setNodes(filteredNodes)
    setEdges(filteredLinks)

    Logger.info('react-graph.init', {
      nodeCount: filteredNodes.length,
      edgeCount: filteredLinks.length,
      layout: 'force',
    })

    return () => {
      simulation.stop()
    }
  }, [data, dimensions, visibleNodes, visibleEdges, layout])

  // Drag handlers (stop propagation so zoom/pan doesn't also react)
  const handleDragStart = (node: NodeData) => (event: any) => {
    // Prevent zoom from reacting to the same pointer event
    try {
      event?.sourceEvent?.stopPropagation()
    } catch (e) {}
    
    // In structured layout, just set the node position without simulation
    if (layout === 'structured') {
      node.fx = node.x
      node.fy = node.y
      return
    }
    
    // Force layout: interact with simulation
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
    
    // Update node position directly (works for both layouts)
    node.fx = event.x
    node.fy = event.y
    
    // In structured layout, also update the regular position so it renders immediately
    if (layout === 'structured') {
      node.x = event.x
      node.y = event.y
      // Trigger a re-render to show the updated position
      setNodes([...nodes])
    }
  }

  const handleDragEnd = (node: NodeData) => (event: any) => {
    try {
      event?.sourceEvent?.stopPropagation()
    } catch (e) {}
    
    // In structured layout, just finalize the position
    if (layout === 'structured') {
      node.fx = node.x
      node.fy = node.y
      return
    }
    
    // Force layout: interact with simulation
    if (!simulationRef.current) {
      return
    }
    if (!event.active) {
      simulationRef.current.alphaTarget(0)
    }
    // Make the node sticky at its new position so user moves persist
    node.fx = node.x
    node.fy = node.y
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
    .scaleExtent([0.25, 8])
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
    if (selectedNode === nodeId) {
      setSelectedNode(null)
    } else {
      setSelectedNode(nodeId)
    }
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

        {/* Arrow markers for edges - commented out since we removed arrows */}
        {/*
        {Object.keys(colors.edge).map((edgeType) => {
          const color = colors.edge[edgeType as EdgeKind]
          return (
            <marker
              key={edgeType}
              id={`arrow-${edgeType}`}
              viewBox="0 -5 10 10"
              refX={10}
              refY={0}
              markerWidth={6}
              markerHeight={6}
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill={color} />
            </marker>
          )
        })}
        */}
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
  onClick={() => setSelectedNode(null)}
      />
      <rect
        width={dimensions.width}
        height={dimensions.height}
        fill="url(#grid)"
  onClick={() => setSelectedNode(null)}
      />

      {/* Zoomable layer (pan/zoom applied here) */}
      <g ref={zoomLayerRef} className="zoom-layer">
        {/* Edges */}
        <g className="edges">
          {edges.map((edge, index) => (
            <ReactD3Edge
              key={`${edge.src}-${edge.dst}-${index}`}
              data={edge}
              zoom={zoomScale}
              orthogonal={orthogonalEdges}
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
              onDoubleClick={() => {
                // release stickiness
                try {
                  node.fx = null
                  node.fy = null
                } catch (e) {}
              }}
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

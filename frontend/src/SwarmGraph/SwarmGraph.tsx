import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { GraphNode, NodeKind, EdgeKind } from './types'
import { styles } from './SwarmGraphStyles'
import Legend from './Legend'
import NodeDetails from './NodeDetails'
import Title from './Title'
import { initGraph } from './D3Graph'

const SwarmGraph: React.FC<{ data: any }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const [visibleNodes, setVisibleNodes] = useState<Record<NodeKind, boolean>>({
    container: true,
    network: true,
    image: true,
    volume: true,
  })
  const [visibleEdges, setVisibleEdges] = useState<Record<EdgeKind, boolean>>({
    derived_from: true,
    connected_to: true,
    mounted_into: true,
  })

  // Resize
  useEffect(() => {
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Graph init
  useEffect(() => {
    if (!data || !svgRef.current) return
    const cleanup = initGraph({
      data,
      svgRef,
      dimensions,
      visibleNodes,
      visibleEdges,
      setHoveredNode,
      setSelectedNode,
      hoveredNode,
      selectedNode,
    })
    return cleanup
  }, [data, dimensions, visibleNodes, visibleEdges])

  // Lookup function
  const getNodeInfo = (nodeId: string): GraphNode | undefined => {
    if (!data || !data.nodes) return undefined
    if (data.nodes[nodeId]) return data.nodes[nodeId]
    return Object.values(data.nodes).find((n: any) =>
      [n.id, n.ID, n.Id, n.Name, n.name].some(
        (v) => String(v) === String(nodeId)
      )
    ) as GraphNode | undefined
  }

  return (
    <div style={styles.container}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      <Legend
        {...{ visibleNodes, setVisibleNodes, visibleEdges, setVisibleEdges }}
      />
      <NodeDetails node={getNodeInfo(hoveredNode || selectedNode || '')} />
      <Title />
    </div>
  )
}

export default SwarmGraph

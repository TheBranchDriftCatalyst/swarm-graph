import React, { useState } from 'react'
import { GraphNode, NodeKind, EdgeKind } from '../types'
import { styles } from './SwarmGraphStyles'
import Legend from './Legend'
import NodeDetails from './NodeDetails'
import Title from './Title'
import ReactD3Graph from './ReactD3Graph'

const SwarmGraph: React.FC<{ data: any }> = ({ data }) => {
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

  // Resize handler
  React.useEffect(() => {
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Lookup function
  const getNodeInfo = (nodeId: string): GraphNode | undefined => {
    if (!data || !data.nodes) {
      return undefined
    }
    if (data.nodes[nodeId]) {
      return data.nodes[nodeId]
    }
    return Object.values(data.nodes).find((n: any) =>
      [n.id, n.ID, n.Id, n.Name, n.name].some(
        (v) => String(v) === String(nodeId)
      )
    ) as GraphNode | undefined
  }

  return (
    <div style={styles.container}>
      <ReactD3Graph
        data={data}
        dimensions={dimensions}
        visibleNodes={visibleNodes}
        visibleEdges={visibleEdges}
        setHoveredNode={setHoveredNode}
        setSelectedNode={setSelectedNode}
        hoveredNode={hoveredNode}
        selectedNode={selectedNode}
      />
      <Legend
        {...{ visibleNodes, setVisibleNodes, visibleEdges, setVisibleEdges }}
      />
      <NodeDetails node={getNodeInfo(hoveredNode || selectedNode || '')} />
      <Title />
    </div>
  )
}

export default SwarmGraph

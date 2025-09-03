import { useEffect } from 'react'
import { useGraphContext } from '../context/GraphContext'
import { GraphData } from '../interfaces'

export const useGraphState = () => {
  const { state, dispatch } = useGraphContext()

  // Set raw data
  const setRawData = (data: GraphData) => {
    dispatch({ type: 'SET_RAW_DATA', payload: data })
  }

  // Node selection handlers
  const setHoveredNode = (nodeId: string | null) => {
    dispatch({ type: 'SET_HOVERED_NODE', payload: nodeId })
  }

  const setSelectedNode = (nodeId: string | null) => {
    dispatch({ type: 'SET_SELECTED_NODE', payload: nodeId })
  }

  // Dimensions handler
  const setDimensions = (dimensions: { width: number; height: number }) => {
    dispatch({ type: 'SET_DIMENSIONS', payload: dimensions })
  }

  // Layout handler
  const setLayout = (layout: 'force' | 'structured') => {
    dispatch({ type: 'SET_LAYOUT', payload: layout })
  }

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ 
        width: window.innerWidth, 
        height: window.innerHeight 
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Lookup function for node info
  const getNodeInfo = (nodeId: string | null) => {
    if (!nodeId || !state.filteredData?.nodes) {
      return undefined
    }

    const node = state.filteredData.nodes[nodeId]
    if (node) {
      return node
    }

    // Fallback: search by various ID fields
    return Object.values(state.filteredData.nodes).find((n: any) =>
      [n.id, n.ID, n.Id, n.Name, n.name].some(
        (v) => String(v) === String(nodeId)
      )
    )
  }

  return {
    // State
    rawData: state.rawData,
    filteredData: state.filteredData,
    hoveredNode: state.hoveredNode,
    selectedNode: state.selectedNode,
    dimensions: state.dimensions,
  layout: state.layout,
    filters: state.filters,

    // Actions
    setRawData,
    setHoveredNode,
    setSelectedNode,
    setDimensions,
  setLayout,

    // Helpers
    getNodeInfo,
  }
}

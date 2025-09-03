import { useEffect, useCallback } from 'react'
import { useGraphContext } from '../context/GraphContext'
import { GraphData } from '../interfaces'

export const useGraphState = () => {
  const { state, dispatch } = useGraphContext()

  // Set raw data
  const setRawData = useCallback((data: GraphData) => {
    dispatch({ type: 'SET_RAW_DATA', payload: data })
  }, [dispatch])

  // Node selection handlers
  const setHoveredNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SET_HOVERED_NODE', payload: nodeId })
  }, [dispatch])

  const setSelectedNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SET_SELECTED_NODE', payload: nodeId })
  }, [dispatch])

  // Dimensions handler
  const setDimensions = useCallback((dimensions: { width: number; height: number }) => {
    dispatch({ type: 'SET_DIMENSIONS', payload: dimensions })
  }, [dispatch])

  // Layout handler
  const setLayout = useCallback((layout: 'force' | 'structured') => {
    dispatch({ type: 'SET_LAYOUT', payload: layout })
  }, [dispatch])

  // Orthogonal edges toggle
  const toggleOrthogonalEdges = useCallback(() => {
    dispatch({ type: 'TOGGLE_ORTHOGONAL_EDGES' })
  }, [dispatch])

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
  }, [setDimensions])

  // Lookup function for node info
  const getNodeInfo = useCallback((nodeId: string | null) => {
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
  }, [state.filteredData])

  return {
    // State
    rawData: state.rawData,
    filteredData: state.filteredData,
    hoveredNode: state.hoveredNode,
    selectedNode: state.selectedNode,
    dimensions: state.dimensions,
  layout: state.layout,
    orthogonalEdges: state.orthogonalEdges,
    filters: state.filters,

    // Actions
    setRawData,
    setHoveredNode,
    setSelectedNode,
    setDimensions,
  setLayout,
    toggleOrthogonalEdges,

    // Helpers
    getNodeInfo,
  }
}

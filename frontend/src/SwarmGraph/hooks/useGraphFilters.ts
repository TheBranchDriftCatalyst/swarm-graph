import { useEffect, useMemo } from 'react'
import { useGraphContext } from '../context/GraphContext'
import { GraphData, NodeData, EdgeData } from '../interfaces'
import { GraphNode, NodeKind, EdgeKind, isContainerNode, isVolumeNode, isNetworkNode, isImageNode } from '../../types'
import { GraphFilters, NodeStatusFilter, NodeConnectionFilter } from '../types/filterTypes'

export const useGraphFilters = () => {
  const { state, dispatch } = useGraphContext()

  // Helper function to check if a node is orphaned (no edges)
  const isOrphanedNode = (nodeId: string, edges: EdgeData[]): boolean => {
    return !edges.some(edge => edge.src === nodeId || edge.dst === nodeId)
  }

  // Helper function to check if a node matches status filter
  const matchesStatusFilter = (node: NodeData, filter: NodeStatusFilter): boolean => {
    if (filter === 'all') {
      return true
    }

    const status = node.attributes?.status?.toLowerCase()
    
    switch (filter) {
      case 'running':
        return status === 'running'
      case 'stopped':
        return status === 'stopped' || status === 'exited'
      case 'in-use':
        return status === 'in-use' || status === 'running'
      case 'orphaned':
        // This will be handled by connection filter
        return true
      default:
        return true
    }
  }

  // Helper function to check if a node matches connection filter
  const matchesConnectionFilter = (nodeId: string, filter: NodeConnectionFilter, edges: EdgeData[]): boolean => {
    if (filter === 'all') {
      return true
    }
    
    const isOrphaned = isOrphanedNode(nodeId, edges)
    
    switch (filter) {
      case 'connected':
        return !isOrphaned
      case 'orphaned':
        return isOrphaned
      default:
        return true
    }
  }

  // Helper function to check if a node matches search query
  const matchesSearchQuery = (node: NodeData, query: string): boolean => {
    if (!query.trim()) {
      return true
    }
    
    const searchLower = query.toLowerCase()
    const nodeName = (node.name || node.Name || '').toLowerCase()
    const nodeId = node.id.toLowerCase()
    
    return nodeName.includes(searchLower) || nodeId.includes(searchLower)
  }

  // Helper function to check if a node is a system resource
  const isSystemResource = (node: NodeData): boolean => {
    const name = (node.name || node.Name || '').toLowerCase()
    
    // Common system resource patterns
    const systemPatterns = [
      'bridge',
      'host',
      'none',
      'default',
      'docker_gwbridge',
      'ingress'
    ]
    
    return systemPatterns.some(pattern => name.includes(pattern))
  }

  // Main filtering function
  const applyFilters = useMemo(() => {
    if (!state.rawData) {
      return null
    }

    const { filters } = state
    const { nodes: rawNodes, edges: rawEdges } = state.rawData

    // Convert nodes to array for easier filtering
    const nodeArray = Object.values(rawNodes) as NodeData[]
    const edgeArray = rawEdges as EdgeData[]

    // Filter nodes
    let filteredNodes = nodeArray.filter(node => {
      // Excluded nodes filter
      if (filters.excludedNodeIds && filters.excludedNodeIds.includes(node.id)) {
        return false
      }
      // Basic visibility filter
      if (!filters.visibleNodes[node.kind]) {
        return false
      }

      // Status filter
      if (!matchesStatusFilter(node, filters.statusFilter)) {
        return false
      }

      // Search query filter
      if (!matchesSearchQuery(node, filters.searchQuery)) {
        return false
      }

      // System resources filter
      if (filters.hideSystemResources && isSystemResource(node)) {
        return false
      }

      // Running only filter
      if (filters.showRunningOnly) {
        const status = node.attributes?.status?.toLowerCase()
        if (status !== 'running') {
          return false
        }
      }

      // In-use only filter
      if (filters.showInUseOnly) {
        const status = node.attributes?.status?.toLowerCase()
        if (status !== 'in-use' && status !== 'running') {
          return false
        }
      }

      return true
    })

    // Create a map of filtered node IDs for edge filtering
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

    // Filter edges based on visible edge types and whether both nodes are visible
    let filteredEdges = edgeArray.filter(edge => {
      if (!filters.visibleEdges[edge.kind]) {
        return false
      }
      return filteredNodeIds.has(edge.src) && filteredNodeIds.has(edge.dst)
    })

    // Apply connection filter (must be done after initial edge filtering)
    if (filters.connectionFilter !== 'all' || filters.showOrphanedOnly) {
      filteredNodes = filteredNodes.filter(node => {
        const isOrphaned = isOrphanedNode(node.id, filteredEdges)
        
        if (filters.showOrphanedOnly && !isOrphaned) {
          return false
        }
        if (!matchesConnectionFilter(node.id, filters.connectionFilter, filteredEdges)) {
          return false
        }
        
        return true
      })

      // Update filtered node IDs after connection filtering
      const finalNodeIds = new Set(filteredNodes.map(n => n.id))
      filteredEdges = filteredEdges.filter(edge => 
        finalNodeIds.has(edge.src) && finalNodeIds.has(edge.dst)
      )
    }

    // Convert filtered nodes back to object format
    const filteredNodesObj: Record<string, NodeData> = {}
    filteredNodes.forEach(node => {
      filteredNodesObj[node.id] = node
    })

    return {
      nodes: filteredNodesObj,
      edges: filteredEdges
    }
  }, [state.rawData, state.filters])

  // Update filtered data when filters change
  useEffect(() => {
    if (applyFilters) {
      dispatch({ type: 'SET_FILTERED_DATA', payload: applyFilters })
    }
  }, [applyFilters, dispatch])

  // Filter actions
  const updateFilters = (newFilters: Partial<GraphFilters>) => {
    dispatch({ type: 'UPDATE_FILTERS', payload: newFilters })
  }

  const toggleNodeVisibility = (nodeKind: NodeKind) => {
    dispatch({ type: 'TOGGLE_NODE_VISIBILITY', payload: nodeKind })
  }

  const toggleEdgeVisibility = (edgeKind: EdgeKind) => {
    dispatch({ type: 'TOGGLE_EDGE_VISIBILITY', payload: edgeKind })
  }

  const setStatusFilter = (filter: NodeStatusFilter) => {
    updateFilters({ statusFilter: filter })
  }

  const setConnectionFilter = (filter: NodeConnectionFilter) => {
    updateFilters({ connectionFilter: filter })
  }

  const setSearchQuery = (query: string) => {
    updateFilters({ searchQuery: query })
  }

  const toggleOrphanedOnly = () => {
    updateFilters({ showOrphanedOnly: !state.filters.showOrphanedOnly })
  }

  const toggleRunningOnly = () => {
    updateFilters({ showRunningOnly: !state.filters.showRunningOnly })
  }

  const toggleInUseOnly = () => {
    updateFilters({ showInUseOnly: !state.filters.showInUseOnly })
  }

  const toggleSystemResources = () => {
    updateFilters({ hideSystemResources: !state.filters.hideSystemResources })
  }

  const resetFilters = () => {
    dispatch({ type: 'RESET_FILTERS' })
  }

  // Exclusion helpers
  const excludeNode = (nodeId: string) => {
    const existing = state.filters.excludedNodeIds || []
    if (!existing.includes(nodeId)) {
      updateFilters({ excludedNodeIds: [...existing, nodeId] })
    }
  }

  const includeNode = (nodeId: string) => {
    const existing = state.filters.excludedNodeIds || []
    updateFilters({ excludedNodeIds: existing.filter(id => id !== nodeId) })
  }

  const clearExcluded = () => {
    updateFilters({ excludedNodeIds: [] })
  }

  // Quick filter presets
  const showOnlyOrphaned = () => {
    updateFilters({
      showOrphanedOnly: true,
      statusFilter: 'all',
      connectionFilter: 'orphaned',
      showRunningOnly: false,
      showInUseOnly: false
    })
  }

  const showOnlyRunning = () => {
    updateFilters({
      showRunningOnly: true,
      statusFilter: 'running',
      showOrphanedOnly: false,
      showInUseOnly: false
    })
  }

  const showMinimalView = () => {
    updateFilters({
      hideSystemResources: true,
      showOrphanedOnly: false,
      statusFilter: 'in-use',
      connectionFilter: 'connected'
    })
  }

  return {
    // State
    filters: state.filters,
    filteredData: state.filteredData,
    
    // Basic filter actions
    updateFilters,
    toggleNodeVisibility,
    toggleEdgeVisibility,
    resetFilters,
    
    // Specific filter actions
    setStatusFilter,
    setConnectionFilter,
    setSearchQuery,
    toggleOrphanedOnly,
    toggleRunningOnly,
    toggleInUseOnly,
    toggleSystemResources,
  // Exclusion helpers
  excludeNode,
  includeNode,
  clearExcluded,
    
    // Quick presets
    showOnlyOrphaned,
    showOnlyRunning,
    showMinimalView,
    
    // Helper functions
    isOrphanedNode: (nodeId: string) => 
      state.filteredData ? isOrphanedNode(nodeId, state.filteredData.edges) : false,
  }
}

// 🎯 SwarmGraph with Advanced Filtering System
// Export main component and filtering system

export { default as SwarmGraph } from './SwarmGraph'
export { GraphProvider, useGraphContext } from './context/GraphContext'
export { useGraphFilters } from './hooks/useGraphFilters'
export { useGraphState } from './hooks/useGraphState'
export { default as FilterPanel } from './FilterPanel'

// Export types for external use
export type { 
  GraphFilters, 
  GraphState, 
  NodeStatusFilter, 
  NodeConnectionFilter 
} from './context/GraphContext'

// Export filter types and constants
export type * from './types/filterTypes'
export { 
  NODE_TYPE_OPTIONS,
  EDGE_TYPE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  CONNECTION_FILTER_OPTIONS
} from './types/filterTypes'

// Legacy exports for compatibility
export { default as Legend } from './Legend'
export { default as NodeDetails } from './NodeDetails'
export { default as Title } from './Title'
export { default as ReactD3Graph } from './ReactD3Graph'
export { default as ReactD3Node } from './ReactD3Node'
export { default as ReactD3Edge } from './ReactD3Edge'

// Re-export types and interfaces
export type * from './interfaces'

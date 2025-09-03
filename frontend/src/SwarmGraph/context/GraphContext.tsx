import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { NodeKind, EdgeKind, GraphNode, GraphEdge } from '../../types'
import { GraphData } from '../interfaces'
import { GraphFilters, NodeStatusFilter, NodeConnectionFilter } from '../types/filterTypes'

export type { NodeStatusFilter, NodeConnectionFilter, GraphFilters } from '../types/filterTypes'

export interface GraphState {
  rawData: GraphData | null
  filteredData: GraphData | null
  filters: GraphFilters
  hoveredNode: string | null
  selectedNode: string | null
  dimensions: { width: number; height: number }
}

// Action types
type GraphAction =
  | { type: 'SET_RAW_DATA'; payload: GraphData }
  | { type: 'SET_FILTERED_DATA'; payload: GraphData }
  | { type: 'UPDATE_FILTERS'; payload: Partial<GraphFilters> }
  | { type: 'SET_HOVERED_NODE'; payload: string | null }
  | { type: 'SET_SELECTED_NODE'; payload: string | null }
  | { type: 'SET_DIMENSIONS'; payload: { width: number; height: number } }
  | { type: 'TOGGLE_NODE_VISIBILITY'; payload: NodeKind }
  | { type: 'TOGGLE_EDGE_VISIBILITY'; payload: EdgeKind }
  | { type: 'RESET_FILTERS' }

// Default state
const defaultFilters: GraphFilters = {
  visibleNodes: {
    container: true,
    network: true,
    image: true,
    volume: true,
  },
  visibleEdges: {
    derived_from: true,
    connected_to: true,
    mounted_into: true,
  },
  statusFilter: 'all',
  connectionFilter: 'all',
  searchQuery: '',
  showOrphanedOnly: false,
  showRunningOnly: false,
  showInUseOnly: false,
  hideSystemResources: false,
}

const initialState: GraphState = {
  rawData: null,
  filteredData: null,
  filters: defaultFilters,
  hoveredNode: null,
  selectedNode: null,
  dimensions: { width: window.innerWidth, height: window.innerHeight },
}

// Reducer
function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'SET_RAW_DATA':
      return { ...state, rawData: action.payload }
    
    case 'SET_FILTERED_DATA':
      return { ...state, filteredData: action.payload }
    
    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      }
    
    case 'SET_HOVERED_NODE':
      return { ...state, hoveredNode: action.payload }
    
    case 'SET_SELECTED_NODE':
      return { ...state, selectedNode: action.payload }
    
    case 'SET_DIMENSIONS':
      return { ...state, dimensions: action.payload }
    
    case 'TOGGLE_NODE_VISIBILITY':
      return {
        ...state,
        filters: {
          ...state.filters,
          visibleNodes: {
            ...state.filters.visibleNodes,
            [action.payload]: !state.filters.visibleNodes[action.payload]
          }
        }
      }
    
    case 'TOGGLE_EDGE_VISIBILITY':
      return {
        ...state,
        filters: {
          ...state.filters,
          visibleEdges: {
            ...state.filters.visibleEdges,
            [action.payload]: !state.filters.visibleEdges[action.payload]
          }
        }
      }
    
    case 'RESET_FILTERS':
      return {
        ...state,
        filters: defaultFilters
      }
    
    default:
      return state
  }
}

// Context
const GraphContext = createContext<{
  state: GraphState
  dispatch: React.Dispatch<GraphAction>
} | null>(null)

// Provider
export const GraphProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(graphReducer, initialState)

  return (
    <GraphContext.Provider value={{ state, dispatch }}>
      {children}
    </GraphContext.Provider>
  )
}

// Hook to use the context
export const useGraphContext = () => {
  const context = useContext(GraphContext)
  if (!context) {
    throw new Error('useGraphContext must be used within a GraphProvider')
  }
  return context
}

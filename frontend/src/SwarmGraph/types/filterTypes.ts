import { CSSProperties } from 'react'
import { NodeKind, EdgeKind } from '../../types'

// Core filter types
export type NodeStatusFilter = 'all' | 'running' | 'stopped' | 'in-use' | 'orphaned'
export type NodeConnectionFilter = 'all' | 'connected' | 'orphaned'

// Filter state interface
export interface GraphFilters {
  // Node type visibility
  visibleNodes: Record<NodeKind, boolean>
  visibleEdges: Record<EdgeKind, boolean>
  
  // Advanced filters
  statusFilter: NodeStatusFilter
  connectionFilter: NodeConnectionFilter
  searchQuery: string
  
  // Custom filters
  showOrphanedOnly: boolean
  showRunningOnly: boolean
  showInUseOnly: boolean
  hideSystemResources: boolean
}

// Filter panel props
export interface FilterPanelProps {
  isVisible: boolean
  onToggle: () => void
}

// Filter option definitions
export interface FilterOption<T = string> {
  value: T
  label: string
}

export interface NodeTypeOption {
  kind: NodeKind
  label: string
  color: string
}

export interface EdgeTypeOption {
  kind: EdgeKind
  label: string
}

// Style interfaces for better type safety
export interface FilterPanelStyles {
  panel: CSSProperties
  toggleButton: CSSProperties
  section: CSSProperties
  sectionTitle: CSSProperties
  label: CSSProperties
  input: CSSProperties
  select: CSSProperties
  button: CSSProperties
  presetButton: CSSProperties
  summary: CSSProperties
  nodeColorIndicator: CSSProperties
  checkbox: CSSProperties
}

// Constants for filter options
export const NODE_TYPE_OPTIONS: NodeTypeOption[] = [
  { kind: 'container', label: 'Containers', color: '#00D4FF' },
  { kind: 'image', label: 'Images', color: '#FF6B35' },
  { kind: 'network', label: 'Networks', color: '#FFD700' },
  { kind: 'volume', label: 'Volumes', color: '#9D4EDD' },
]

export const EDGE_TYPE_OPTIONS: EdgeTypeOption[] = [
  { kind: 'derived_from', label: 'Derived From' },
  { kind: 'connected_to', label: 'Connected To' },
  { kind: 'mounted_into', label: 'Mounted Into' },
]

export const STATUS_FILTER_OPTIONS: FilterOption<NodeStatusFilter>[] = [
  { value: 'all', label: 'All Status' },
  { value: 'running', label: 'Running' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'in-use', label: 'In Use' },
]

export const CONNECTION_FILTER_OPTIONS: FilterOption<NodeConnectionFilter>[] = [
  { value: 'all', label: 'All Nodes' },
  { value: 'connected', label: 'Connected' },
  { value: 'orphaned', label: 'Orphaned' },
]

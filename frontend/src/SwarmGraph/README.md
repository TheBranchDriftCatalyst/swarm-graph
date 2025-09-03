# SwarmGraph Filtering System

This document describes the new filtering system added to the SwarmGraph component.

## Overview

The filtering system provides a comprehensive way to filter and manipulate the graph data displayed in the SwarmGraph. It uses React Context and custom hooks to manage state and provides both a programmatic API and a UI panel for filtering.

## Architecture

### Context and State Management

- **`GraphContext`**: Provides centralized state management for graph data, filters, and UI state
- **`useGraphState`**: Hook for basic graph state operations (selection, dimensions, data)
- **`useGraphFilters`**: Hook for all filtering operations and logic

### Components

- **`FilterPanel`**: UI component providing filtering controls
- **`SwarmGraph`**: Main component updated to use the new context system

## Filter Types

### Basic Visibility Filters
- **Node Types**: Show/hide containers, images, networks, volumes
- **Edge Types**: Show/hide derived_from, connected_to, mounted_into relationships

### Status Filters
- **All Status**: Show all nodes regardless of status
- **Running**: Show only running containers and in-use resources
- **Stopped**: Show only stopped/exited containers
- **In-Use**: Show only resources currently in use

### Connection Filters
- **All Nodes**: Show all nodes
- **Connected**: Show only nodes that have edges (relationships)
- **Orphaned**: Show only nodes with no relationships

### Advanced Filters
- **Show Orphaned Only**: Display only nodes with no connections
- **Show Running Only**: Display only running containers
- **Show In-Use Only**: Display only resources currently in use
- **Hide System Resources**: Hide default Docker resources (bridge, host, etc.)
- **Search**: Filter nodes by name or ID

### Quick Filter Presets
- **Show Orphaned**: Quick filter to show only orphaned resources
- **Show Running**: Quick filter to show only running containers
- **Minimal View**: Show only in-use, connected resources with system resources hidden

## Usage

### Basic Usage with Context

```tsx
import { GraphProvider, SwarmGraph } from './SwarmGraph'

function App() {
  return (
    <GraphProvider>
      <SwarmGraph data={graphData} />
    </GraphProvider>
  )
}
```

### Using the Filtering Hooks

```tsx
import { useGraphFilters } from './SwarmGraph'

function CustomFilterComponent() {
  const {
    filters,
    setStatusFilter,
    toggleOrphanedOnly,
    setSearchQuery,
    showOnlyRunning,
    resetFilters
  } = useGraphFilters()

  return (
    <div>
      <input 
        value={filters.searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search nodes..."
      />
      <button onClick={showOnlyRunning}>
        Show Running Only
      </button>
      <button onClick={resetFilters}>
        Reset Filters
      </button>
    </div>
  )
}
```

### Using Graph State

```tsx
import { useGraphState } from './SwarmGraph'

function NodeInfoComponent() {
  const {
    hoveredNode,
    selectedNode,
    setSelectedNode,
    getNodeInfo
  } = useGraphState()

  const currentNode = getNodeInfo(hoveredNode || selectedNode)

  return (
    <div>
      {currentNode && (
        <div>
          <h3>{currentNode.name}</h3>
          <p>Type: {currentNode.kind}</p>
          <p>Status: {currentNode.attributes?.status}</p>
        </div>
      )}
    </div>
  )
}
```

## Filter Logic

The filtering system processes nodes and edges in the following order:

1. **Basic Visibility**: Filter by node/edge type visibility
2. **Status Filtering**: Apply status-based filters
3. **Search Filtering**: Apply text search filters
4. **System Resource Filtering**: Hide system resources if enabled
5. **Special Filters**: Apply running-only, in-use-only filters
6. **Edge Filtering**: Filter edges based on visibility and connected nodes
7. **Connection Filtering**: Apply orphaned/connected filters

## Performance Considerations

- Filtering is performed using `useMemo` to prevent unnecessary recalculations
- The filtered data is cached in the context state
- Only changed filters trigger re-computation

## Extending the System

### Adding New Filter Types

1. Add the filter type to `GraphFilters` interface in `GraphContext.tsx`
2. Add the filter logic to `useGraphFilters.ts`
3. Add UI controls to `FilterPanel.tsx`
4. Update the reducer in `GraphContext.tsx` if needed

### Custom Filter Presets

Create custom filter combinations by calling `updateFilters`:

```tsx
const showDevelopmentResources = () => {
  updateFilters({
    hideSystemResources: true,
    statusFilter: 'running',
    searchQuery: 'dev'
  })
}
```

## API Reference

### GraphFilters Interface

```typescript
interface GraphFilters {
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
```

### useGraphFilters Hook

Returns an object with filter state and actions:

- `filters`: Current filter state
- `filteredData`: Processed graph data
- `updateFilters(filters)`: Update multiple filters
- `toggleNodeVisibility(nodeKind)`: Toggle node type visibility
- `toggleEdgeVisibility(edgeKind)`: Toggle edge type visibility
- `setStatusFilter(filter)`: Set status filter
- `setConnectionFilter(filter)`: Set connection filter
- `setSearchQuery(query)`: Set search query
- `resetFilters()`: Reset all filters to defaults
- Various toggle functions and quick presets

### useGraphState Hook

Returns an object with graph state and actions:

- `rawData`: Original unfiltered data
- `filteredData`: Filtered data
- `hoveredNode`: Currently hovered node ID
- `selectedNode`: Currently selected node ID
- `dimensions`: Current viewport dimensions
- `setRawData(data)`: Set raw graph data
- `setHoveredNode(id)`: Set hovered node
- `setSelectedNode(id)`: Set selected node
- `getNodeInfo(id)`: Get node information by ID

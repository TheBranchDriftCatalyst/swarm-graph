# SwarmGraph Filtering System

A comprehensive filtering system for the Docker Swarm graph visualization with React Context, custom hooks, and a sleek UI.

## 🚀 Quick Start

```tsx
import { SwarmGraph } from './SwarmGraph'

function App() {
  return <SwarmGraph data={graphData} />
}
```

The filtering system is automatically included - just click the gear icon (🔧) to open the filter panel.

## ✨ Features

- **Real-time filtering** of nodes and edges
- **Advanced search** by name/ID with instant results  
- **Status-based filtering** (running, stopped, in-use, orphaned)
- **Quick filter presets** for common scenarios
- **System resource hiding** for cleaner views
- **Persistent filter state** with easy reset
- **Responsive UI** that matches the graph aesthetic

## 🎮 Filter Controls

| Filter Type | Description |
|-------------|-------------|
| **Node Types** | Show/hide containers, images, networks, volumes |
| **Edge Types** | Show/hide relationships (derived_from, connected_to, mounted_into) |
| **Status** | Filter by running, stopped, in-use states |
| **Connection** | Show all, connected only, or orphaned only |
| **Search** | Real-time text search of node names/IDs |
| **Advanced** | Orphaned-only, running-only, hide system resources |

## 🔧 Quick Presets

- **Show Orphaned**: Find unused resources
- **Show Running**: Active containers only  
- **Minimal View**: Hide clutter, show essentials
- **Reset All**: Back to default view

## 🏗️ Architecture

- **GraphContext**: Centralized state management
- **useGraphFilters**: All filtering logic and actions
- **useGraphState**: Basic graph operations
- **FilterPanel**: Styled UI component
- **Responsive styles**: Matches existing graph aesthetic

Built with TypeScript, React Context, and optimized for performance.

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

import React, { useState, useEffect } from 'react'
import { GraphNode, NodeKind, EdgeKind } from '../types'
import { styles } from './SwarmGraphStyles'
import Legend from './Legend'
import NodeDetails from './NodeDetails'
import Title from './Title'
import ReactD3Graph from './ReactD3Graph'
import FilterPanel from './FilterPanel'
import { GraphProvider } from './context/GraphContext'
import { useGraphState } from './hooks/useGraphState'
import { useGraphFilters } from './hooks/useGraphFilters'

// Optional demo component import
// const FilterDemo = React.lazy(() => 
//   import('../components/FilterDemo').catch(() => ({
//     default: () => null
//   }))
// )

// Inner component that uses the context
const SwarmGraphInner: React.FC<{ data: any }> = ({ data }) => {
  const {
    filteredData,
    hoveredNode,
    selectedNode,
    dimensions,
    layout,
    orthogonalEdges,
    setRawData,
    setHoveredNode,
    setSelectedNode,
    setLayout,
    toggleOrthogonalEdges,
    getNodeInfo,
  } = useGraphState()

  const { filters, toggleNodeVisibility, toggleEdgeVisibility, excludeNode } = useGraphFilters()
  const [filterPanelVisible, setFilterPanelVisible] = useState(false)

  // Update raw data when props change
  useEffect(() => {
    if (data) {
      setRawData(data)
    }
  }, [data, setRawData])

  // If no filtered data yet, show loading or use original data
  const displayData = filteredData || data

  if (!displayData) {
    return (
      <div style={styles.container}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          color: 'white',
          fontSize: '18px'
        }}>
          Loading graph data...
        </div>
      </div>
    )
  }

  // Legacy setters for Legend component compatibility
  const setVisibleNodes = (setter: React.SetStateAction<Record<NodeKind, boolean>>) => {
    if (typeof setter === 'function') {
      const newVisibility = setter(filters.visibleNodes)
      Object.entries(newVisibility).forEach(([nodeKind, visible]) => {
        if (visible !== filters.visibleNodes[nodeKind as NodeKind]) {
          toggleNodeVisibility(nodeKind as NodeKind)
        }
      })
    } else {
      Object.entries(setter).forEach(([nodeKind, visible]) => {
        if (visible !== filters.visibleNodes[nodeKind as NodeKind]) {
          toggleNodeVisibility(nodeKind as NodeKind)
        }
      })
    }
  }

  const setVisibleEdges = (setter: React.SetStateAction<Record<EdgeKind, boolean>>) => {
    if (typeof setter === 'function') {
      const newVisibility = setter(filters.visibleEdges)
      Object.entries(newVisibility).forEach(([edgeKind, visible]) => {
        if (visible !== filters.visibleEdges[edgeKind as EdgeKind]) {
          toggleEdgeVisibility(edgeKind as EdgeKind)
        }
      })
    } else {
      Object.entries(setter).forEach(([edgeKind, visible]) => {
        if (visible !== filters.visibleEdges[edgeKind as EdgeKind]) {
          toggleEdgeVisibility(edgeKind as EdgeKind)
        }
      })
    }
  }

  // Wrapper for setSelectedNode to match ReactD3Graph interface
  const wrappedSetSelectedNode: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
    if (typeof value === 'function') {
      setSelectedNode(value(selectedNode))
    } else {
      setSelectedNode(value)
    }
  }

  // Keyboard handling: Delete/Backspace to exclude selected node, Escape to clear selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedNode) {
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // exclude currently selected node
        excludeNode(selectedNode)
        setSelectedNode(null)
      }
      if (e.key === 'Escape') {
        setSelectedNode(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNode, excludeNode, setSelectedNode])

  return (
    <div style={styles.container}>
      <ReactD3Graph
        data={displayData}
        dimensions={dimensions}
        visibleNodes={filters.visibleNodes}
        visibleEdges={filters.visibleEdges}
        setHoveredNode={setHoveredNode}
        setSelectedNode={wrappedSetSelectedNode}
        hoveredNode={hoveredNode}
        selectedNode={selectedNode}
      />
      {!filterPanelVisible && (
        <Legend
          visibleNodes={filters.visibleNodes}
          setVisibleNodes={setVisibleNodes}
          visibleEdges={filters.visibleEdges}
          setVisibleEdges={setVisibleEdges}
        />
      )}
      <NodeDetails node={getNodeInfo(hoveredNode || selectedNode)} />
      <Title />
      
      {/* Layout Toggle Button */}
      <button
        style={{
          position: 'fixed',
          top: '20px',
          right: filterPanelVisible ? '440px' : '20px',
          padding: '12px 16px',
          backgroundColor: layout === 'structured' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(10, 14, 39, 0.95)',
          border: layout === 'structured' ? '2px solid #00D4FF' : '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          color: layout === 'structured' ? '#00D4FF' : '#FFFFFF',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
          transition: 'all 0.3s ease',
          zIndex: 1000,
        }}
        onClick={() => setLayout(layout === 'force' ? 'structured' : 'force')}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = layout === 'structured' ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.1)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = layout === 'structured' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(10, 14, 39, 0.95)'
          e.currentTarget.style.transform = 'translateY(0px)'
        }}
      >
        {layout === 'force' ? '🔧 FORCE' : '📊 STRUCTURED'}
      </button>

      {/* Orthogonal Edges Toggle Button */}
      <button
        style={{
          position: 'fixed',
          top: '80px',
          right: filterPanelVisible ? '440px' : '20px',
          padding: '12px 16px',
          backgroundColor: orthogonalEdges ? 'rgba(0, 212, 255, 0.2)' : 'rgba(10, 14, 39, 0.95)',
          border: orthogonalEdges ? '2px solid #00D4FF' : '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          color: orthogonalEdges ? '#00D4FF' : '#FFFFFF',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
          transition: 'all 0.3s ease',
          zIndex: 1000,
        }}
        onClick={toggleOrthogonalEdges}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = orthogonalEdges ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.1)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = orthogonalEdges ? 'rgba(0, 212, 255, 0.2)' : 'rgba(10, 14, 39, 0.95)'
          e.currentTarget.style.transform = 'translateY(0px)'
        }}
      >
        {orthogonalEdges ? '📐 ORTHOGONAL' : '📏 STRAIGHT'}
      </button>
      
      <FilterPanel 
        isVisible={filterPanelVisible}
        onToggle={() => setFilterPanelVisible(!filterPanelVisible)}
      />
    </div>
  )
}

// Main component with provider
const SwarmGraph: React.FC<{ data: any }> = ({ data }) => {
  return (
    <GraphProvider>
      <SwarmGraphInner data={data} />
    </GraphProvider>
  )
}

export default SwarmGraph

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

  // Download function to export the graph as PNG
  const downloadGraphAsPng = async () => {
    try {
      // Find the SVG element
      const svgElement = document.querySelector('svg') as SVGElement
      if (!svgElement) {
        console.error('SVG element not found')
        return
      }

      // Clone the SVG to avoid modifying the original
      const svgClone = svgElement.cloneNode(true) as SVGElement
      
      // Ensure all styles are applied inline for proper rendering
      const allElements = svgClone.querySelectorAll('*')
      allElements.forEach((element) => {
        const computedStyle = window.getComputedStyle(element as Element)
        const styleString = Array.from(computedStyle).reduce((str, property) => {
          return `${str}${property}:${computedStyle.getPropertyValue(property)};`
        }, '')
        ;(element as HTMLElement).style.cssText = styleString
      })

      // Create a canvas to render the SVG
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.error('Canvas context not available')
        return
      }

      // Set canvas size to match SVG dimensions
      const svgRect = svgElement.getBoundingClientRect()
      canvas.width = svgRect.width * 2 // 2x for better quality
      canvas.height = svgRect.height * 2
      ctx.scale(2, 2) // Scale up for better quality

      // Convert SVG to image
      const svgData = new XMLSerializer().serializeToString(svgClone)
      const img = new Image()
      
      img.onload = () => {
        // Fill background with dark color to match the graph background
        ctx.fillStyle = '#050817'
        ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2)
        
        // Draw the SVG image onto the canvas
        ctx.drawImage(img, 0, 0)
        
        // Create download link
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `swarm-graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }
        }, 'image/png')
      }

      img.onerror = (error) => {
        console.error('Error loading SVG image:', error)
      }

      // Create blob URL for the SVG
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      img.src = svgUrl
    } catch (error) {
      console.error('Error downloading graph:', error)
    }
  }

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

      {/* Download Button */}
      <button
        style={{
          position: 'fixed',
          top: '140px',
          right: filterPanelVisible ? '440px' : '20px',
          padding: '12px 16px',
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
          border: '2px solid #2ECC71',
          borderRadius: '12px',
          color: '#2ECC71',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(46, 204, 113, 0.3)',
          transition: 'all 0.3s ease',
          zIndex: 1000,
        }}
        onClick={downloadGraphAsPng}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(46, 204, 113, 0.3)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(46, 204, 113, 0.2)'
          e.currentTarget.style.transform = 'translateY(0px)'
        }}
      >
        📥 DOWNLOAD PNG
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

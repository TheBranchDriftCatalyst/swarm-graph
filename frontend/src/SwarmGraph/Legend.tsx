import React from 'react'
import { NodeKind, EdgeKind } from '../types'
import { colors, nodeIcons, styles } from './SwarmGraphStyles'
import { useGraphState } from './hooks/useGraphState'

// Render legend items as compact toggle-buttons (no visible checkboxes).
// When an item is turned off it is visually subdued/greyed out.

interface LegendProps {
  visibleNodes: Record<NodeKind, boolean>
  setVisibleNodes: React.Dispatch<
    React.SetStateAction<Record<NodeKind, boolean>>
  >
  visibleEdges: Record<EdgeKind, boolean>
  setVisibleEdges: React.Dispatch<
    React.SetStateAction<Record<EdgeKind, boolean>>
  >
}

const Legend: React.FC<LegendProps> = ({
  visibleNodes,
  setVisibleNodes,
  visibleEdges,
  setVisibleEdges,
}) => {
  const { layout, setLayout, orthogonalEdges, toggleOrthogonalEdges } = useGraphState()

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
  return (
    <div style={styles.legend}>
    <h3 style={styles.legendTitle}>DOCKER SWARM</h3>

    {/* Layout selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#BFD8FF', marginBottom: 6 }}>Layout</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setLayout('force')} style={{ padding: '6px 10px', borderRadius: 6, background: layout === 'force' ? 'rgba(0,212,255,0.06)' : 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#cfe' }}>Force</button>
          <button onClick={() => setLayout('structured')} style={{ padding: '6px 10px', borderRadius: 6, background: layout === 'structured' ? 'rgba(0,212,255,0.06)' : 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#cfe' }}>Structured</button>
        </div>
      </div>

      {/* Edge style selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#BFD8FF', marginBottom: 6 }}>Edge Style</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={toggleOrthogonalEdges} 
            style={{ 
              padding: '6px 10px', 
              borderRadius: 6, 
              background: orthogonalEdges ? 'rgba(0,212,255,0.06)' : 'transparent', 
              border: '1px solid rgba(255,255,255,0.04)', 
              color: '#cfe',
              cursor: 'pointer'
            }}
          >
            {orthogonalEdges ? 'Orthogonal' : 'Straight'}
          </button>
        </div>
      </div>

      {/* Download button */}
      <div style={{ marginBottom: 15 }}>
        <button 
          onClick={downloadGraphAsPng}
          style={{ 
            width: '100%',
            padding: '8px 12px', 
            borderRadius: 6, 
            background: 'rgba(46, 204, 113, 0.1)', 
            border: '1px solid rgba(46, 204, 113, 0.3)', 
            color: '#2ECC71',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(46, 204, 113, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(46, 204, 113, 0.1)'
          }}
        >
          📥 Download PNG
        </button>
      </div>

    <div style={{ marginBottom: 8, fontSize: 13 }}>
      <div style={{ marginBottom: 6, fontWeight: 600, color: '#BFD8FF' }}>
        Show nodes
      </div>
      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        {(['container', 'network', 'image', 'volume'] as NodeKind[]).map(
          (k) => {
            const on = !!visibleNodes[k]
            return (
              <div
                key={k}
                role="button"
                onClick={() =>
                  setVisibleNodes((prev) => ({ ...prev, [k]: !prev[k] }))
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '3px 6px',
                  borderRadius: 6,
                  userSelect: 'none',
                  color: on ? '#E6ECFF' : '#7f8896',
                  background: on ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
                aria-pressed={on}
              >
                <span
                  style={{
                    color: on ? (colors as any)[k] : '#6b7180',
                    marginRight: 6,
                  }}
                >
                  {(nodeIcons as Record<NodeKind, React.ReactNode>)[k]}
                </span>
                <span style={{ opacity: on ? 1 : 0.7 }}>{k}</span>
              </div>
            )
          }
        )}
      </div>
    </div>

    <div style={styles.legendList}>
      <hr
        style={{ border: 0, borderTop: '1px solid #2b2f55', margin: '8px 0' }}
      />
      <div style={{ fontSize: 12, opacity: 0.95 }}>
        <div style={{ marginBottom: 6, fontWeight: 600, color: '#BFD8FF' }}>
          Show edges
        </div>
        {(['connected_to', 'mounted_into', 'derived_from'] as EdgeKind[]).map(
          (k) => {
            const on = !!visibleEdges[k]
            return (
              <div
                key={k}
                role="button"
                onClick={() =>
                  setVisibleEdges((prev) => ({ ...prev, [k]: !prev[k] }))
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: 6,
                  color: on ? '#E6ECFF' : '#7f8896',
                  background: on ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
                aria-pressed={on}
              >
                <span
                  style={{ color: on ? (colors.edge as any)[k] : '#6b7180' }}
                >
                  —
                </span>
                <span style={{ opacity: on ? 1 : 0.7 }}>{k}</span>
              </div>
            )
          }
        )}
      </div>
    </div>
  </div>
)

}

export default Legend

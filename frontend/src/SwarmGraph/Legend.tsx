import React from 'react'
import { NodeKind, EdgeKind } from './types'
import { colors, nodeIcons, styles } from './SwarmGraphStyles'

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
}) => (
  <div style={styles.legend}>
    <h3 style={styles.legendTitle}>DOCKER SWARM</h3>

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

export default Legend

import React from 'react'
import { colors } from './SwarmGraphStyles'
import { EdgeData } from './interfaces'
import { EdgeKind } from '../types'

interface ReactD3EdgeProps {
  data: EdgeData
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

const ReactD3Edge: React.FC<ReactD3EdgeProps> = ({
  data,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  // Calculate label text and positioning
  const getLabelText = () => {
    if (data.kind === 'connected_to' && data.attributes?.ip) {
      const { ip } = data.attributes
      return ip.length > 12 ? ip.substring(0, 12) + '...' : ip
    }
    if (data.kind === 'mounted_into' && data.attributes?.target) {
      const { target } = data.attributes
      return target.length > 12 ? target.substring(0, 12) + '...' : target
    }
    return null
  }

  const labelText = getLabelText()
  const showLabel = labelText !== null

  // Calculate midpoint for label positioning
  const midX = ((data.source.x || 0) + (data.target.x || 0)) / 2
  const midY = ((data.source.y || 0) + (data.target.y || 0)) / 2

  // Calculate dynamic label background width
  const textWidth = labelText ? labelText.length * 6 + 8 : 50

  return (
    <g className="edge-group">
      {/* Edge line */}
      <line
        x1={data.source.x || 0}
        y1={data.source.y || 0}
        x2={data.target.x || 0}
        y2={data.target.y || 0}
        stroke={colors.edge[data.kind as EdgeKind]}
        strokeWidth={2}
        strokeOpacity={0.8}
        markerEnd={`url(#arrow-${data.kind})`}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      {/* Label (only for meaningful connections) */}
      {showLabel && (
        <g transform={`translate(${midX}, ${midY})`}>
          {/* Label background */}
          <rect
            x={-textWidth / 2}
            y={-8}
            width={textWidth}
            height={16}
            rx={4}
            fill="rgba(10, 14, 39, 0.95)"
            stroke={colors.edge[data.kind as EdgeKind]}
            strokeWidth={1}
          />

          {/* Label text */}
          <text
            fontSize={10}
            fill="#FFFFFF"
            textAnchor="middle"
            dy="0.35em"
            fontWeight="500"
          >
            {labelText}
          </text>
        </g>
      )}
    </g>
  )
}

export default ReactD3Edge
export type { ReactD3EdgeProps }

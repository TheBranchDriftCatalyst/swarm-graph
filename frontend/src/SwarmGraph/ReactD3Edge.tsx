import React from 'react'
import { colors } from './SwarmGraphStyles'
import { EdgeData } from './interfaces'
import { EdgeKind } from '../types'

interface ReactD3EdgeProps {
  data: EdgeData
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isDimmed?: boolean
}

const ReactD3Edge: React.FC<ReactD3EdgeProps> = ({
  data,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isDimmed = false,
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
    // If Traefik/DNS style labels exist on the connected nodes, show them
    try {
      const src: any = (data as any).src
      const dst: any = (data as any).dst

      const labelCandidates: string[] = []

      const readLabels = (node: any) => {
        if (!node) {
          return
        }
        // support both attributes.labels and attributes.Labels (Docker variants)
        const attrs = node.attributes || {}
        const labels = attrs.labels || attrs.Labels || (node.get ? node.get('attributes.labels') || node.get('attributes.Labels') : null)
        if (labels && typeof labels === 'object') {
          Object.entries(labels).forEach(([k, v]) => {
            if (k && String(k).startsWith('traefik')) {
              labelCandidates.push(String(v))
            }
          })
        }
      }

      readLabels(src)
      readLabels(dst)

      if (labelCandidates.length > 0) {
        // Try to extract Host(`...`) or hostnames from the label values
        const hosts: string[] = []
        const hostRe = /Host\(`([^`]+)`\)/i
        labelCandidates.forEach((val) => {
          const m = String(val).match(hostRe)
          if (m && m[1]) {
            hosts.push(m[1])
          } else {
            // fallback: if the value looks like a hostname, push it, otherwise push the raw label value
            const maybe = String(val)
            if (maybe.includes('`')) {
              hosts.push(maybe.replace(/`/g, ''))
            } else if (maybe.length < 32) {
              hosts.push(maybe)
            } else {
              hosts.push(maybe.substring(0, 30) + '...')
            }
          }
        })

        if (hosts.length > 0) {
          const uniq = Array.from(new Set(hosts))
          const joined = uniq.join(', ')
          return joined.length > 20 ? joined.substring(0, 20) + '...' : joined
        }
      }
    } catch (err) {
      // ignore failures and fall through to default
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
        strokeOpacity={isDimmed ? 0.18 : 0.8}
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

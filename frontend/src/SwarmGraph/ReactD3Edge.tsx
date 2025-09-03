import React from 'react'
import { colors } from './SwarmGraphStyles'
import { EdgeData } from './interfaces'
import { EdgeKind } from '../types'
import { getNodeDimensions } from './ReactD3Node'

interface ReactD3EdgeProps {
  data: EdgeData
  zoom?: number
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isDimmed?: boolean
}

// Function to calculate edge endpoints that intersect with rectangular node boundaries
const calculateEdgeEndpoints = (
  sourceX: number, 
  sourceY: number, 
  targetX: number, 
  targetY: number,
  sourceNode: any,
  targetNode: any,
  zoom: number = 1
) => {
  // Calculate the direction vector
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance === 0) {
    return {
      x1: sourceX,
      y1: sourceY,
      x2: targetX,
      y2: targetY
    }
  }
  
  // Normalize the direction vector
  const unitX = dx / distance
  const unitY = dy / distance
  
  // Get actual node dimensions
  const sourceDimensions = getNodeDimensions(sourceNode)
  const targetDimensions = getNodeDimensions(targetNode)
  
  // Apply the same visual scaling as nodes do (inverse of zoom, clamped)
  const visualScale = Math.max(0.5, Math.min(1.2, 1 / zoom))
  const sourceWidth = sourceDimensions.width * visualScale
  const sourceHeight = sourceDimensions.height * visualScale
  const targetWidth = targetDimensions.width * visualScale
  const targetHeight = targetDimensions.height * visualScale
  
  // Function to find intersection with rectangular boundary
  const findRectIntersection = (centerX: number, centerY: number, width: number, height: number, dirX: number, dirY: number) => {
    const halfWidth = width / 2
    const halfHeight = height / 2
    
    // Calculate intersection with each edge and find the closest valid one
    const intersections = []
    
    // Right edge
    if (dirX > 0) {
      const t = halfWidth / dirX
      const y = dirY * t
      if (Math.abs(y) <= halfHeight) {
        intersections.push({ x: centerX + halfWidth, y: centerY + y, t })
      }
    }
    
    // Left edge  
    if (dirX < 0) {
      const t = -halfWidth / dirX
      const y = dirY * t
      if (Math.abs(y) <= halfHeight) {
        intersections.push({ x: centerX - halfWidth, y: centerY + y, t })
      }
    }
    
    // Bottom edge
    if (dirY > 0) {
      const t = halfHeight / dirY
      const x = dirX * t
      if (Math.abs(x) <= halfWidth) {
        intersections.push({ x: centerX + x, y: centerY + halfHeight, t })
      }
    }
    
    // Top edge
    if (dirY < 0) {
      const t = -halfHeight / dirY
      const x = dirX * t
      if (Math.abs(x) <= halfWidth) {
        intersections.push({ x: centerX + x, y: centerY - halfHeight, t })
      }
    }
    
    // Return the intersection with smallest positive t (closest to center in the direction)
    const validIntersections = intersections.filter(int => int.t > 0)
    if (validIntersections.length === 0) {
      return { x: centerX, y: centerY }
    }
    
    const closest = validIntersections.reduce((min, current) => 
      current.t < min.t ? current : min
    )
    
    return { x: closest.x, y: closest.y }
  }
  
  // Calculate intersection points for both nodes using scaled dimensions
  const sourceIntersection = findRectIntersection(
    sourceX, sourceY, 
    sourceWidth, sourceHeight, 
    unitX, unitY
  )
  
  const targetIntersection = findRectIntersection(
    targetX, targetY, 
    targetWidth, targetHeight, 
    -unitX, -unitY  // Reverse direction for target
  )
  
  return { 
    x1: sourceIntersection.x, 
    y1: sourceIntersection.y, 
    x2: targetIntersection.x, 
    y2: targetIntersection.y 
  }
}

const ReactD3Edge: React.FC<ReactD3EdgeProps> = ({
  data,
  zoom = 1,
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

  // Calculate edge endpoints that stop at node boundaries
  const edgePoints = calculateEdgeEndpoints(
    data.source.x || 0,
    data.source.y || 0,
    data.target.x || 0,
    data.target.y || 0,
    data.source,
    data.target,
    zoom
  )

  // Calculate midpoint for label positioning (use original centers for label)
  const midX = ((data.source.x || 0) + (data.target.x || 0)) / 2
  const midY = ((data.source.y || 0) + (data.target.y || 0)) / 2

  // Calculate dynamic label background width
  const textWidth = labelText ? labelText.length * 6 + 8 : 50

  return (
    <g className="edge-group">
      {/* Edge line */}
      <line
        x1={edgePoints.x1}
        y1={edgePoints.y1}
        x2={edgePoints.x2}
        y2={edgePoints.y2}
        stroke={colors.edge[data.kind as EdgeKind]}
        strokeWidth={2}
        strokeOpacity={isDimmed ? 0.18 : 0.8}
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

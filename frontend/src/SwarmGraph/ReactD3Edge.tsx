import React from 'react'
import { colors } from './SwarmGraphStyles'
import { EdgeData } from './interfaces'
import { EdgeKind } from '../types'
import { getNodeDimensions } from './ReactD3Node'

interface ReactD3EdgeProps {
  data: EdgeData
  orthogonal?: boolean
  allNodes?: any[]
  edgeIndex?: number
  totalEdgesBetweenNodes?: number
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isDimmed?: boolean
}

// Function to calculate edge endpoints using 4-handle system (midpoints of each side)
const calculateEdgeEndpoints = (
  sourceX: number, 
  sourceY: number, 
  targetX: number, 
  targetY: number,
  sourceNode: any,
  targetNode: any
) => {
  // Get actual node dimensions
  const sourceDimensions = getNodeDimensions(sourceNode)
  const targetDimensions = getNodeDimensions(targetNode)
  
  const sourceWidth = sourceDimensions.width
  const sourceHeight = sourceDimensions.height
  const targetWidth = targetDimensions.width
  const targetHeight = targetDimensions.height
  
  // Function to get the 4 handles (midpoints of each side) for a node
  const getNodeHandles = (centerX: number, centerY: number, width: number, height: number) => {
    const halfWidth = width / 2
    const halfHeight = height / 2
    
    return {
      top: { x: centerX, y: centerY - halfHeight },
      bottom: { x: centerX, y: centerY + halfHeight },
      left: { x: centerX - halfWidth, y: centerY },
      right: { x: centerX + halfWidth, y: centerY }
    }
  }
  
  // Function to find the closest handle to a target point
  const findClosestHandle = (handles: any, targetX: number, targetY: number) => {
    let closestHandle = handles.top
    let minDistance = Math.sqrt((handles.top.x - targetX) ** 2 + (handles.top.y - targetY) ** 2)
    
    const handleEntries = [
      { side: 'top', handle: handles.top },
      { side: 'bottom', handle: handles.bottom },
      { side: 'left', handle: handles.left },
      { side: 'right', handle: handles.right }
    ]
    
    for (const { handle } of handleEntries) {
      const distance = Math.sqrt((handle.x - targetX) ** 2 + (handle.y - targetY) ** 2)
      if (distance < minDistance) {
        minDistance = distance
        closestHandle = handle
      }
    }
    
    return closestHandle
  }
  
  // Get handles for both nodes
  const sourceHandles = getNodeHandles(sourceX, sourceY, sourceWidth, sourceHeight)
  const targetHandles = getNodeHandles(targetX, targetY, targetWidth, targetHeight)
  
  // Find the closest handle on source node to target center
  const sourceHandle = findClosestHandle(sourceHandles, targetX, targetY)
  
  // Find the closest handle on target node to source center
  const targetHandle = findClosestHandle(targetHandles, sourceX, sourceY)
  
  return { 
    x1: sourceHandle.x, 
    y1: sourceHandle.y, 
    x2: targetHandle.x, 
    y2: targetHandle.y 
  }
}

// Function to calculate orthogonal (right-angled) edge path with collision avoidance
const calculateOrthogonalPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourceNode: any,
  targetNode: any,
  allNodes: any[] = [],
  edgeIndex: number = 0,
  totalEdgesBetweenNodes: number = 1
) => {
  const dx = x2 - x1
  const dy = y2 - y1
  
  // Calculate tight spacing for multiple edges between same nodes
  const edgeSpacing = 15 // Reduced from default offsets
  const offsetMultiplier = Math.floor(edgeIndex / 2) + 1
  const isEvenIndex = edgeIndex % 2 === 0
  const offsetDirection = isEvenIndex ? 1 : -1
  const baseOffset = offsetMultiplier * edgeSpacing * offsetDirection
  
  // Helper function to check if a point is inside a node's bounds (tighter bounds)
  const isPointInNode = (px: number, py: number, node: any) => {
    if (!node || node.id === sourceNode.id || node.id === targetNode.id) {
      return false
    }
    
    const nodeDims = getNodeDimensions(node)
    const { width, height } = nodeDims
    
    const nodeX = node.x || 0
    const nodeY = node.y || 0
    
    return (
      px >= nodeX - width/2 - 8 && // Reduced padding for tighter routing
      px <= nodeX + width/2 + 8 &&
      py >= nodeY - height/2 - 8 &&
      py <= nodeY + height/2 + 8
    )
  }
  
  // Helper function to check if a line segment intersects any nodes
  const lineIntersectsNodes = (sx: number, sy: number, ex: number, ey: number) => {
    const steps = 15 // Reduced steps for faster calculation
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = sx + (ex - sx) * t
      const py = sy + (ey - sy) * t
      
      for (const node of allNodes) {
        if (isPointInNode(px, py, node)) {
          return true
        }
      }
    }
    return false
  }
  
  // Calculate different routing options with edge spacing
  const routes = []
  
  // Option 1: Horizontal-first direct with offset
  const hMidX = x1 + dx * 0.7 + baseOffset * 0.3
  if (!lineIntersectsNodes(x1, y1, hMidX, y1) && 
      !lineIntersectsNodes(hMidX, y1, hMidX, y2) && 
      !lineIntersectsNodes(hMidX, y2, x2, y2)) {
    routes.push({
      path: `M ${x1} ${y1} L ${hMidX} ${y1} L ${hMidX} ${y2} L ${x2} ${y2}`,
      priority: Math.abs(dx) > Math.abs(dy) ? 1 : 2
    })
  }
  
  // Option 2: Vertical-first direct with offset
  const vMidY = y1 + dy * 0.7 + baseOffset * 0.3
  if (!lineIntersectsNodes(x1, y1, x1, vMidY) && 
      !lineIntersectsNodes(x1, vMidY, x2, vMidY) && 
      !lineIntersectsNodes(x2, vMidY, x2, y2)) {
    routes.push({
      path: `M ${x1} ${y1} L ${x1} ${vMidY} L ${x2} ${vMidY} L ${x2} ${y2}`,
      priority: Math.abs(dy) > Math.abs(dx) ? 1 : 2
    })
  }
  
  // Option 3: Compact horizontal detour (reduced from 80 to 40)
  const hMidX2 = x1 + dx * 0.5
  const offsetY = dy > 0 ? Math.max(40, Math.abs(dy) * 0.2) + baseOffset : -Math.max(40, Math.abs(dy) * 0.2) + baseOffset
  const routeY = y1 + offsetY
  
  if (!lineIntersectsNodes(x1, y1, hMidX2, y1) && 
      !lineIntersectsNodes(hMidX2, y1, hMidX2, routeY) && 
      !lineIntersectsNodes(hMidX2, routeY, x2, routeY) && 
      !lineIntersectsNodes(x2, routeY, x2, y2)) {
    routes.push({
      path: `M ${x1} ${y1} L ${hMidX2} ${y1} L ${hMidX2} ${routeY} L ${x2} ${routeY} L ${x2} ${y2}`,
      priority: 3
    })
  }
  
  // Option 4: Compact vertical detour (reduced from 80 to 40)
  const vMidY2 = y1 + dy * 0.5
  const offsetX = dx > 0 ? Math.max(40, Math.abs(dx) * 0.2) + baseOffset : -Math.max(40, Math.abs(dx) * 0.2) + baseOffset
  const routeX = x1 + offsetX
  
  if (!lineIntersectsNodes(x1, y1, x1, vMidY2) && 
      !lineIntersectsNodes(x1, vMidY2, routeX, vMidY2) && 
      !lineIntersectsNodes(routeX, vMidY2, routeX, y2) && 
      !lineIntersectsNodes(routeX, y2, x2, y2)) {
    routes.push({
      path: `M ${x1} ${y1} L ${x1} ${vMidY2} L ${routeX} ${vMidY2} L ${routeX} ${y2} L ${x2} ${y2}`,
      priority: 3
    })
  }
  
  // Option 5: Fallback - tight detour routes (reduced from 120 to 60)
  const tightOffsetY = dy > 0 ? 60 + Math.abs(baseOffset) : -60 - Math.abs(baseOffset)
  const tightOffsetX = dx > 0 ? 60 + Math.abs(baseOffset) : -60 - Math.abs(baseOffset)
  
  // Tight horizontal detour
  routes.push({
    path: `M ${x1} ${y1} L ${x1} ${y1 + tightOffsetY} L ${x2} ${y1 + tightOffsetY} L ${x2} ${y2}`,
    priority: 4
  })
  
  // Tight vertical detour
  routes.push({
    path: `M ${x1} ${y1} L ${x1 + tightOffsetX} ${y1} L ${x1 + tightOffsetX} ${y2} L ${x2} ${y2}`,
    priority: 4
  })
  
  // Sort routes by priority and return the best one
  routes.sort((a, b) => a.priority - b.priority)
  
  return routes.length > 0 ? routes[0].path : `M ${x1} ${y1} L ${x2} ${y2}` // Fallback to straight line
}

// Function to calculate the midpoint of an orthogonal path for label positioning
const getOrthogonalPathMidpoint = (pathString: string) => {
  // Parse the path string to extract coordinates
  const commands = pathString.match(/[MLZ][^MLZ]*/g) || []
  const points = []
  
  for (const command of commands) {
    const coords = command.slice(1).trim().split(/\s+/)
    if (coords.length >= 2) {
      points.push({
        x: parseFloat(coords[0]),
        y: parseFloat(coords[1])
      })
    }
  }
  
  if (points.length < 2) {
    return { x: 0, y: 0 }
  }
  
  // Calculate total path length
  let totalLength = 0
  const segments = []
  
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x
    const dy = points[i].y - points[i-1].y
    const length = Math.sqrt(dx * dx + dy * dy)
    segments.push({ length, start: points[i-1], end: points[i] })
    totalLength += length
  }
  
  // Find the point at 50% of the path length
  const targetLength = totalLength / 2
  let currentLength = 0
  
  for (const segment of segments) {
    if (currentLength + segment.length >= targetLength) {
      // The midpoint is in this segment
      const ratio = (targetLength - currentLength) / segment.length
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio
      }
    }
    currentLength += segment.length
  }
  
  // Fallback to geometric center
  const centerIndex = Math.floor(points.length / 2)
  return points[centerIndex]
}

const ReactD3Edge: React.FC<ReactD3EdgeProps> = ({
  data,
  orthogonal = false,
  allNodes = [],
  edgeIndex = 0,
  totalEdgesBetweenNodes = 1,
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
    data.target
  )

  // Generate path based on mode
  const edgePath = orthogonal 
    ? calculateOrthogonalPath(
        edgePoints.x1, 
        edgePoints.y1, 
        edgePoints.x2, 
        edgePoints.y2,
        data.source,
        data.target,
        allNodes,
        edgeIndex,
        totalEdgesBetweenNodes
      )
    : null

  // Calculate midpoint for label positioning
  let midX, midY
  
  if (orthogonal && edgePath) {
    // Use the actual path midpoint for orthogonal edges
    const pathMidpoint = getOrthogonalPathMidpoint(edgePath)
    midX = pathMidpoint.x
    midY = pathMidpoint.y
  } else {
    // Use diagonal midpoint for straight edges
    midX = ((data.source.x || 0) + (data.target.x || 0)) / 2
    midY = ((data.source.y || 0) + (data.target.y || 0)) / 2
  }

  // Calculate dynamic label background width
  const textWidth = labelText ? labelText.length * 6 + 8 : 50

  return (
    <g className="edge-group">
      {/* Edge line - either straight or orthogonal */}
      {orthogonal ? (
        <path
          d={edgePath || ''}
          stroke={colors.edge[data.kind as EdgeKind]}
          strokeWidth={2}
          strokeOpacity={isDimmed ? 0.18 : 0.8}
          fill="none"
          style={{ cursor: onClick ? 'pointer' : 'default' }}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      ) : (
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
      )}

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

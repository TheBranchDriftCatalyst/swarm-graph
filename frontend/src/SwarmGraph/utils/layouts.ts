import { NodeData, GraphData } from '../interfaces'

export type LayoutKind = 'force' | 'structured'

// Simple structured layout: group nodes by kind into columns, evenly spaced rows
export function applyStructuredLayout(nodes: NodeData[], dimensions: { width: number; height: number }) {
  const kinds = Array.from(new Set(nodes.map((n) => n.kind)))
  const colCount = kinds.length || 1
  const colWidth = dimensions.width / Math.max(1, colCount)

  const grouped: Record<string, NodeData[]> = {}
  kinds.forEach((k) => (grouped[k] = []))
  nodes.forEach((n) => grouped[n.kind].push(n))

  // For each group, place nodes vertically centered within their column
  kinds.forEach((k, idx) => {
    const colNodes = grouped[k]
    const perCol = colNodes.length
    const spacing = Math.max(80, (dimensions.height - 80) / Math.max(1, perCol))
    const startY = (dimensions.height - (spacing * (perCol - 1 || 1))) / 2
    const x = colWidth * idx + colWidth / 2
    colNodes.forEach((node, i) => {
      node.x = x
      node.y = startY + i * spacing
      node.fx = node.x
      node.fy = node.y
    })
  })

  return nodes
}

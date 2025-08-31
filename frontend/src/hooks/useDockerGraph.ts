import { useEffect, useRef, useState } from 'react'

type AnyNode = { [k: string]: any }
type AnyEdge = { [k: string]: any }

type Opts = {
  url?: string
  interval?: number
}

export default function useDockerGraph(opts: Opts = {}) {
  const url = opts.url || 'http://localhost:9123/graph.json'
  const intervalMs = typeof opts.interval === 'number' ? opts.interval : 2000

  const [nodes, setNodes] = useState<AnyNode[]>([])
  const [edges, setEdges] = useState<AnyEdge[]>([])
  const [raw, setRaw] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    async function fetchGraph() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(url)
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(
            `HTTP ${res.status} ${res.statusText} ${txt ? '- ' + txt.slice(0, 200) : ''}`
          )
        }
        const j = await res.json()
        setRaw(j)
        // Basic validation and shape normalization: support both upper-case
        // { Nodes: [] } and lower-case { nodes: { id: {...}, ... }, edges: [] }
        let gotNodes: AnyNode[] = []
        if (Array.isArray((j as any)?.Nodes)) {
          gotNodes = (j as any).Nodes
        } else if (Array.isArray((j as any)?.nodes)) {
          gotNodes = (j as any).nodes
        } else if (
          j &&
          typeof (j as any).nodes === 'object' &&
          (j as any).nodes !== null
        ) {
          gotNodes = Object.values((j as any).nodes)
        }

        let gotEdges: AnyEdge[] = []
        if (Array.isArray((j as any)?.Edges)) {
          gotEdges = (j as any).Edges
        } else if (Array.isArray((j as any)?.edges)) {
          gotEdges = (j as any).edges
        }
        if (mounted.current) {
          setNodes(gotNodes)
          setEdges(gotEdges)
        }
      } catch (e: any) {
        if (mounted.current) setError(e.message || String(e))
      } finally {
        if (mounted.current) setLoading(false)
      }
    }

    // initial fetch and periodic refresh
    fetchGraph()
    const id = setInterval(fetchGraph, intervalMs)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [url, intervalMs])
  return { nodes, edges, error, loading, raw }
}

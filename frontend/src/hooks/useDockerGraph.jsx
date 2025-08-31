import { useEffect, useRef, useState } from 'react'

// useDockerGraph: fetches /graph.json periodically and returns nodes/edges and status
export default function useDockerGraph(opts = {}) {
  const url = opts.url || 'http://localhost:9123/graph.json'
  const intervalMs = typeof opts.interval === 'number' ? opts.interval : 2000

  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [error, setError] = useState(null)
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
          throw new Error(`HTTP ${res.status} ${res.statusText} ${txt ? '- ' + txt.slice(0,200) : ''}`)
        }
        const j = await res.json()
        // Basic validation and shape normalization: support both upper-case
        // { Nodes: [] } and lower-case { nodes: { id: {...}, ... }, edges: [] }
        let gotNodes = []
        if (Array.isArray(j && j.Nodes)) {
          gotNodes = j.Nodes
        } else if (Array.isArray(j && j.nodes)) {
          gotNodes = j.nodes
        } else if (j && typeof j.nodes === 'object' && j.nodes !== null) {
          // nodes may be an object map id->node
          gotNodes = Object.values(j.nodes)
        }

        let gotEdges = []
        if (Array.isArray(j && j.Edges)) {
          gotEdges = j.Edges
        } else if (Array.isArray(j && j.edges)) {
          gotEdges = j.edges
        }
        if (mounted.current) {
          setNodes(gotNodes)
          setEdges(gotEdges)
        }
      } catch (e) {
        if (mounted.current) setError(e.message || String(e))
      } finally {
        if (mounted.current) setLoading(false)
      }
    }

    // initial fetch and periodic refresh
    fetchGraph()
    const id = setInterval(fetchGraph, intervalMs)
    return () => { mounted.current = false; clearInterval(id) }
  }, [url, intervalMs])
  console.log(nodes, edges)
  return { nodes, edges, error, loading }
}

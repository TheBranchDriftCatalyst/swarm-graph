import React, { useEffect, useState } from 'react'
import { GraphNode } from './types'
import { styles } from './SwarmGraphStyles'

interface NodeDetailsProps {
  node: GraphNode | undefined
}

// TODO: create a GO url that runs docker inspect on the node/task id.  Do this in internal/httpapi

const NodeDetails: React.FC<NodeDetailsProps> = ({ node }) => {
  const [loading, setLoading] = useState(false)
  const [inspectJSON, setInspectJSON] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!node) {
      setInspectJSON(null)
      setErr(null)
      setLoading(false)
      return
    }

    let aborted = false
    const controller = new AbortController()
    const id = String(node.id)

    async function fetchInspect() {
      setLoading(true)
      setErr(null)
      setInspectJSON(null)
      // Abort after 6s in case server is slow
      const timeout = setTimeout(() => controller.abort(), 6000)
      try {
        const res = await fetch(`localhost:9123/docker/inspect?id=${encodeURIComponent(id)}`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) {
          const txt = await res.text()
          if (!aborted) {
            setErr(`${res.status} ${res.statusText}: ${txt}`)
          }
        } else {
          const txt = await res.text()
          // Try to pretty-print JSON if possible
          try {
            const obj = JSON.parse(txt)
            const pretty = JSON.stringify(obj, null, 2)
            if (!aborted) {
              setInspectJSON(pretty)
            }
          } catch (e) {
            if (!aborted) {
              setInspectJSON(txt)
            }
          }
        }
      } catch (e: any) {
        if (!aborted) {
          setErr(e?.message || String(e))
        }
      } finally {
        if (!aborted) {
          setLoading(false)
        }
      }
    }

    fetchInspect()

    return () => {
      aborted = true
      controller.abort()
    }
  }, [node])

  if (!node) {
    return null
  }
  return (
    <div style={styles.infoPanel}>
      <h3
        style={{
          margin: '0 0 10px 0',
          color: '#3A86FF',
          textShadow: '0 0 5px currentColor',
        }}
      >
        {node.name}
      </h3>
      <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
        <div>
          <strong style={{ color: '#FFBE0B' }}>Type:</strong> {node.kind}
        </div>
        <div>
          <strong style={{ color: '#FFBE0B' }}>ID:</strong>{' '}
          {String(node.id)?.substring(0, 12)}...
        </div>
        {node.attributes &&
          Object.entries(node.attributes).map(([key, value]) => (
            <div key={key}>
              <strong style={{ color: '#FFBE0B' }}>{key}:</strong>{' '}
              {String(value)}
            </div>
          ))}
        <div style={{ marginTop: 8 }}>
          <strong style={{ color: '#FFBE0B' }}>Docker Inspect:</strong>
          <div style={{ marginTop: 6 }}>
            {loading && <div style={{ fontSize: 12 }}>Loading…</div>}
            {err && (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#f66' }}>{err}</pre>
            )}
            {inspectJSON && (
              <pre style={{ maxHeight: '40vh', overflow: 'auto', fontSize: 11, background: '#0b1220', color: '#cfe' }}>
                {inspectJSON}
              </pre>
            )}
            {!loading && !err && !inspectJSON && (
              <div style={{ fontSize: 12, color: '#888' }}>No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NodeDetails

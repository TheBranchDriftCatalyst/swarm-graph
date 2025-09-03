import React, { useEffect, useState } from 'react'
import { GraphNode } from '../types'
import { styles } from './SwarmGraphStyles'
import JsonTreeView from './components/JsonTreeView'

interface NodeDetailsProps {
  // Accept any here temporarily to avoid cross-file type mismatch while we
  // focus on implementing JsonTreeView. A follow-up can tighten this.
  node: any
}

// TODO: create a GO url that runs docker inspect on the node/task id.  Do this in internal/httpapi

const NodeDetails: React.FC<NodeDetailsProps> = ({ node }) => {
  const [loading, setLoading] = useState(false)
  const [inspectJSON, setInspectJSON] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'inspect' | 'labels'>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)

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
        // TODO: convert this to a env variable, ENVRC
        const res = await fetch(`http://localhost:9123/docker/inspect?id=${encodeURIComponent(id)}`, {
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
            const obj = JSON.parse(txt)[0]
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

  const panelStyle = {
    ...styles.infoPanel,
    position: isFullscreen ? 'fixed' : styles.infoPanel.position,
    top: isFullscreen ? 40 : styles.infoPanel.top,
    left: isFullscreen ? 40 : undefined,
    right: isFullscreen ? 40 : styles.infoPanel.right,
    bottom: isFullscreen ? 40 : undefined,
    width: isFullscreen ? 'calc(100vw - 80px)' : styles.infoPanel.width,
    maxHeight: isFullscreen ? 'calc(100vh - 80px)' : styles.infoPanel.maxHeight,
    zIndex: isFullscreen ? 2000 : 1000,
  }

  const copyInspect = async () => {
    if (!inspectJSON) {
      return
    }
    try {
      await navigator.clipboard.writeText(inspectJSON)
      // small visual confirmation could be added later
    } catch (e) {
      // ignore
    }
  }

// Helper: build nested object from dot-notated label keys
const buildLabelTree = (labels: Record<string, any>) => {
  const root: Record<string, any> = {}
  Object.entries(labels || {}).forEach(([key, val]) => {
    const parts = String(key).split('.')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (i === parts.length - 1) {
        cur[p] = val
      } else {
        if (!cur[p] || typeof cur[p] !== 'object') {
          cur[p] = {}
        }
        cur = cur[p]
      }
    }
  })
  return root
}

// Use reusable JsonTreeView component (keeps internal expansion state)

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, color: '#3A86FF', textShadow: '0 0 5px currentColor' }}>{node.name}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setIsFullscreen(!isFullscreen)} title="Toggle fullscreen" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#cfe', padding: '6px 8px', borderRadius: 6 }}>
            {isFullscreen ? '🗗' : '🗖'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => setActiveTab('summary')} style={{ padding: '6px 10px', borderRadius: 6, background: activeTab === 'summary' ? '#00283a' : 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#cfe' }}>Summary</button>
        <button onClick={() => setActiveTab('inspect')} style={{ padding: '6px 10px', borderRadius: 6, background: activeTab === 'inspect' ? '#00283a' : 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#cfe' }}>Inspect</button>
        <button onClick={() => setActiveTab('labels')} style={{ padding: '6px 10px', borderRadius: 6, background: activeTab === 'labels' ? '#00283a' : 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#cfe' }}>Labels</button>
      </div>

      <div style={{ marginTop: 12 }}>
        {activeTab === 'summary' && (
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            <div><strong style={{ color: '#FFBE0B' }}>Type:</strong> {node.kind}</div>
            <div><strong style={{ color: '#FFBE0B' }}>ID:</strong> {String(node.id)?.substring(0, 12)}...</div>
            {node.attributes && Object.entries(node.attributes).map(([k, v]) => (
              <div key={k}><strong style={{ color: '#FFBE0B' }}>{k}:</strong> {String(v)}</div>
            ))}
          </div>
        )}

        {activeTab === 'inspect' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
              <button onClick={copyInspect} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.12)', color: '#cfe' }}>Copy</button>
            </div>
            <div style={{ marginTop: 6 }}>
              {loading && <div style={{ fontSize: 12 }}>Loading…</div>}
              {err && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#f66' }}>{err}</pre>}
              {inspectJSON && (() => {
                try {
                  const parsed = JSON.parse(inspectJSON)
                  return (
                    <div style={{ maxHeight: isFullscreen ? '70vh' : '60vh', overflow: 'auto', padding: 8, borderRadius: 8, background: '#06111a' }}>
                      <JsonTreeView data={parsed} rootName={parsed?.Name || parsed?.Id || 'inspect'} />
                    </div>
                  )
                } catch (e) {
                  return (
                    <pre style={{ maxHeight: isFullscreen ? '70vh' : '60vh', overflow: 'auto', fontSize: 12, background: '#06111a', color: '#cfe', padding: 12, borderRadius: 8 }}>{inspectJSON}</pre>
                  )
                }
              })()}
              {!loading && !err && !inspectJSON && (<div style={{ fontSize: 12, color: '#888' }}>No data</div>)}
            </div>
          </div>
        )}

        {activeTab === 'labels' && (
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 8, color: '#FFBE0B' }}>Labels</div>
            {/* Prefer labels from inspect JSON (server response). Fallback to node attributes if inspect not available. */}
            {(() => {
              // Try to extract labels from the inspect JSON first
              let labelsObj: any = null
              if (inspectJSON) {
                try {
                  const parsed = JSON.parse(inspectJSON)
                  // Docker inspect returns an object; labels are often at top-level 'Labels' or under 'Config.Labels'
                  labelsObj = parsed?.Labels ?? parsed?.Config?.Labels ?? null
                } catch (e) {
                  // inspectJSON might not be valid JSON here; ignore
                  labelsObj = null
                }
              }

              // Fallback to node attributes / node.labels
              if (!labelsObj) {
                const attrs: any = node?.attributes ?? {}
                labelsObj = attrs.labels ?? attrs.Labels ?? null
              }

              if (labelsObj && Object.keys(labelsObj).length > 0) {
                // If labels are a flat map, convert to nested tree for display
                const labelTree = buildLabelTree(labelsObj)
                return (
                  <div style={{ maxHeight: isFullscreen ? '70vh' : '60vh', overflow: 'auto', padding: 8, borderRadius: 8, background: '#06111a' }}>
                    <JsonTreeView data={labelTree} rootName="labels" />
                  </div>
                )
              }

              return <div style={{ fontSize: 12, color: '#888' }}>No labels</div>
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export default NodeDetails

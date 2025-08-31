import React, { useState, useEffect } from 'react'
import SwarmGraph from './SwarmGraph/SwarmGraph'
import useDockerGraph from './hooks/useDockerGraph'

function SimpleNode({ n }) {
  const name = n.name || n.Name || n.id || 'unknown'
  const kind = n.kind || n.Kind || ''
  const attrs = n.attributes || n.Attributes || {}
  return (
    <div className="node">
      <div className="node-title">
        {name} <span className="node-kind">{kind}</span>
      </div>
      <div className="node-attrs">
        {attrs &&
          Object.entries(attrs).map(([k, v]) => (
            <div key={k} className="attr">
              <strong>{k}:</strong> {String(v)}
            </div>
          ))}
      </div>
    </div>
  )
}

export default function App() {
  const data = useDockerGraph({
    url: 'http://localhost:9123/graph.json',
    interval: 100_000_000,
  })

  const [node_count, setNodeCount] = useState(0)
  const [edge_count, setEdgeCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    if (data) {
      setNodeCount(data.nodes.length)
      setEdgeCount(data.edges.length)
      setLoading(data?.loading)
      setError(data?.error)
    }
  }, [data])

  console.log('Got data:', data)

  return (
    <div className="app">
      <header>
        <h1>Swarm Graph — Debug UI</h1>
        <div className="meta">
          nodes: {node_count} edges: {edge_count}
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showTable}
              onChange={() => setShowTable((s) => !s)}
              style={{ marginRight: 8 }}
            />
            Show raw node table
          </label>
        </div>
      </header>
      <main>
        {loading && <div className="meta">loading…</div>}
        {error && <div className="error">Error: {error}</div>}
        <div>
          {showTable ? (
            <div className="nodes">
              {data &&
                data.nodes &&
                Object.values(data.nodes).map((n) => (
                  <SimpleNode n={n} key={n.ID || n.id || n.Name || n.name} />
                ))}
            </div>
          ) : (
            <SwarmGraph data={data} />
          )}
        </div>
      </main>
    </div>
  )
}

import React, {useState, useEffect} from 'react'
import SwarmGraph from './SwarmGraph'
import useDockerGraph from './hooks/useDockerGraph'

function Node({ n }) {
  const name = n.name || n.Name || n.id || 'unknown'
  const kind = n.kind || n.Kind || ''
  const attrs = n.attributes || n.Attributes || {}
  return (
    <div className="node">
      <div className="node-title">{name} <span className="node-kind">{kind}</span></div>
      <div className="node-attrs">
        {attrs && Object.entries(attrs).map(([k, v]) => (
          <div key={k} className="attr"><strong>{k}:</strong> {String(v)}</div>
        ))}
      </div>
    </div>
  )
}

export default function App(){
  const data = useDockerGraph({ url: 'http://localhost:9123/graph.json', interval: 100_000_000 })

  const [node_count, setNodeCount] = useState(0)
  const [edge_count, setEdgeCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (data) {
      setNodeCount(data.nodes.length);
      setEdgeCount(data.edges.length);
      setLoading(data?.loading);
      setError(data?.error);
    }
  }, [data]);

  console.log('Got data:', data)

  return (
    <div className="app">
      <header>
        <h1>Swarm Graph — Debug UI</h1>
        <div className="meta">nodes: {node_count} edges: {edge_count}</div>
      </header>
      <main>
        {loading && <div className="meta">loading…</div>}
        {error && <div className="error">Error: {error}</div>}
        {/* <div className="nodes">
          {nodes.map(n => <Node n={n} key={n.ID} />)}
        </div> */}
        <SwarmGraph data={data}/>
      </main>
    </div>
  )
}

import React from 'react'
import { GraphNode } from './types'
import { styles } from './SwarmGraphStyles'

interface NodeDetailsProps {
    node: GraphNode | undefined
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ node }) => {
  if (!node) return null
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
      </div>
    </div>
  )
}

export default NodeDetails

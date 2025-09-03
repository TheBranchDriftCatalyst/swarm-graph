import React, { useState } from 'react'

interface JsonTreeViewProps {
  data: any
  rootName?: string
  className?: string
  style?: React.CSSProperties
  // optional initial expanded paths
  initialExpanded?: string[]
}

const JsonTreeView: React.FC<JsonTreeViewProps> = ({ data, rootName, className, style, initialExpanded }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    const list: string[] = initialExpanded || []
    list.forEach((p: string) => {
      map[p] = true
    })
    return map
  })

  const toggle = (path: string) => {
    setExpanded((s) => ({ ...s, [path]: !s[path] }))
  }

  const renderNode = (d: any, path = ''): React.ReactNode => {
    if (d === null || d === undefined) {
      return <span style={{ color: '#888' }}>null</span>
    }
    if (typeof d !== 'object') {
      return <span style={{ color: '#cfe' }}>{String(d)}</span>
    }

    if (Array.isArray(d)) {
      return (
        <div style={{ marginLeft: 12 }}>
          [{d.length}]
          {d.map((item: any, i: number) => (
            <div key={i} style={{ marginTop: 6 }}>
              <div style={{ color: '#9bdcff' }}>{i}:</div>
              <div style={{ marginLeft: 8 }}>{renderNode(item, `${path}.${i}`)}</div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div style={{ marginLeft: 8 }}>
        {Object.entries(d as Record<string, any>).map(([k, v]) => {
          const childPath = path ? `${path}.${k}` : k
          const isObject = v && typeof v === 'object'
          return (
            <div key={childPath} style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isObject ? (
                  <button
                    onClick={() => toggle(childPath)}
                    style={{ background: 'transparent', border: 'none', color: '#6fbfff', cursor: 'pointer' }}
                    aria-label={expanded[childPath] ? 'collapse' : 'expand'}
                  >
                    {expanded[childPath] ? '\u25be' : '\u25b8'}
                  </button>
                ) : (
                  <span style={{ width: 14 }} />
                )}
                <strong style={{ color: '#FFBE0B' }}>{k}</strong>
                <span>:</span>
                {!isObject && <span style={{ marginLeft: 6 }}>{String(v)}</span>}
              </div>
              {isObject && expanded[childPath] && <div style={{ marginLeft: 18 }}>{renderNode(v, childPath)}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={className} style={{ fontSize: 12, color: '#cfe', ...style }}>
      {rootName && <div style={{ color: '#9bdcff', marginBottom: 6 }}>{rootName}</div>}
      {renderNode(data, rootName || '')}
    </div>
  )
}

export default JsonTreeView

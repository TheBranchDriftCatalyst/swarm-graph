import React from 'react'
import { useGraphFilters } from './hooks/useGraphFilters'
import { NodeKind, EdgeKind } from '../types'
import { NodeStatusFilter, NodeConnectionFilter } from './context/GraphContext'

const FilterPanel: React.FC<{ isVisible: boolean; onToggle: () => void }> = ({ 
  isVisible, 
  onToggle 
}) => {
  const {
    filters,
    toggleNodeVisibility,
    toggleEdgeVisibility,
    setStatusFilter,
    setConnectionFilter,
    setSearchQuery,
    toggleOrphanedOnly,
    toggleRunningOnly,
    toggleInUseOnly,
    toggleSystemResources,
    resetFilters,
    showOnlyOrphaned,
    showOnlyRunning,
    showMinimalView,
  } = useGraphFilters()

  const nodeTypes: { kind: NodeKind; label: string; color: string }[] = [
    { kind: 'container', label: 'Containers', color: '#4CAF50' },
    { kind: 'image', label: 'Images', color: '#2196F3' },
    { kind: 'network', label: 'Networks', color: '#FF9800' },
    { kind: 'volume', label: 'Volumes', color: '#9C27B0' },
  ]

  const edgeTypes: { kind: EdgeKind; label: string }[] = [
    { kind: 'derived_from', label: 'Derived From' },
    { kind: 'connected_to', label: 'Connected To' },
    { kind: 'mounted_into', label: 'Mounted Into' },
  ]

  const statusFilters: { value: NodeStatusFilter; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'running', label: 'Running' },
    { value: 'stopped', label: 'Stopped' },
    { value: 'in-use', label: 'In Use' },
  ]

  const connectionFilters: { value: NodeConnectionFilter; label: string }[] = [
    { value: 'all', label: 'All Nodes' },
    { value: 'connected', label: 'Connected' },
    { value: 'orphaned', label: 'Orphaned' },
  ]

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: '60px',
    right: isVisible ? '0' : '-400px',
    width: '380px',
    height: 'calc(100vh - 60px)',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    backdropFilter: 'blur(10px)',
    color: 'white',
    padding: '20px',
    overflowY: 'auto',
    transition: 'right 0.3s ease-in-out',
    zIndex: 1000,
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
  }

  const toggleButtonStyle: React.CSSProperties = {
    position: 'fixed',
    top: '70px',
    right: isVisible ? '390px' : '10px',
    width: '40px',
    height: '40px',
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '50%',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease-in-out',
    zIndex: 1001,
    fontSize: '16px',
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '16px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#fff',
  }

  const checkboxStyle: React.CSSProperties = {
    marginRight: '8px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '14px',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    margin: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background-color 0.2s',
  }

  const presetButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: 'rgba(76, 175, 80, 0.5)',
  }

  return (
    <>
      <button
        style={toggleButtonStyle}
        onClick={onToggle}
        title="Toggle Filters"
      >
        🔧
      </button>
      
      <div style={panelStyle}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Graph Filters
          </h3>
          
          {/* Search */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Search</div>
            <input
              type="text"
              placeholder="Search nodes..."
              value={filters.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Quick Presets */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Quick Filters</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <button style={presetButtonStyle} onClick={showOnlyOrphaned}>
                Show Orphaned
              </button>
              <button style={presetButtonStyle} onClick={showOnlyRunning}>
                Show Running
              </button>
              <button style={presetButtonStyle} onClick={showMinimalView}>
                Minimal View
              </button>
              <button style={buttonStyle} onClick={resetFilters}>
                Reset All
              </button>
            </div>
          </div>

          {/* Node Types */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Node Types</div>
            {nodeTypes.map(({ kind, label, color }) => (
              <label
                key={kind}
                style={{
                  ...labelStyle,
                  backgroundColor: filters.visibleNodes[kind] 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = filters.visibleNodes[kind] 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.visibleNodes[kind]}
                  onChange={() => toggleNodeVisibility(kind)}
                  style={checkboxStyle}
                />
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: color,
                    borderRadius: '50%',
                    marginRight: '8px',
                    display: 'inline-block',
                  }}
                />
                {label}
              </label>
            ))}
          </div>

          {/* Edge Types */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Edge Types</div>
            {edgeTypes.map(({ kind, label }) => (
              <label
                key={kind}
                style={{
                  ...labelStyle,
                  backgroundColor: filters.visibleEdges[kind] 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = filters.visibleEdges[kind] 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.visibleEdges[kind]}
                  onChange={() => toggleEdgeVisibility(kind)}
                  style={checkboxStyle}
                />
                {label}
              </label>
            ))}
          </div>

          {/* Status Filter */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Status Filter</div>
            <select
              value={filters.statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as NodeStatusFilter)}
              style={selectStyle}
            >
              {statusFilters.map(({ value, label }) => (
                <option key={value} value={value} style={{ backgroundColor: '#333' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Connection Filter */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Connection Filter</div>
            <select
              value={filters.connectionFilter}
              onChange={(e) => setConnectionFilter(e.target.value as NodeConnectionFilter)}
              style={selectStyle}
            >
              {connectionFilters.map(({ value, label }) => (
                <option key={value} value={value} style={{ backgroundColor: '#333' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Filters */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Advanced Filters</div>
            
            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={filters.showOrphanedOnly}
                onChange={toggleOrphanedOnly}
                style={checkboxStyle}
              />
              Show orphaned nodes only
            </label>

            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={filters.showRunningOnly}
                onChange={toggleRunningOnly}
                style={checkboxStyle}
              />
              Show running containers only
            </label>

            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={filters.showInUseOnly}
                onChange={toggleInUseOnly}
                style={checkboxStyle}
              />
              Show in-use resources only
            </label>

            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={filters.hideSystemResources}
                onChange={toggleSystemResources}
                style={checkboxStyle}
              />
              Hide system resources
            </label>
          </div>

          {/* Filter Summary */}
          <div style={{ 
            fontSize: '12px', 
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '16px',
            padding: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px'
          }}>
            <div>Active Filters:</div>
            <div>
              • Status: {filters.statusFilter}
              {filters.showOrphanedOnly && ' • Orphaned only'}
              {filters.showRunningOnly && ' • Running only'}
              {filters.showInUseOnly && ' • In-use only'}
              {filters.hideSystemResources && ' • No system resources'}
              {filters.searchQuery && ` • Search: "${filters.searchQuery}"`}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default FilterPanel

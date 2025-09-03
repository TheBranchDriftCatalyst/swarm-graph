import React from 'react'
import { useGraphFilters } from './hooks/useGraphFilters'
import { useGraphState } from './hooks/useGraphState'
import { styles, colors } from './SwarmGraphStyles'
import { 
  FilterPanelProps,
  NODE_TYPE_OPTIONS,
  EDGE_TYPE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  CONNECTION_FILTER_OPTIONS,
  NodeStatusFilter,
  NodeConnectionFilter
} from './types/filterTypes'
import { clearPersistedFilters } from './context/GraphContext'

const FilterPanel: React.FC<FilterPanelProps> = ({ isVisible, onToggle }) => {
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
    excludeNode,
    includeNode,
    clearExcluded,
  } = useGraphFilters()

  const { getNodeInfo } = useGraphState()

  // Dynamic styles based on visibility
  const panelStyle = {
    ...styles.filterPanel,
    right: isVisible ? '0' : '-420px',
  }

  const toggleButtonStyle = {
    ...styles.filterToggleButton,
    right: isVisible ? '420px' : '20px',
    transform: isVisible ? 'rotate(180deg)' : 'rotate(0deg)',
  }

  // Enhanced hover effects
  const getHoverableStyle = (baseStyle: React.CSSProperties, isActive?: boolean) => ({
    ...baseStyle,
    backgroundColor: isActive 
      ? 'rgba(0, 212, 255, 0.15)' 
      : baseStyle.backgroundColor,
    borderColor: isActive 
      ? 'rgba(0, 212, 255, 0.5)' 
      : baseStyle.borderColor,
  })

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget as HTMLElement
    target.style.backgroundColor = 'rgba(0, 212, 255, 0.15)'
    target.style.borderColor = 'rgba(0, 212, 255, 0.5)'
    target.style.transform = 'translateX(-2px)'
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>, isActive?: boolean) => {
    const target = e.currentTarget as HTMLElement
    target.style.backgroundColor = isActive 
      ? 'rgba(0, 212, 255, 0.15)' 
      : 'rgba(0, 212, 255, 0.1)'
    target.style.borderColor = isActive 
      ? 'rgba(0, 212, 255, 0.5)' 
      : 'rgba(0, 212, 255, 0.3)'
    target.style.transform = 'translateX(0px)'
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#00D4FF'
    e.target.style.boxShadow = '0 0 0 2px rgba(0, 212, 255, 0.2)'
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(0, 212, 255, 0.3)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <>
      <button
        style={toggleButtonStyle}
        onClick={onToggle}
        title="Toggle Filters"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 212, 255, 0.2)'
          e.currentTarget.style.boxShadow = '0 6px 25px rgba(0, 212, 255, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(10, 14, 39, 0.95)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 255, 0.3)'
        }}
      >
        ⚙️
      </button>
      
      <div style={panelStyle}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: '#00D4FF',
            textShadow: '0 0 12px currentColor',
            letterSpacing: '1px'
          }}>
            Graph Filters
          </h3>
          
          {/* Search */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Search</div>
            <input
              type="text"
              placeholder="Search nodes by name or ID..."
              value={filters.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.filterInput}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>

          {/* Quick Presets */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Quick Filters</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button 
                style={styles.filterPresetButton} 
                onClick={showOnlyOrphaned}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.25)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.15)'
                  e.currentTarget.style.transform = 'translateY(0px)'
                }}
              >
                🔍 Orphaned
              </button>
              <button 
                style={styles.filterPresetButton} 
                onClick={showOnlyRunning}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.25)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.15)'
                  e.currentTarget.style.transform = 'translateY(0px)'
                }}
              >
                ▶️ Running
              </button>
              <button 
                style={styles.filterPresetButton} 
                onClick={showMinimalView}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.25)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.15)'
                  e.currentTarget.style.transform = 'translateY(0px)'
                }}
              >
                🎯 Minimal
              </button>
              <button 
                style={styles.filterButton} 
                onClick={resetFilters}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 212, 255, 0.1)'
                  e.currentTarget.style.transform = 'translateY(0px)'
                }}
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {/* Node Types */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Node Types</div>
            {NODE_TYPE_OPTIONS.map(({ kind, label, color }) => (
              <label
                key={kind}
                style={getHoverableStyle(styles.filterLabel, filters.visibleNodes[kind])}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={(e) => handleMouseLeave(e, filters.visibleNodes[kind])}
              >
                <input
                  type="checkbox"
                  checked={filters.visibleNodes[kind]}
                  onChange={() => toggleNodeVisibility(kind)}
                  style={{ marginRight: '12px', transform: 'scale(1.2)' }}
                />
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    backgroundColor: color,
                    borderRadius: '50%',
                    marginRight: '10px',
                    display: 'inline-block',
                    boxShadow: `0 0 8px ${color}40`,
                  }}
                />
                {label}
              </label>
            ))}
          </div>

                <button
                  style={{ ...styles.filterButton, backgroundColor: 'rgba(255, 80, 80, 0.12)' }}
                  onClick={() => {
                    clearPersistedFilters()
                    resetFilters()
                  }}
                  title="Clear saved filters from local storage and reset"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 80, 80, 0.2)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 80, 80, 0.12)'
                    e.currentTarget.style.transform = 'translateY(0px)'
                  }}
                >
                  🗑️ Clear Saved
                </button>
          {/* Edge Types */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Edge Types</div>
            {EDGE_TYPE_OPTIONS.map(({ kind, label }) => (
              <label
                key={kind}
                style={getHoverableStyle(styles.filterLabel, filters.visibleEdges[kind])}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={(e) => handleMouseLeave(e, filters.visibleEdges[kind])}
              >
                <input
                  type="checkbox"
                  checked={filters.visibleEdges[kind]}
                  onChange={() => toggleEdgeVisibility(kind)}
                  style={{ marginRight: '12px', transform: 'scale(1.2)' }}
                />
                <span style={{ 
                  fontSize: '12px', 
                  color: colors.edge[kind],
                  marginRight: '8px'
                }}>
                  ━━
                </span>
                {label}
              </label>
            ))}
          </div>

          {/* Status Filter */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Status Filter</div>
            <select
              value={filters.statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as NodeStatusFilter)}
              style={styles.filterSelect}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            >
              {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} style={{ backgroundColor: '#0A0E27' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Connection Filter */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Connection Filter</div>
            <select
              value={filters.connectionFilter}
              onChange={(e) => setConnectionFilter(e.target.value as NodeConnectionFilter)}
              style={styles.filterSelect}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            >
              {CONNECTION_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} style={{ backgroundColor: '#0A0E27' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Filters */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Advanced Filters</div>
            
            <label
              style={getHoverableStyle(styles.filterLabel, filters.showOrphanedOnly)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={(e) => handleMouseLeave(e, filters.showOrphanedOnly)}
            >
              <input
                type="checkbox"
                checked={filters.showOrphanedOnly}
                onChange={toggleOrphanedOnly}
                style={{ marginRight: '12px', transform: 'scale(1.2)' }}
              />
              🔍 Show orphaned nodes only
            </label>

            <label
              style={getHoverableStyle(styles.filterLabel, filters.showRunningOnly)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={(e) => handleMouseLeave(e, filters.showRunningOnly)}
            >
              <input
                type="checkbox"
                checked={filters.showRunningOnly}
                onChange={toggleRunningOnly}
                style={{ marginRight: '12px', transform: 'scale(1.2)' }}
              />
              ▶️ Show running containers only
            </label>

            <label
              style={getHoverableStyle(styles.filterLabel, filters.showInUseOnly)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={(e) => handleMouseLeave(e, filters.showInUseOnly)}
            >
              <input
                type="checkbox"
                checked={filters.showInUseOnly}
                onChange={toggleInUseOnly}
                style={{ marginRight: '12px', transform: 'scale(1.2)' }}
              />
              💾 Show in-use resources only
            </label>

            <label
              style={getHoverableStyle(styles.filterLabel, filters.hideSystemResources)}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={(e) => handleMouseLeave(e, filters.hideSystemResources)}
            >
              <input
                type="checkbox"
                checked={filters.hideSystemResources}
                onChange={toggleSystemResources}
                style={{ marginRight: '12px', transform: 'scale(1.2)' }}
              />
              🚫 Hide system resources
            </label>
          </div>

          {/* Excluded Nodes */}
          <div style={styles.filterSection}>
            <div style={styles.filterSectionTitle}>Excluded Nodes</div>
            {filters.excludedNodeIds && filters.excludedNodeIds.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filters.excludedNodeIds.map((id) => {
                  const info = getNodeInfo(id)
                  const label = info ? (info.name || info.Name || info.id) : id
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#FFF', opacity: 0.9 }}>{label}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          style={styles.smallButton}
                          onClick={() => includeNode(id)}
                          title="Include back"
                        >
                          ➕
                        </button>
                        <button
                          style={styles.smallButton}
                          onClick={() => includeNode(id)}
                          title="Remove from excluded list"
                        >
                          ✖️
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button style={styles.filterButton} onClick={clearExcluded}>Clear Excluded</button>
              </div>
            ) : (
              <div style={{ color: '#9AA0B4' }}>No excluded nodes</div>
            )}
          </div>
          {/* Filter Summary */}
          <div style={styles.filterSummary}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00D4FF' }}>
              Active Filters Summary
            </div>
            <div style={{ lineHeight: '1.6' }}>
              • Status: <strong>{filters.statusFilter}</strong>
              {filters.showOrphanedOnly && (
                <><br />• 🔍 <strong>Orphaned only</strong></>
              )}
              {filters.showRunningOnly && (
                <><br />• ▶️ <strong>Running only</strong></>
              )}
              {filters.showInUseOnly && (
                <><br />• 💾 <strong>In-use only</strong></>
              )}
              {filters.hideSystemResources && (
                <><br />• 🚫 <strong>No system resources</strong></>
              )}
              {filters.searchQuery && (
                <><br />• 🔍 Search: <strong>"{filters.searchQuery}"</strong></>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default FilterPanel

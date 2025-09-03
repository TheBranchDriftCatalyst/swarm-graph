import { CSSProperties } from 'react'
import { NodeKind, EdgeKind } from '../types'

export const colors: { [k: string]: any; edge: Record<EdgeKind, string> } = {
  container: '#00D4FF', // Bright cyan for containers
  network: '#FFD700', // Golden yellow for networks
  image: '#FF6B35', // Orange-red for images
  volume: '#9D4EDD', // Purple for volumes
  background: '#0A0E27',
  grid: '#2A3B5C', // Lighter grid for better visibility
  glow: '#00D4FF',
  text: '#FFFFFF',
  edge: {
    derived_from: '#FF6B35', // Orange for image derivation
    connected_to: '#00D4FF', // Cyan for network connections
    mounted_into: '#FFD700', // Gold for volume mounts
  },
}

export const nodeIcons: Record<NodeKind, string> = {
  // NOTE: we want to ensure that this is the final fallback for the visible icon
  container: '📦', // More intuitive container icon
  network: '🌐', // Globe for network
  image: '💿', // Disc for image
  volume: '💾', // Floppy disk for volume
}

export const styles: {
  container: CSSProperties
  legend: CSSProperties
  legendTitle: CSSProperties
  legendList: CSSProperties
  infoPanel: CSSProperties
  title: CSSProperties
  filterPanel: CSSProperties
  filterToggleButton: CSSProperties
  filterSection: CSSProperties
  filterSectionTitle: CSSProperties
  filterLabel: CSSProperties
  filterInput: CSSProperties
  filterSelect: CSSProperties
  filterButton: CSSProperties
  filterPresetButton: CSSProperties
  filterSummary: CSSProperties
} = {
  container: {
    width: '100%',
    /* keep some room for the app header/footer so graph doesn't trigger page scrollbars */
    height: 'calc(100vh - 120px)',
    position: 'relative',
    background: 'linear-gradient(to bottom, #0A0E27, #1A1E3A)',
    overflow: 'hidden',
    fontFamily: 'monospace',
  },
  legend: {
    position: 'absolute',
    top: 20,
    left: 20,
    background: 'rgba(10, 14, 39, 0.95)',
    border: '2px solid #00D4FF',
    borderRadius: '12px',
    padding: '16px',
    color: '#FFFFFF',
    boxShadow: '0 8px 32px rgba(0, 212, 255, 0.3)',
    backdropFilter: 'blur(16px)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  legendTitle: {
    margin: '0 0 12px 0',
    color: '#00D4FF',
    textShadow: '0 0 8px currentColor',
    fontSize: '14px',
    fontWeight: '700',
  },
  legendList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '60vh',
    overflowY: 'auto',
    paddingRight: 8,
  },
  infoPanel: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'rgba(10, 14, 39, 0.95)',
    border: '2px solid #00D4FF',
    borderRadius: '12px',
    padding: '18px',
    color: '#FFFFFF',
    maxWidth: '320px',
    maxHeight: '60vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 212, 255, 0.3)',
    backdropFilter: 'blur(16px)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '20px',
    fontWeight: 'bold',
    background: 'linear-gradient(90deg, #FF006E, #3A86FF, #FFBE0B)',
    // CSSProperties is strict about vendor-prefixed names; cast where necessary
    WebkitBackgroundClip: 'text' as any,
    WebkitTextFillColor: 'transparent' as any,
    textShadow: '0 0 30px rgba(255, 0, 110, 0.5)',
    letterSpacing: '5px',
  },
  filterPanel: {
    position: 'fixed',
    top: '60px',
    width: '400px',
    height: 'calc(100vh - 60px)',
    background: 'rgba(10, 14, 39, 0.98)',
    backdropFilter: 'blur(20px)',
    border: '2px solid #00D4FF',
    borderTop: 'none',
    borderBottom: 'none',
    color: '#FFFFFF',
    padding: '24px',
    overflowY: 'auto',
    transition: 'right 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    zIndex: 1000,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    boxShadow: '0 0 50px rgba(0, 212, 255, 0.2)',
  },
  filterToggleButton: {
    position: 'fixed',
    top: '80px',
    width: '48px',
    height: '48px',
    background: 'rgba(10, 14, 39, 0.95)',
    border: '2px solid #00D4FF',
    borderRadius: '50%',
    color: '#00D4FF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    zIndex: 1001,
    fontSize: '18px',
    boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
    backdropFilter: 'blur(10px)',
  },
  filterSection: {
    marginBottom: '28px',
    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
    paddingBottom: '20px',
  },
  filterSectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#00D4FF',
    textShadow: '0 0 8px currentColor',
    letterSpacing: '0.5px',
  },
  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
    fontSize: '13px',
  },
  filterInput: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  filterSelect: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300D4FF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    paddingRight: '40px',
  },
  filterButton: {
    padding: '8px 12px',
    margin: '4px',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '6px',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  filterPresetButton: {
    padding: '8px 12px',
    margin: '4px',
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    border: '1px solid rgba(255, 107, 53, 0.4)',
    borderRadius: '6px',
    color: '#FF6B35',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  filterSummary: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: '20px',
    padding: '12px',
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    borderLeft: '3px solid #00D4FF',
    borderRadius: '4px',
    lineHeight: '1.4',
  },
}

export default {
  colors,
  nodeIcons,
  styles,
}

import { CSSProperties } from 'react'
import { NodeKind, EdgeKind } from '../types'

export const colors: { [k: string]: any; edge: Record<EdgeKind, string> } = {
  container: '#00D4FF',     // Bright cyan for containers
  network: '#FFD700',       // Golden yellow for networks  
  image: '#FF6B35',         // Orange-red for images
  volume: '#9D4EDD',        // Purple for volumes
  background: '#0A0E27',
  grid: '#2A3B5C',          // Lighter grid for better visibility
  glow: '#00D4FF',
  text: '#FFFFFF',
  edge: {
    derived_from: '#FF6B35',    // Orange for image derivation
    connected_to: '#00D4FF',    // Cyan for network connections
    mounted_into: '#FFD700',    // Gold for volume mounts
  },
}

export const nodeIcons: Record<NodeKind, string> = {
  container: '📦',  // More intuitive container icon
  network: '🌐',   // Globe for network
  image: '💿',     // Disc for image
  volume: '💾',    // Floppy disk for volume
}

export const styles: {
  container: CSSProperties
  legend: CSSProperties
  legendTitle: CSSProperties
  legendList: CSSProperties
  infoPanel: CSSProperties
  title: CSSProperties
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
}

export default {
  colors,
  nodeIcons,
  styles,
}

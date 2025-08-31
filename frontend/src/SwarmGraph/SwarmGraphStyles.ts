import { CSSProperties } from 'react'
import { NodeKind, EdgeKind } from './types'

export const colors: { [k: string]: any; edge: Record<EdgeKind, string> } = {
  container: '#FF006E',
  network: '#FFBE0B',
  image: '#FB5607',
  volume: '#8338EC',
  background: '#0A0E27',
  grid: '#1E2749',
  glow: '#3A86FF',
  text: '#F72585',
  edge: {
    derived_from: '#FF006E',
    connected_to: '#3A86FF',
    mounted_into: '#FFBE0B',
  },
}

export const nodeIcons: Record<NodeKind, string> = {
  container: '⬢',
  network: '◈',
  image: '◉',
  volume: '▣',
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
    background: 'rgba(10, 14, 39, 0.8)',
    border: '1px solid #FF006E',
    borderRadius: '8px',
    padding: '12px',
    color: '#FFFFFF',
    boxShadow: '0 0 20px rgba(255, 0, 110, 0.5)',
    backdropFilter: 'blur(10px)',
  },
  legendTitle: {
    margin: '0 0 10px 0',
    color: '#FF006E',
    textShadow: '0 0 5px currentColor',
  },
  legendList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '60vh',
    overflowY: 'auto',
    paddingRight: 6,
  },
  infoPanel: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'rgba(10, 14, 39, 0.9)',
    border: '1px solid #3A86FF',
    borderRadius: '8px',
    padding: '15px',
    color: '#FFFFFF',
    maxWidth: '300px',
    maxHeight: '60vh',
    overflowY: 'auto',
    boxShadow: '0 0 20px rgba(58, 134, 255, 0.5)',
    backdropFilter: 'blur(10px)',
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

import React from 'react'
import { NodeData } from '../interfaces'
import { NodeKind } from '../../types'
import { colors, nodeIcons } from '../SwarmGraphStyles'

export interface NodeIconProps {
  data: NodeData
  width: number
  height: number
  pad: number
  imgSize: number
  showLogo?: boolean
}

const vendorLogos: Record<string, string> = {
  whoami:
    'https://raw.githubusercontent.com/devicons/devicon/master/icons/nginx/nginx-original.svg',
  redis:
    'https://raw.githubusercontent.com/devicons/devicon/master/icons/redis/redis-original.svg',
  postgres:
    'https://raw.githubusercontent.com/devicons/devicon/master/icons/postgresql/postgresql-original.svg',
}

const ContainerNode: React.FC<NodeIconProps> = ({ data, width, pad, imgSize, showLogo = true }) => {
  const imageRef = (data.attributes && data.attributes.image) || ''
  let logoUrl: string | undefined
  if (imageRef) {
    const parts = String(imageRef).split('/')
    const last = parts[parts.length - 1].split(':')[0]
    if (vendorLogos[last]) logoUrl = vendorLogos[last]
  }

  const shouldShowLogo = showLogo !== false && !!logoUrl

  if (shouldShowLogo && logoUrl) {
    return (
      <image
        href={logoUrl}
        x={-width / 2 + pad}
        y={-imgSize / 2}
        width={imgSize}
        height={imgSize}
        preserveAspectRatio="xMidYMid meet"
      />
    )
  }

  return (
    <text
      x={-width / 2 + pad + imgSize / 2}
      y={8}
      textAnchor="middle"
      fontSize={18}
      fill={colors[data.kind as NodeKind]}
    >
      {nodeIcons[data.kind as NodeKind]}
    </text>
  )
}

export default ContainerNode

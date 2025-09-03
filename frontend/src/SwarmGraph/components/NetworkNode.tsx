import React from 'react'
import { NodeData } from '../interfaces'
import { NodeKind } from '../../types'
import { colors, nodeIcons } from '../SwarmGraphStyles'

import ContainerNode from './ContainerNode'

const NetworkNode: React.FC<{
  data: NodeData
  width: number
  height: number
  pad: number
  imgSize: number
  showLogo?: boolean
}> = (props) => {
  // For now, network nodes reuse the container icon rendering. In future we
  // can implement specialized visuals (e.g., globe, subnet). Keeping a small
  // component lets us swap implementations without changing the parent.
  return <ContainerNode {...props} />
}

export default NetworkNode

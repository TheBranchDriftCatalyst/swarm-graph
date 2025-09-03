import React from 'react'
import ContainerNode from './ContainerNode'
import { NodeData } from '../interfaces'

const VolumeNode: React.FC<{ data: NodeData; width: number; height: number; pad: number; imgSize: number; showLogo?: boolean }> = (props) => {
  // Volume nodes may later display mountpoints or sizes; for now reuse the
  // simple icon rendering.
  return <ContainerNode {...props} />
}

export default VolumeNode

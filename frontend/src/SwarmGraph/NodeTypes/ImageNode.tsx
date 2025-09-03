import React from 'react'
import ContainerNode from './ContainerNode'
import { NodeData } from '../interfaces'

const ImageNode: React.FC<{ data: NodeData; width: number; height: number; pad: number; imgSize: number; showLogo?: boolean }> = (props) => {
  // Image nodes currently share the ContainerNode rendering. We keep the
  // separate component so we can add image-specific info (size, tags) later.
  return <ContainerNode {...props} />
}

export default ImageNode

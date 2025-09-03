import ContainerNode from './ContainerNode'
import NetworkNode from './NetworkNode'
import ImageNode from './ImageNode'
import VolumeNode from './VolumeNode'
import { NodeKind } from '../../types'

const NodeTypeMap: Record<NodeKind, any> = {
  container: ContainerNode,
  network: NetworkNode,
  image: ImageNode,
  volume: VolumeNode,
}

export default NodeTypeMap

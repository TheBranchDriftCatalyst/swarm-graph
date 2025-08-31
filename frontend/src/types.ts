// InfraGraph.ts

export type NodeID = string;

/** Top-level graph DTO */
export interface InfraGraphDTO {
  nodes: Record<NodeID, GraphNode>;
  edges: GraphEdge[];
}

/** ----- Nodes ----- */

export type NodeKind = 'container' | 'network' | 'image' | 'volume';

interface NodeBase<K extends NodeKind, A extends object> {
  id: NodeID;
  kind: K;
  name: string;
  attributes: A;
}

export type GraphNode =
  | ContainerNode
  | NetworkNode
  | ImageNode
  | VolumeNode;

export interface ContainerNode
  extends NodeBase<
    'container',
    {
      created: string;              // ISO8601
      image: string;                // e.g., "swarm-graph:dev"
      service: string;              // e.g., "backend"
      stack: string;                // e.g., "swarm-graph"
      status: string;               // e.g., "running"
    }
  > {}

export interface NetworkNode
  extends NodeBase<
    'network',
    {
      driver: string;               // e.g., "bridge", "host", "null"
      scope: string;                // e.g., "local"
    }
  > {}

export interface ImageNode
  extends NodeBase<
    'image',
    {
      digests: string;              // e.g., "repo@sha256:..."
      size: string;                 // bytes as string (matches sample)
      tags: string;                 // e.g., "swarm-graph:dev"
    }
  > {}

export interface VolumeNode
  extends NodeBase<
    'volume',
    {
      driver: string;               // e.g., "local"
      mountpoint: string;           // absolute path
      status: string;               // e.g., "in-use"
    }
  > {}

/** ----- Edges ----- */

export type EdgeKind = 'derived_from' | 'connected_to' | 'mounted_into';

interface EdgeBase<K extends EdgeKind, A extends object | undefined = undefined> {
  src: NodeID;
  dst: NodeID;
  kind: K;
  // Only include attributes if the edge kind defines them
  attributes?: A extends undefined ? never : A;
}

export type GraphEdge =
  | DerivedFromEdge
  | ConnectedToEdge
  | MountedIntoEdge;

export interface DerivedFromEdge
  extends EdgeBase<'derived_from'> {} // no attributes

export interface ConnectedToEdge
  extends EdgeBase<
    'connected_to',
    {
      ip: string;                   // e.g., "172.18.0.3"
    }
  > {}

export interface MountedIntoEdge
  extends EdgeBase<
    'mounted_into',
    {
      rw: 'true' | 'false';         // matches sample (string, not boolean)
      target: string;               // mount target inside container
    }
  > {}

/** ----- Type Guards (useful with the discriminants) ----- */

export function isContainerNode(n: GraphNode): n is ContainerNode {
  return n.kind === 'container';
}
export function isNetworkNode(n: GraphNode): n is NetworkNode {
  return n.kind === 'network';
}
export function isImageNode(n: GraphNode): n is ImageNode {
  return n.kind === 'image';
}
export function isVolumeNode(n: GraphNode): n is VolumeNode {
  return n.kind === 'volume';
}

export function isDerivedFromEdge(e: GraphEdge): e is DerivedFromEdge {
  return e.kind === 'derived_from';
}
export function isConnectedToEdge(e: GraphEdge): e is ConnectedToEdge {
  return e.kind === 'connected_to';
}
export function isMountedIntoEdge(e: GraphEdge): e is MountedIntoEdge {
  return e.kind === 'mounted_into';
}

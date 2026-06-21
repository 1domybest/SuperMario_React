import type { PipeSize } from '../primitives'

export type DrainageNodeKind =
  | 'catch-basin'
  | 'connector'
  | 'manhole'
  | 'storage'
  | 'outfall'
  | 'facility'

export type DrainageLinkKind =
  | 'conduit'
  | 'pump'
  | 'orifice'
  | 'weir'
  | 'outlet'

export interface DrainageNode {
  id: string
  swmmId: string
  name: string
  kind: DrainageNodeKind
  visualOwner?: string
  x?: number
  y?: number
  angle?: number
  size?: PipeSize
  connectorHeight?: number
}

export interface DrainageLink {
  id: string
  swmmId: string
  name: string
  kind: DrainageLinkKind
  fromNodeId: string
  toNodeId: string
  size: PipeSize
  length: number
  angle?: number
  slope?: number
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  absoluteAngle?: number
  outerThickness?: number
}

export interface DrainageGraphSnapshot {
  nodes: DrainageNode[]
  links: DrainageLink[]
}

export interface PendingDrainageLink {
  id: string
  swmmId: string
  name: string
  kind: DrainageLinkKind
  fromNodeId: string
  size: PipeSize
  length: number
  angle?: number
  slope?: number
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  absoluteAngle?: number
  outerThickness?: number
}

export type EditorNodeType =
  | 'apartment'
  | 'house'
  | 'catchBasin'
  | 'manhole'
  | 'facility'
  | 'connector'
  | 'elbowConnector'
  | 'teeConnector'
  | 'pipeSegment'
  | 'outfall'
  | 'road'
  | 'terrain'

export type EditorLinkType =
  | 'relation'
  | 'pipe'
  | 'elbowPipe'
  | 'connector'
  | 'pump'
  | 'weir'
  | 'outfall'

export type EditorPortSide = 'top' | 'right' | 'bottom' | 'left' | 'center'
export type EditorPipeSize = 'small' | 'medium' | 'large'

export interface EditorPort {
  id: string
  side: EditorPortSide
  label?: string
  offset?: number
}

export interface EditorNode {
  id: string
  swmmId: string
  name: string
  type: EditorNodeType
  x: number
  y: number
  width: number
  height: number
  ports: EditorPort[]
  props: Record<string, string | number | boolean>
}

export interface EditorEndpoint {
  nodeId: string
  portId: string
}

export interface EditorPoint {
  x: number
  y: number
}

export interface EditorAttachPoint {
  nodeId: string
  portId: string
  side: EditorPortSide
  ratio: number
  rawRatio: number
  point: EditorPoint
}

export interface EditorRelationAttachMetadata {
  parentEndpoint: EditorAttachPoint
  childEndpoint: EditorAttachPoint
  parentOnChild: EditorAttachPoint
  childOnParent: EditorAttachPoint
  aligned: boolean
}

export interface EditorLink {
  id: string
  swmmId: string
  name: string
  type: EditorLinkType
  from: EditorEndpoint
  to: EditorEndpoint
  size: EditorPipeSize
  props: {
    route: 'straight' | 'elbow'
    slope?: number
    length?: number
    blockage?: number
    pipeKind?: string
  }
  attach?: EditorRelationAttachMetadata
}

export interface EditorLayout {
  version: 1
  groundSurfaceY: number
  nodes: EditorNode[]
  links: EditorLink[]
}

export interface EditorPortSelection {
  nodeId: string
  portId: string
}

export type EditorSelection =
  | { kind: 'node'; id: string }
  | { kind: 'link'; id: string }
  | { kind: 'multi'; ids: string[] }
  | null

export const SURFACE_NODE_TYPES = new Set<EditorNodeType>([
  'apartment',
  'house',
  'road',
])

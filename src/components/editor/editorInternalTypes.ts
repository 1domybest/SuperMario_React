import type {
  EditorLayout,
  EditorLink,
  EditorNode,
  EditorPort,
  EditorPortSelection,
} from './editorTypes'

/** 편집기 geometry와 pointer handler에서 사용하는 SVG 캔버스 좌표다. */
export interface Point {
  x: number
  y: number
}

/** 편집기 캔버스 절대 좌표의 사각 경계다. */
export interface RectBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** 한 노드와 relation 그룹을 함께 이동할 때 쓰는 drag 상태다. */
export interface DragState {
  nodeId: string
  offsetX: number
  offsetY: number
  groupNodeIds: string[]
  originNodes: Record<string, Point>
}

/** 사용자가 영역 선택 박스를 드래그하는 동안의 pointer 상태다. */
export interface MarqueeSelectionState {
  start: Point
  current: Point
}

/** 붙여넣기 시 ID를 재생성하기 전에 복사/잘라내기로 보관한 nodes/links다. */
export interface CopiedEditorSelection {
  nodes: EditorNode[]
  links: EditorLink[]
}

/** 노드 외곽 사각형에서 resize 가능한 변이다. */
export type ResizeEdge = 'top' | 'right' | 'bottom' | 'left'

/** attach, 좌표 변경, 전파 계산에 사용하는 축이다. */
export type ChangeAxis = 'x' | 'y'

/** resize edge가 넘을 수 없는 선택적 고정 경계다. */
export type ResizeAnchorBounds = Partial<Record<ResizeEdge, number>>

/** resize가 attach anchor를 지나치지 않도록 사용하는 후보 경계점이다. */
export interface ResizeAnchorPoint {
  point: Point
  clearance: number
}

/** 현재 진행 중인 resize 인터랙션 상태다. */
export interface ResizeState {
  nodeId: string
  edge: ResizeEdge
  originNode: EditorNode
  edgePointerOffset: number
  anchorBounds: ResizeAnchorBounds
}

/** parent-to-child relation 업데이트 전파에 사용하는 context다. */
export interface ChildPropagationOptions {
  sourceLengthAxis?: ChangeAxis | null
}

/** 기존 지형 세그먼트에서 새 지형을 체인으로 붙일 수 있는 방향이다. */
export type LayoutAddSide = 'left' | 'right' | 'bottom'

/** relation 대상과 레이아웃 삽입 대상을 포함한 우클릭 메뉴 상태다. */
export interface ContextMenuState {
  x: number
  y: number
  point: Point
  nodeId?: string
  relationPort?: {
    linkId: string
    endpoint: EditorPortSelection
  }
  layoutAdd?: {
    side: LayoutAddSide
    bounds: RectBounds
    sourceNodeId?: string
  }
}

/** 파이프 면을 따라 attach 지점을 이동하는 좌표 변경 인터랙션 상태다. */
export interface CoordinateEditState {
  linkId: string
}

/** relation 링크 안에서 endpoint가 맡는 역할이다. */
export type RelationPortRole = 'parent' | 'child'

/** 좌표 변경 컨텍스트 메뉴 액션에 필요한 유효 relation 데이터다. */
export type CoordinateEditableRelationInfo = {
  relation: EditorLink
  parentNode: EditorNode
  parentPort: EditorPort
  childNode: EditorNode
  childPort: EditorPort
  axis: ChangeAxis
  mode: 'pipeAttach' | 'teeSlide'
  teeEndpoint?: EditorPortSelection
}

/** React state update 방식과 맞춘 layout setter 입력 타입이다. */
export type LayoutUpdate = EditorLayout | ((currentLayout: EditorLayout) => EditorLayout)

/** layout 업데이트를 undo/redo history에 반영할 때 사용하는 옵션이다. */
export interface LayoutSetOptions {
  recordHistory?: boolean
}

/** 편집기 layout의 undo/redo history 상태다. */
export interface LayoutHistoryState {
  present: EditorLayout
  past: EditorLayout[]
  future: EditorLayout[]
  batchStart: EditorLayout | null
}

/** layout 변경, batch, undo, redo를 처리하는 history reducer action이다. */
export type LayoutHistoryAction =
  | { type: 'apply'; update: LayoutUpdate; recordHistory: boolean }
  | { type: 'beginBatch' }
  | { type: 'commitBatch' }
  | { type: 'undo' }
  | { type: 'redo' }

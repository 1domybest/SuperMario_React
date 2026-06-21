import { EDITOR_NODE_PRESETS, createEditorPorts } from './defaultLayout'
import {
  ATTACH_TAP_CENTER_PERCENTAGE,
  CONNECTOR_LONG_SIDE_RATIO,
  CONNECTOR_SHORT_SIDE_RATIO,
  DEFAULT_FACILITY_KIND,
  DEFAULT_MANHOLE_KIND,
  DEFAULT_OUTFALL_KIND,
  DEFAULT_PIPE_KIND,
  DEFAULT_TERRAIN_KIND,
  FACILITY_KIND_BY_ID,
  FACILITY_KIND_DEFINITIONS,
  FACILITY_TAP_PORT_PERCENTAGES,
  FIXED_NODE_Y_BY_TYPE,
  LEGACY_PIPE_KIND_TO_KIND,
  MANHOLE_KIND_BY_ID,
  MANHOLE_KIND_DEFINITIONS,
  MIN_PIPE_SEGMENT_LENGTH,
  OUTFALL_KIND_BY_ID,
  OUTFALL_KIND_DEFINITIONS,
  PIPE_BORDER,
  PIPE_COLORS,
  PIPE_KIND_BY_ID,
  PIPE_TAP_MAX_PORT_COUNT,
  PIPE_TAP_TARGET_SPACING,
  PIPE_THICKNESS,
  TERRAIN_KIND_BY_ID,
  TERRAIN_KIND_DEFINITIONS,
  type EditorFacilityKind,
  type EditorManholeKind,
  type EditorOutfallKind,
  type EditorPipeKind,
  type EditorTerrainKind,
} from './editorDefinitions'
import { clampNumber, getNodeCenter } from './editorGeometry'
import {
  SURFACE_NODE_TYPES,
  type EditorLayout,
  type EditorLink,
  type EditorNode,
  type EditorNodeType,
  type EditorPipeSize,
  type EditorPort,
  type EditorPortSide,
} from './editorTypes'
import type { Point } from './editorInternalTypes'

// React 상태와 무관한 노드/포트 계산 helper 모음이다.
// relation 전파나 사용자 입력 처리는 EditorCanvas.tsx에 남기고, 여기서는 순수 계산만 담당한다.

/** 지상에 붙어 y 좌표를 고정해야 하는 객체인지 판정한다. */
export function isFixedYNode(node: EditorNode) {
  return FIXED_NODE_Y_BY_TYPE[node.type] !== undefined || SURFACE_NODE_TYPES.has(node.type)
}

/** relation 그룹 안에 고정 y 객체가 포함되는지 확인한다. */
export function hasFixedYNodeInNodeIds(layout: EditorLayout, nodeIds: string[]) {
  const nodeIdSet = new Set(nodeIds)

  return layout.nodes.some((node) => nodeIdSet.has(node.id) && isFixedYNode(node))
}

/** 건물/맨홀처럼 옆면 포트를 하단부로 내려 붙이는 객체인지 확인한다. */
export function usesLowerSideAttachment(node: EditorNode) {
  return node.type === 'apartment' || node.type === 'house' || node.type === 'manhole'
}

/** ㄱ자 커넥터의 유효한 90도 단위 회전값을 정규화한다. */
export function getElbowConnectorRotation(node: EditorNode) {
  const rotation = Number(node.props.rotation ?? 0)
  if (rotation === 90 || rotation === 180 || rotation === 270) {
    return rotation
  }

  return 0
}

/** T자 커넥터의 유효한 90도 단위 회전값을 정규화한다. */
export function getTeeConnectorRotation(node: EditorNode) {
  const rotation = Number(node.props.rotation ?? 0)
  if (rotation === 90 || rotation === 180 || rotation === 270) {
    return rotation
  }

  return 0
}

/** 파이프의 방향을 결정하는 90도 단위 회전값을 정규화한다. */
export function getPipeSegmentRotation(node: EditorNode) {
  const fallbackRotation = node.width >= node.height ? 0 : 90
  const rotation = Number(node.props.rotation ?? fallbackRotation)
  if (rotation === 90 || rotation === 180 || rotation === 270) {
    return rotation
  }

  return 0
}

/** 포트 면을 시계 방향으로 한 칸 회전한다. */
export function rotateSideClockwise(side: EditorPortSide): EditorPortSide {
  if (side === 'top') {
    return 'right'
  }

  if (side === 'right') {
    return 'bottom'
  }

  if (side === 'bottom') {
    return 'left'
  }

  if (side === 'left') {
    return 'top'
  }

  return 'center'
}

/** 포트 면을 주어진 90도 단위 회전값만큼 돌린다. */
export function rotateSideBy(side: EditorPortSide, rotation: number): EditorPortSide {
  let rotatedSide = side
  const steps = (((rotation / 90) % 4) + 4) % 4

  for (let index = 0; index < steps; index += 1) {
    rotatedSide = rotateSideClockwise(rotatedSide)
  }

  return rotatedSide
}

/** ㄱ자 커넥터의 실제 열린 끝단 포트 목록을 회전값 기준으로 만든다. */
export function getElbowConnectorPorts(rotation: number): EditorPort[] {
  return [
    { id: rotateSideBy('left', rotation), side: rotateSideBy('left', rotation) },
    { id: rotateSideBy('bottom', rotation), side: rotateSideBy('bottom', rotation) },
  ]
}

/** T자 커넥터의 실제 열린 끝단 3곳과 중앙 attach 포트를 회전값 기준으로 만든다. */
export function getTeeConnectorPorts(rotation: number): EditorPort[] {
  return [
    { id: rotateSideBy('top', rotation), side: rotateSideBy('top', rotation) },
    { id: rotateSideBy('right', rotation), side: rotateSideBy('right', rotation) },
    { id: rotateSideBy('left', rotation), side: rotateSideBy('left', rotation) },
    { id: 'center', side: 'center' },
  ]
}

/** 노드 내부 좌표를 중심점 기준으로 시계 방향 회전한다. */
export function rotateLocalPointClockwise(point: Point, center: Point, rotation: number): Point {
  const dx = point.x - center.x
  const dy = point.y - center.y

  if (rotation === 90) {
    return { x: center.x - dy, y: center.y + dx }
  }

  if (rotation === 180) {
    return { x: center.x - dx, y: center.y - dy }
  }

  if (rotation === 270) {
    return { x: center.x + dy, y: center.y - dx }
  }

  return point
}

/** ㄱ자 커넥터 렌더링과 포트 계산에 필요한 기하 값을 계산한다. */
export function getElbowConnectorGeometry(node: EditorNode) {
  const size = getNodePipeSize(node)
  const pipeSize = PIPE_THICKNESS[size]
  const pipeBorder = PIPE_BORDER[size]
  const outerStroke = pipeSize + pipeBorder * 2
  const capHorizontal = getConnectorDimensionsForOrientation(size, 'horizontal')
  const capVertical = getConnectorDimensionsForOrientation(size, 'vertical')
  const startX = capVertical.width
  const startY = capVertical.height / 2
  const endX = Math.max(startX + pipeSize, node.width - capHorizontal.width / 2)
  const endY = Math.max(startY + pipeSize, node.height - capHorizontal.height)
  const bendX = Math.max(startX + pipeSize, endX - pipeSize)
  const bendRadius = Math.max(pipeSize * 0.55, Math.min(outerStroke, endX - bendX))
  const pathData = `M${startX} ${startY} H${bendX} Q${endX} ${startY} ${endX} ${
    startY + bendRadius
  } V${endY}`

  return {
    pipeSize,
    pipeBorder,
    outerStroke,
    capHorizontal,
    capVertical,
    startX,
    startY,
    endX,
    endY,
    bendX,
    bendRadius,
    pathData,
    rotation: getElbowConnectorRotation(node),
  }
}

/** T자 커넥터 렌더링과 포트 계산에 필요한 기하 값을 계산한다. */
export function getTeeConnectorGeometry(node: EditorNode) {
  const size = getNodePipeSize(node)
  const pipeSize = PIPE_THICKNESS[size]
  const pipeBorder = PIPE_BORDER[size]
  const outerStroke = pipeSize + pipeBorder * 2
  const capHorizontal = getConnectorDimensionsForOrientation(size, 'horizontal')
  const capVertical = getConnectorDimensionsForOrientation(size, 'vertical')
  const centerX = node.width / 2
  const junctionY = Math.max(
    capHorizontal.height + pipeSize * 0.85,
    Math.min(node.height - capVertical.height / 2, node.height * 0.68),
  )
  const trunkStartX = capVertical.width / 2
  const trunkEndX = node.width - capVertical.width / 2
  const branchStartY = capHorizontal.height / 2
  const horizontalPathData = `M${trunkStartX} ${junctionY} H${trunkEndX}`
  const verticalPathData = `M${centerX} ${branchStartY} V${junctionY}`

  return {
    pipeSize,
    pipeBorder,
    outerStroke,
    capHorizontal,
    capVertical,
    centerX,
    junctionY,
    trunkStartX,
    trunkEndX,
    branchStartY,
    horizontalPathData,
    verticalPathData,
    rotation: getTeeConnectorRotation(node),
  }
}

/** 회전된 ㄱ자 포트가 원본 기준 어느 열린 끝단인지 역산한다. */
export function getElbowBaseSideForPort(node: EditorNode, side: EditorPortSide): EditorPortSide | null {
  const rotation = getElbowConnectorRotation(node)

  if (rotateSideBy('left', rotation) === side) {
    return 'left'
  }

  if (rotateSideBy('bottom', rotation) === side) {
    return 'bottom'
  }

  return null
}

/** 회전된 T자 포트가 원본 기준 어느 열린 끝단인지 역산한다. */
export function getTeeBaseSideForPort(node: EditorNode, side: EditorPortSide): EditorPortSide | null {
  const rotation = getTeeConnectorRotation(node)

  if (side === 'center') {
    return 'center'
  }

  if (rotateSideBy('top', rotation) === side) {
    return 'top'
  }

  if (rotateSideBy('right', rotation) === side) {
    return 'right'
  }

  if (rotateSideBy('left', rotation) === side) {
    return 'left'
  }

  return null
}

/** ㄱ자 커넥터 포트의 노드 내부 좌표를 계산한다. */
export function getElbowConnectorLocalPortPoint(node: EditorNode, port: EditorPort): Point | null {
  const elbow = getElbowConnectorGeometry(node)
  const baseSide = getElbowBaseSideForPort(node, port.side)
  const center = { x: node.width / 2, y: node.height / 2 }
  const basePoint = (() => {
    if (baseSide === 'left') {
      return { x: 0, y: elbow.startY }
    }

    if (baseSide === 'bottom') {
      return { x: elbow.endX, y: node.height }
    }

    return null
  })()

  return basePoint ? rotateLocalPointClockwise(basePoint, center, elbow.rotation) : null
}

/** T자 커넥터 포트의 노드 내부 좌표를 계산한다. */
export function getTeeConnectorLocalPortPoint(node: EditorNode, port: EditorPort): Point | null {
  const tee = getTeeConnectorGeometry(node)
  const baseSide = getTeeBaseSideForPort(node, port.side)
  const center = { x: node.width / 2, y: node.height / 2 }
  const basePoint = (() => {
    if (baseSide === 'top') {
      return { x: tee.centerX, y: 0 }
    }

    if (baseSide === 'right') {
      return { x: node.width, y: tee.junctionY }
    }

    if (baseSide === 'left') {
      return { x: 0, y: tee.junctionY }
    }

    if (baseSide === 'center') {
      return { x: tee.centerX, y: tee.junctionY }
    }

    return null
  })()

  return basePoint ? rotateLocalPointClockwise(basePoint, center, tee.rotation) : null
}

/** tap 포트 id에서 면과 퍼센트 위치를 파싱한다. */
export function getAttachTapPortInfo(portId: string): { side: EditorPortSide; percentage: number } | null {
  const match = portId.match(/^tap-(top|right|bottom|left)-(\d+(?:\.\d+)?)$/)
  if (!match) {
    return null
  }

  const side = match[1] as EditorPortSide
  const percentage = Number(match[2])
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) {
    return null
  }

  return { side, percentage }
}

/** attach 좌표 퍼센트를 JSON에 안정적으로 저장할 문자열로 정리한다. */
export function formatAttachTapPercentage(percentage: number) {
  return Number(percentage.toFixed(2)).toString()
}

/** 객체 타입별로 tap 포트를 해석할 수 있는 면을 반환한다. */
export function getResolvableAttachTapSides(node: EditorNode): EditorPortSide[] {
  if (node.type === 'pipeSegment' || node.type === 'facility' || node.type === 'outfall') {
    return ['top', 'right', 'bottom', 'left']
  }

  return []
}

/** 객체가 면 중간 attach tap 포트를 지원하는지 확인한다. */
export function supportsAttachTapPorts(node: EditorNode) {
  return node.type === 'pipeSegment' || node.type === 'facility' || node.type === 'outfall'
}

/** tap 포트 id를 실제 EditorPort 구조로 변환한다. */
export function getAttachTapPort(node: EditorNode, portId: string): EditorPort | null {
  if (!supportsAttachTapPorts(node)) {
    return null
  }

  const tapInfo = getAttachTapPortInfo(portId)
  if (!tapInfo) {
    return null
  }

  if (!getResolvableAttachTapSides(node).includes(tapInfo.side)) {
    return null
  }

  const offset = tapInfo.side === 'top' || tapInfo.side === 'bottom'
    ? node.width * (tapInfo.percentage / 100)
    : node.height * (tapInfo.percentage / 100)

  return {
    id: portId,
    side: tapInfo.side,
    offset,
  }
}

/** 기본 포트와 동적 tap 포트를 모두 포함해 포트를 찾는다. */
export function getNodePort(node: EditorNode, portId: string): EditorPort | null {
  return node.ports.find((candidate) => candidate.id === portId) ?? getAttachTapPort(node, portId)
}

/** 노드와 포트 기준의 실제 월드 좌표를 계산한다. */
export function getPortPoint(node: EditorNode, port: EditorPort): Point {
  if (node.type === 'elbowConnector') {
    const elbowPoint = getElbowConnectorLocalPortPoint(node, port)
    if (elbowPoint) {
      return {
        x: node.x + elbowPoint.x,
        y: node.y + elbowPoint.y,
      }
    }
  }

  if (node.type === 'teeConnector') {
    const teePoint = getTeeConnectorLocalPortPoint(node, port)
    if (teePoint) {
      return {
        x: node.x + teePoint.x,
        y: node.y + teePoint.y,
      }
    }
  }

  if (port.side === 'center') {
    return getNodeCenter(node)
  }

  if (port.side === 'top') {
    return {
      x: node.x + (port.offset ?? node.width / 2),
      y: node.y,
    }
  }

  if (port.side === 'right') {
    return {
      x: node.x + node.width,
      y: node.y + (port.offset ?? node.height / 2),
    }
  }

  if (port.side === 'bottom') {
    return {
      x: node.x + (port.offset ?? node.width / 2),
      y: node.y + node.height,
    }
  }

  return {
    x: node.x,
    y: node.y + (port.offset ?? node.height / 2),
  }
}

/** 포트가 붙은 면의 길이를 계산해 맞닿는 면 보정에 사용한다. */
export function getPortFaceSpan(node: EditorNode, port: EditorPort) {
  if (node.type === 'elbowConnector') {
    const elbow = getElbowConnectorGeometry(node)
    const baseSide = getElbowBaseSideForPort(node, port.side)

    if (baseSide === 'left') {
      return elbow.capVertical.height
    }

    if (baseSide === 'bottom') {
      return elbow.capHorizontal.width
    }
  }

  if (node.type === 'teeConnector') {
    const tee = getTeeConnectorGeometry(node)
    const baseSide = getTeeBaseSideForPort(node, port.side)

    if (baseSide === 'top') {
      return tee.capHorizontal.width
    }

    if (baseSide === 'left' || baseSide === 'right') {
      return tee.capVertical.height
    }

    if (baseSide === 'center') {
      return tee.outerStroke
    }
  }

  if (port.side === 'left' || port.side === 'right') {
    return node.height
  }

  if (port.side === 'top' || port.side === 'bottom') {
    return node.width
  }

  return Math.min(node.width, node.height)
}

/** 하단부 attach 보정 시 상대 객체가 차지하는 반쪽 길이를 계산한다. */
export function getLowerSideAttachmentCounterpartHalfSpan(node: EditorNode, port: EditorPort) {
  if (port.side === 'top' || port.side === 'bottom') {
    return node.height / 2
  }

  if (port.side === 'left' || port.side === 'right') {
    return getPortFaceSpan(node, port) / 2
  }

  return Math.min(node.width, node.height) / 2
}

/** 건물/맨홀 옆면 포트가 몸통 하단부에 붙도록 y 오프셋을 계산한다. */
export function getLowerSideAttachmentOffset(nodeHeight: number, counterpartHalfSpan: number) {
  const minOffset = nodeHeight * 0.56
  const maxOffset = nodeHeight - 10
  return Math.min(maxOffset, Math.max(minOffset, nodeHeight - counterpartHalfSpan))
}

/** 원하는 하단부 포트 위치를 만족하는 최소 높이를 역산한다. */
export function getHeightForLowerSideAttachmentOffset(
  targetOffset: number,
  counterpartHalfSpan: number,
  minHeight: number,
) {
  const safeTargetOffset = Math.max(0, targetOffset)
  if (safeTargetOffset <= getLowerSideAttachmentOffset(minHeight, counterpartHalfSpan)) {
    return minHeight
  }

  let low = minHeight
  let high = Math.max(minHeight * 2, safeTargetOffset + counterpartHalfSpan + 20, safeTargetOffset / 0.56 + 20)
  while (getLowerSideAttachmentOffset(high, counterpartHalfSpan) < safeTargetOffset && high < 10000) {
    high *= 2
  }

  for (let index = 0; index < 32; index += 1) {
    const mid = (low + high) / 2
    if (getLowerSideAttachmentOffset(mid, counterpartHalfSpan) < safeTargetOffset) {
      low = mid
    } else {
      high = mid
    }
  }

  return high
}

/** relation으로 붙은 상대 객체를 고려해 실제 attach 포트 좌표를 계산한다. */
export function getAttachedPortPoint(
  node: EditorNode,
  port: EditorPort,
  counterpartNode?: EditorNode | null,
  counterpartPort?: EditorPort | null,
): Point {
  if (
    usesLowerSideAttachment(node) &&
    (port.side === 'left' || port.side === 'right') &&
    counterpartNode &&
    counterpartPort
  ) {
    const counterpartHalfSpan = getLowerSideAttachmentCounterpartHalfSpan(counterpartNode, counterpartPort)
    const offset = getLowerSideAttachmentOffset(node.height, counterpartHalfSpan)

    return {
      x: port.side === 'right' ? node.x + node.width : node.x,
      y: node.y + offset,
    }
  }

  return getPortPoint(node, port)
}

/** JSON 값이 파이프 크기 enum인지 확인한다. */
export function isEditorPipeSize(value: unknown): value is EditorPipeSize {
  return typeof value === 'string' && value in PIPE_THICKNESS
}

/** JSON 값이 현재 파이프 관종 enum인지 확인한다. */
export function isEditorPipeKind(value: unknown): value is EditorPipeKind {
  return typeof value === 'string' && value in PIPE_KIND_BY_ID
}

/** legacy 관종 값까지 포함해 파이프 관종을 현재 enum으로 정규화한다. */
export function normalizePipeKind(value: unknown): EditorPipeKind {
  if (isEditorPipeKind(value)) {
    return value
  }

  if (typeof value === 'string' && value in LEGACY_PIPE_KIND_TO_KIND) {
    return LEGACY_PIPE_KIND_TO_KIND[value]
  }

  return DEFAULT_PIPE_KIND
}

/** JSON 값이 시설 종류 enum인지 확인한다. */
export function isEditorFacilityKind(value: unknown): value is EditorFacilityKind {
  return typeof value === 'string' && value in FACILITY_KIND_BY_ID
}

/** 시설 종류 값을 기본값 포함 형태로 정규화한다. */
export function normalizeFacilityKind(value: unknown): EditorFacilityKind {
  return isEditorFacilityKind(value) ? value : DEFAULT_FACILITY_KIND
}

/** JSON 값이 방류구 종류 enum인지 확인한다. */
export function isEditorOutfallKind(value: unknown): value is EditorOutfallKind {
  return typeof value === 'string' && value in OUTFALL_KIND_BY_ID
}

/** 방류구 종류 값을 기본값 포함 형태로 정규화한다. */
export function normalizeOutfallKind(value: unknown): EditorOutfallKind {
  return isEditorOutfallKind(value) ? value : DEFAULT_OUTFALL_KIND
}

/** JSON 값이 맨홀 종류 enum인지 확인한다. */
export function isEditorManholeKind(value: unknown): value is EditorManholeKind {
  return typeof value === 'string' && value in MANHOLE_KIND_BY_ID
}

/** 맨홀 종류 값을 기본값 포함 형태로 정규화한다. */
export function normalizeManholeKind(value: unknown): EditorManholeKind {
  return isEditorManholeKind(value) ? value : DEFAULT_MANHOLE_KIND
}

/** JSON 값이 지형 레이아웃 종류 enum인지 확인한다. */
export function isEditorTerrainKind(value: unknown): value is EditorTerrainKind {
  return typeof value === 'string' && value in TERRAIN_KIND_BY_ID
}

/** 지형 레이아웃 종류 값을 기본값 포함 형태로 정규화한다. */
export function normalizeTerrainKind(value: unknown): EditorTerrainKind {
  return isEditorTerrainKind(value) ? value : DEFAULT_TERRAIN_KIND
}

/** 노드 props에서 파이프 크기를 읽고 없으면 기본 크기를 반환한다. */
export function getNodePipeSize(node: EditorNode): EditorPipeSize {
  return isEditorPipeSize(node.props.size) ? node.props.size : 'medium'
}

/** 노드 props에서 관종을 정규화해 읽는다. */
export function getNodePipeKind(node: EditorNode): EditorPipeKind {
  return normalizePipeKind(node.props.pipeKind)
}

/** 링크 props에서 관종을 정규화해 읽는다. */
export function getLinkPipeKind(link: EditorLink): EditorPipeKind {
  return normalizePipeKind(link.props.pipeKind)
}

/** 관종에 맞는 렌더링 팔레트를 반환한다. */
export function getPipePalette(pipeKind: unknown) {
  if (pipeKind === 'default') {
    return PIPE_COLORS.default
  }

  const kind = normalizePipeKind(pipeKind)

  return PIPE_COLORS[kind] ?? PIPE_COLORS.default
}

/** 시설 노드의 세부 종류를 정규화해 읽는다. */
export function getNodeFacilityKind(node: EditorNode): EditorFacilityKind {
  return normalizeFacilityKind(node.props.facilityKind)
}

/** 시설 노드의 세부 종류 정의를 반환한다. */
export function getNodeFacilityDefinition(node: EditorNode) {
  return FACILITY_KIND_BY_ID[getNodeFacilityKind(node)]
}

/** 방류구 노드의 세부 종류를 정규화해 읽는다. */
export function getNodeOutfallKind(node: EditorNode): EditorOutfallKind {
  return normalizeOutfallKind(node.props.outfallKind)
}

/** 방류구 노드의 세부 종류 정의를 반환한다. */
export function getNodeOutfallDefinition(node: EditorNode) {
  return OUTFALL_KIND_BY_ID[getNodeOutfallKind(node)]
}

/** 맨홀 노드의 세부 종류를 정규화해 읽는다. */
export function getNodeManholeKind(node: EditorNode): EditorManholeKind {
  return normalizeManholeKind(node.props.manholeKind)
}

/** 맨홀 노드의 세부 종류 정의를 반환한다. */
export function getNodeManholeDefinition(node: EditorNode) {
  return MANHOLE_KIND_BY_ID[getNodeManholeKind(node)]
}

/** 지형 노드의 세부 종류를 정규화해 읽는다. */
export function getNodeTerrainKind(node: EditorNode): EditorTerrainKind {
  return normalizeTerrainKind(node.props.terrainKind)
}

/** 지형 노드의 세부 종류 정의를 반환한다. */
export function getNodeTerrainDefinition(node: EditorNode) {
  return TERRAIN_KIND_BY_ID[getNodeTerrainKind(node)]
}

/** 세부 종류 변경 시 기본 이름만 새 종류 이름으로 바꾼다. */
export function getNameForDetailKindChange(currentName: string, nextName: string, defaultNames: string[]) {
  const defaultNameSet = new Set(defaultNames)
  const nameWithIndex = currentName.match(/^(.+?)(\s+\d+)$/)
  const baseName = nameWithIndex ? nameWithIndex[1] : currentName
  const indexSuffix = nameWithIndex?.[2] ?? ''

  return defaultNameSet.has(baseName) ? `${nextName}${indexSuffix}` : currentName
}

/** 시설 세부 종류 변경에 맞춰 이름/크기/props를 계산한다. */
export function resizeNodeForFacilityKind(node: EditorNode, nextKind: EditorFacilityKind): Partial<EditorNode> {
  const definition = FACILITY_KIND_BY_ID[nextKind]
  const center = getNodeCenter(node)

  return {
    name: getNameForDetailKindChange(
      node.name,
      definition.nodeName,
      FACILITY_KIND_DEFINITIONS.map((candidate) => candidate.nodeName),
    ),
    x: center.x - definition.width / 2,
    y: center.y - definition.height / 2,
    width: definition.width,
    height: definition.height,
    props: {
      ...node.props,
      facilityKind: nextKind,
    },
  }
}

/** 방류구 세부 종류 변경에 맞춰 이름/크기/props를 계산한다. */
export function resizeNodeForOutfallKind(node: EditorNode, nextKind: EditorOutfallKind): Partial<EditorNode> {
  const definition = OUTFALL_KIND_BY_ID[nextKind]
  const center = getNodeCenter(node)

  return {
    name: getNameForDetailKindChange(
      node.name,
      definition.nodeName,
      OUTFALL_KIND_DEFINITIONS.map((candidate) => candidate.nodeName),
    ),
    x: center.x - definition.width / 2,
    y: center.y - definition.height / 2,
    width: definition.width,
    height: definition.height,
    props: {
      ...node.props,
      outfallKind: nextKind,
    },
  }
}

/** 맨홀 세부 종류 변경에 맞춰 이름/props를 계산한다. */
export function resizeNodeForManholeKind(node: EditorNode, nextKind: EditorManholeKind): Partial<EditorNode> {
  const definition = MANHOLE_KIND_BY_ID[nextKind]

  return {
    name: getNameForDetailKindChange(
      node.name,
      definition.nodeName,
      MANHOLE_KIND_DEFINITIONS.map((candidate) => candidate.nodeName),
    ),
    props: {
      ...node.props,
      manholeKind: nextKind,
    },
  }
}

/** 지형 세부 종류 변경에 맞춰 이름/props를 계산한다. */
export function resizeNodeForTerrainKind(node: EditorNode, nextKind: EditorTerrainKind): Partial<EditorNode> {
  const definition = TERRAIN_KIND_BY_ID[nextKind]

  return {
    name: getNameForDetailKindChange(
      node.name,
      definition.nodeName,
      TERRAIN_KIND_DEFINITIONS.map((candidate) => candidate.nodeName),
    ),
    props: {
      ...node.props,
      terrainKind: nextKind,
    },
  }
}

/** 파이프 내부 두께와 외곽선을 합친 실제 외곽 두께를 계산한다. */
export function getPipeOuterThickness(size: EditorPipeSize) {
  return PIPE_THICKNESS[size] + PIPE_BORDER[size] * 2
}

/** 커넥터가 파이프 방향에 맞게 감싸는 가로/세로 크기를 계산한다. */
export function getConnectorDimensionsForOrientation(
  size: EditorPipeSize,
  orientation: 'horizontal' | 'vertical',
) {
  const outerThickness = getPipeOuterThickness(size)
  // Long side: pipe outer thickness * 1.1, so the connector visibly wraps the pipe.
  // Short side: cap depth along the pipe direction.
  const longSide = Math.round(outerThickness * CONNECTOR_LONG_SIDE_RATIO)
  const shortSide = Math.round(outerThickness * CONNECTOR_SHORT_SIDE_RATIO)

  return orientation === 'horizontal'
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide }
}

/** ㄱ자 커넥터의 기본 정사각형 점유 크기를 계산한다. */
export function getElbowConnectorDimensions(size: EditorPipeSize) {
  const outerThickness = getPipeOuterThickness(size)
  const reach = Math.round(outerThickness * 2.35)

  return {
    width: reach,
    height: reach,
  }
}

/** T자 커넥터의 기본 점유 크기를 계산한다. */
export function getTeeConnectorDimensions(size: EditorPipeSize) {
  const outerThickness = getPipeOuterThickness(size)

  return {
    width: Math.round(outerThickness * 3.25),
    height: Math.round(outerThickness * 2.45),
  }
}

/** 파이프/커넥터 크기 프리셋 변경에 따른 치수를 계산한다. */
export function resizeNodeForPipeSize(node: EditorNode, size: EditorPipeSize): Partial<EditorNode> {
  if (node.type === 'pipeSegment') {
    const outerThickness = getPipeOuterThickness(size)
    const isHorizontal = getNodeOrientation(node) === 'horizontal'

    return {
      width: isHorizontal ? node.width : outerThickness,
      height: isHorizontal ? outerThickness : node.height,
      props: { ...node.props, size },
    }
  }

  if (node.type === 'connector') {
    const isHorizontal = node.width >= node.height
    const dimensions = getConnectorDimensionsForOrientation(size, isHorizontal ? 'horizontal' : 'vertical')

    return {
      ...dimensions,
      props: { ...node.props, size },
    }
  }

  if (node.type === 'elbowConnector') {
    return {
      ...getElbowConnectorDimensions(size),
      props: { ...node.props, size },
    }
  }

  if (node.type === 'teeConnector') {
    return {
      ...getTeeConnectorDimensions(size),
      props: { ...node.props, size },
    }
  }

  return {
    props: { ...node.props, size },
  }
}

/** 객체 타입 변경 시 기본 이름인 경우 새 타입 이름으로 바꾼다. */
export function getNodeNameForTypeChange(node: EditorNode, nextType: EditorNodeType) {
  const defaultNames = new Set(Object.values(EDITOR_NODE_PRESETS).map((preset) => preset.name))
  const nameWithIndex = node.name.match(/^(.+?)(\s+\d+)$/)
  const nextName = EDITOR_NODE_PRESETS[nextType].name

  if (nameWithIndex && defaultNames.has(nameWithIndex[1])) {
    return `${nextName}${nameWithIndex[2]}`
  }

  if (defaultNames.has(node.name)) {
    return nextName
  }

  return node.name
}

/** 객체 타입 변경에 필요한 위치/크기/포트/props를 계산한다. */
export function resizeNodeForType(node: EditorNode, nextType: EditorNodeType): Partial<EditorNode> {
  const preset = EDITOR_NODE_PRESETS[nextType]
  const center = getNodeCenter(node)
  const size = getNodePipeSize(node)
  const pipeProps = { size, pipeKind: getNodePipeKind(node) }
  const geometry = (() => {
    if (nextType === 'connector') {
      return getConnectorDimensionsForOrientation(size, 'vertical')
    }

    if (nextType === 'elbowConnector') {
      return getElbowConnectorDimensions(size)
    }

    if (nextType === 'teeConnector') {
      return getTeeConnectorDimensions(size)
    }

    if (nextType === 'pipeSegment') {
      return resizeNodeForPipeSize({ ...node, type: nextType }, size)
    }

    return {
      width: preset.width,
      height: preset.height,
    }
  })()
  const width = geometry.width ?? preset.width
  const height = geometry.height ?? preset.height
  let props: EditorNode['props'] = {}
  if (nextType === 'elbowConnector' || nextType === 'teeConnector') {
    props = { ...pipeProps, rotation: 0 }
  } else if (nextType === 'connector' || nextType === 'pipeSegment') {
    props = pipeProps
  } else if (nextType === 'facility') {
    props = { facilityKind: DEFAULT_FACILITY_KIND }
  } else if (nextType === 'outfall') {
    props = { outfallKind: DEFAULT_OUTFALL_KIND }
  } else if (nextType === 'manhole') {
    props = { manholeKind: DEFAULT_MANHOLE_KIND }
  } else if (nextType === 'terrain') {
    props = { terrainKind: DEFAULT_TERRAIN_KIND }
  }

  return {
    type: nextType,
    name: getNodeNameForTypeChange(node, nextType),
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    ports: createEditorPorts(nextType, width, height),
    props,
  }
}

/** 노드의 현재 시각 방향을 horizontal/vertical로 판정한다. */
export function getNodeOrientation(node: EditorNode): 'horizontal' | 'vertical' {
  if (node.type === 'pipeSegment') {
    const rotation = getPipeSegmentRotation(node)

    return rotation === 90 || rotation === 270 ? 'vertical' : 'horizontal'
  }

  return node.width >= node.height ? 'horizontal' : 'vertical'
}

/** 객체 방향에 따라 동적 tap 포트를 노출할 면을 계산한다. */
export function getAttachTapSides(node: EditorNode): EditorPortSide[] {
  if (node.type === 'pipeSegment') {
    return getNodeOrientation(node) === 'horizontal'
      ? ['top', 'bottom']
      : ['left', 'right']
  }

  if (node.type === 'facility' || node.type === 'outfall') {
    return ['top', 'right', 'bottom', 'left']
  }

  return []
}

/** 파이프 길이에 비례해 tap 포트 퍼센트 지점을 만든다. */
export function getPipeTapPercentages(node: EditorNode) {
  const pipeLength = getNodeOrientation(node) === 'horizontal' ? node.width : node.height
  let portCount = clampNumber(
    Math.round(pipeLength / PIPE_TAP_TARGET_SPACING),
    1,
    PIPE_TAP_MAX_PORT_COUNT,
  )

  if (portCount > 1 && portCount % 2 === 0) {
    portCount += portCount >= PIPE_TAP_MAX_PORT_COUNT ? -1 : 1
  }

  const percentages = new Set<number>()
  for (let index = 1; index <= portCount; index += 1) {
    percentages.add(Math.round((index * 100) / (portCount + 1)))
  }

  percentages.add(ATTACH_TAP_CENTER_PERCENTAGE)

  return Array.from(percentages).sort((first, second) => first - second)
}

/** 객체 타입별 tap 포트 퍼센트 목록을 반환한다. */
export function getAttachTapPercentages(node: EditorNode): readonly number[] {
  if (node.type === 'pipeSegment') {
    return getPipeTapPercentages(node)
  }

  if (node.type === 'facility' || node.type === 'outfall') {
    return FACILITY_TAP_PORT_PERCENTAGES
  }

  return []
}

/** 현재 객체에서 사용할 수 있는 동적 tap 포트 목록을 만든다. */
export function getAttachTapPorts(node: EditorNode): EditorPort[] {
  if (!supportsAttachTapPorts(node)) {
    return []
  }

  return getAttachTapSides(node).flatMap((side) => (
    getAttachTapPercentages(node).map((percentage) => getAttachTapPort(node, `tap-${side}-${percentage}`))
  )).filter((port): port is EditorPort => port !== null)
}

/** 기본 포트와 동적 tap 포트를 합쳐 attach 후보 포트를 만든다. */
export function getAttachCandidatePorts(node: EditorNode) {
  const portsById = new Map(node.ports.map((port) => [port.id, port]))

  getAttachTapPorts(node).forEach((port) => portsById.set(port.id, port))

  return Array.from(portsById.values())
}

/** 파이프 계열 노드가 현재 크기 프리셋과 방향에 맞는 치수를 갖도록 정규화한다. */
export function normalizeNodeGeometryForPipePreset(node: EditorNode): EditorNode {
  if (
    node.type !== 'pipeSegment' &&
    node.type !== 'connector' &&
    node.type !== 'elbowConnector' &&
    node.type !== 'teeConnector'
  ) {
    return node
  }

  const size = getNodePipeSize(node)

  if (node.type === 'connector') {
    const dimensions = getConnectorDimensionsForOrientation(size, getNodeOrientation(node))

    return {
      ...node,
      ...dimensions,
      props: {
        ...node.props,
        size,
      },
    }
  }

  if (node.type === 'elbowConnector') {
    return {
      ...node,
      ...getElbowConnectorDimensions(size),
      props: {
        ...node.props,
        size,
      },
    }
  }

  if (node.type === 'teeConnector') {
    return {
      ...node,
      ...getTeeConnectorDimensions(size),
      props: {
        ...node.props,
        size,
      },
    }
  }

  const outerThickness = getPipeOuterThickness(size)
  const isHorizontal = getNodeOrientation(node) === 'horizontal'

  return {
    ...node,
    width: isHorizontal ? Math.max(node.width, MIN_PIPE_SEGMENT_LENGTH) : outerThickness,
    height: isHorizontal ? outerThickness : Math.max(node.height, MIN_PIPE_SEGMENT_LENGTH),
    props: {
      ...node.props,
      size,
    },
  }
}

/** 타입/회전/하단부 attach 규칙에 맞게 노드 포트 목록을 정규화한다. */
export function normalizeNodePorts(node: EditorNode): EditorNode {
  if (node.type === 'elbowConnector') {
    return {
      ...node,
      ports: getElbowConnectorPorts(getElbowConnectorRotation(node)),
    }
  }

  if (node.type === 'teeConnector') {
    return {
      ...node,
      ports: getTeeConnectorPorts(getTeeConnectorRotation(node)),
    }
  }

  if (usesLowerSideAttachment(node)) {
    return {
      ...node,
      ports: createEditorPorts(node.type, node.width, node.height),
    }
  }

  return node
}

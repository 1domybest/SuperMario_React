import {
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  EDITOR_CANVAS_HEIGHT,
  EDITOR_CANVAS_WIDTH,
  EDITOR_CONNECTOR_LONG_SIDE,
  EDITOR_CONNECTOR_SHORT_SIDE,
  createDefaultEditorLayout,
  createEditorNode,
  createEditorPorts,
} from './defaultLayout'
import {
  ATTACH_ANCHOR_EDGE_EPSILON,
  ATTACH_ANCHOR_GUARD_FIXED_BRANCH_TYPES,
  ATTACH_ANCHOR_RESIZE_MARGIN,
  ATTACH_TAP_CENTER_PERCENTAGE,
  ATTACH_TAP_MAX_PERCENTAGE,
  ATTACH_TAP_MIN_PERCENTAGE,
  CANVAS_BOTTOM_PADDING,
  CANVAS_RIGHT_PADDING,
  CONNECTOR_PORTS,
  CONNECTOR_TYPE_OPTIONS,
  DEFAULT_PIPE_KIND,
  ENABLE_ATTACH_ANCHOR_RESIZE_GUARD,
  ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE,
  ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE,
  ENABLE_PARENT_CHILD_PROPAGATION_RULE,
  ENABLE_REVERSE_PARENT_PROPAGATION_RULE,
  FACILITY_KIND_DEFINITIONS,
  FACILITY_KIND_LABELS,
  FACILITY_KIND_OPTIONS,
  FACILITY_TYPE_OPTIONS,
  FIXED_NODE_Y_BY_TYPE,
  LAYOUT_ADD_HANDLE_SIZE,
  LAYOUT_ADD_KIND_LABELS,
  LAYOUT_ADD_KIND_OPTIONS,
  LAYOUT_HISTORY_LIMIT,
  LINK_ROUTE_OPTIONS,
  LINK_TYPE_OPTIONS,
  LOWER_SIDE_PORT_BOTTOM_GAP,
  MANHOLE_KIND_LABELS,
  MANHOLE_KIND_OPTIONS,
  MIN_MANHOLE_HEIGHT,
  MIN_PIPE_SEGMENT_LENGTH,
  MIN_ROAD_WIDTH,
  MIN_TERRAIN_HEIGHT,
  MIN_TERRAIN_WIDTH,
  NODE_BUTTONS,
  NODE_LABELS,
  OUTFALL_KIND_LABELS,
  OUTFALL_KIND_OPTIONS,
  PENDING_PORT_DOT_RADIUS,
  PENDING_PORT_HALO_RADIUS,
  PIPE_BORDER,
  PIPE_COLORS,
  PIPE_FLOW_ARROW_EDGE_PADDING,
  PIPE_FLOW_ARROW_MAX_COUNT,
  PIPE_FLOW_ARROW_SPACING,
  PIPE_KIND_LABELS,
  PIPE_KIND_OPTIONS,
  PIPE_SIZE_LABELS,
  PIPE_SIZE_OPTIONS,
  PIPE_THICKNESS,
  PORT_DOT_RADIUS,
  PORT_HALO_RADIUS,
  PORT_HIT_RADIUS,
  RELATION_ARROW_MAX_SIZE,
  RELATION_ARROW_MIN_SIZE,
  RESIZE_BORDER_HIT_SIZE,
  ROAD_DASH_SPACING,
  SWMM_ENGINE_URL,
  TERRAIN_KIND_BY_ID,
  TERRAIN_KIND_LABELS,
  TERRAIN_KIND_OPTIONS,
  type LayoutAddKind,
} from './editorDefinitions'
import {
  clampNumber,
  getNodeCenter,
  getNodeRect,
  getPointDistance,
  getSvgCursor,
  normalizeRect,
  rectsIntersect,
} from './editorGeometry'
import {
  isFixedYNode,
  hasFixedYNodeInNodeIds,
  getElbowConnectorRotation,
  getTeeConnectorRotation,
  getPipeSegmentRotation,
  rotateSideClockwise,
  getElbowConnectorPorts,
  getTeeConnectorPorts,
  getElbowConnectorGeometry,
  getTeeConnectorGeometry,
  getTeeBaseSideForPort,
  getAttachTapPortInfo,
  formatAttachTapPercentage,
  getResolvableAttachTapSides,
  supportsAttachTapPorts,
  getNodePort,
  getPortPoint,
  getPortFaceSpan,
  getLowerSideAttachmentCounterpartHalfSpan,
  getHeightForLowerSideAttachmentOffset,
  getAttachedPortPoint,
  isEditorPipeSize,
  normalizePipeKind,
  normalizeFacilityKind,
  normalizeOutfallKind,
  normalizeManholeKind,
  normalizeTerrainKind,
  getNodePipeSize,
  getNodePipeKind,
  getLinkPipeKind,
  getPipePalette,
  getNodeFacilityKind,
  getNodeFacilityDefinition,
  getNodeOutfallKind,
  getNodeOutfallDefinition,
  getNodeManholeKind,
  getNodeManholeDefinition,
  getNodeTerrainKind,
  getNodeTerrainDefinition,
  resizeNodeForFacilityKind,
  resizeNodeForOutfallKind,
  resizeNodeForManholeKind,
  resizeNodeForTerrainKind,
  resizeNodeForPipeSize,
  resizeNodeForType,
  getNodeOrientation,
  getAttachCandidatePorts,
  normalizeNodeGeometryForPipePreset,
  normalizeNodePorts,
} from './editorNodeHelpers'
import { clearEditorLayout, isEditorLayout, loadEditorLayout, saveEditorLayout } from './layoutStorage'
import { clampPercent } from '../../services/swmm/editorRuntime'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import {
  SURFACE_NODE_TYPES,
  type EditorAttachPoint,
  type EditorEndpoint,
  type EditorLayout,
  type EditorLink,
  type EditorLinkType,
  type EditorNode,
  type EditorNodeType,
  type EditorPipeSize,
  type EditorPort,
  type EditorPortSide,
  type EditorPortSelection,
  type EditorSelection,
} from './editorTypes'
import type {
  ChangeAxis,
  ChildPropagationOptions,
  ContextMenuState,
  CoordinateEditState,
  CoordinateEditableRelationInfo,
  CopiedEditorSelection,
  DragState,
  LayoutAddSide,
  LayoutHistoryAction,
  LayoutHistoryState,
  LayoutSetOptions,
  LayoutUpdate,
  MarqueeSelectionState,
  Point,
  RectBounds,
  RelationPortRole,
  ResizeAnchorBounds,
  ResizeAnchorPoint,
  ResizeEdge,
  ResizeState,
} from './editorInternalTypes'

const EDITOR_ZOOM_MIN = 0.25
const EDITOR_ZOOM_MAX = 1.5
const EDITOR_ZOOM_STEP = 0.1
const EDITOR_ZOOM_DEFAULT = 0.5


// ---------------------------------------------------------------------------
// relation 포트/attach 좌표 계산 helper
// ---------------------------------------------------------------------------
/** relation으로 보정된 포트의 실제 렌더 좌표를 노드 내부 좌표로 반환한다. */
function getRenderedPortPoint(layout: EditorLayout, node: EditorNode, port: EditorPort): Point {
  const relation = getRelationLinkForPort(layout, { nodeId: node.id, portId: port.id })
  if (!relation) {
    return getPortPoint({ ...node, x: 0, y: 0 }, port)
  }

  const portKey = endpointKey({ nodeId: node.id, portId: port.id })
  const counterpartEndpoint = endpointKey(relation.from) === portKey ? relation.to : relation.from
  const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
  const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
  const worldPoint = getAttachedPortPoint(node, port, counterpartNode, counterpartPort)

  return {
    x: worldPoint.x - node.x,
    y: worldPoint.y - node.y,
  }
}

/** 노드 몸통 클릭으로 attach할 때 커서와 가장 가까운 사용 가능한 포트를 찾는다. */
function getNearestAttachCandidatePort(
  layout: EditorLayout,
  node: EditorNode,
  point: Point,
) {
  const candidates = getAttachCandidatePorts(node)
  const openCandidates = candidates.filter((port) => (
    !getRelationLinkForPort(layout, { nodeId: node.id, portId: port.id })
  ))
  const usableCandidates = openCandidates.length > 0 ? openCandidates : candidates

  return usableCandidates.reduce<EditorPort | null>((nearestPort, port) => {
    const localPoint = getRenderedPortPoint(layout, node, port)
    const portPoint = {
      x: node.x + localPoint.x,
      y: node.y + localPoint.y,
    }
    const distance = (portPoint.x - point.x) ** 2 + (portPoint.y - point.y) ** 2

    if (!nearestPort) {
      return port
    }

    const nearestLocalPoint = getRenderedPortPoint(layout, node, nearestPort)
    const nearestPoint = {
      x: node.x + nearestLocalPoint.x,
      y: node.y + nearestLocalPoint.y,
    }
    const nearestDistance = (nearestPoint.x - point.x) ** 2 + (nearestPoint.y - point.y) ** 2

    return distance < nearestDistance ? port : nearestPort
  }, null)
}

/** child 포트 면을 기준으로 좌표 변경이 움직일 축을 결정한다. */
function getCoordinateAxisForChildPort(port: EditorPort | null): ChangeAxis | null {
  if (!port) {
    return null
  }

  if (port.side === 'top' || port.side === 'bottom') {
    return 'x'
  }

  if (port.side === 'left' || port.side === 'right') {
    return 'y'
  }

  return null
}

/** 좌표 변경 메뉴를 허용할 parent가 커넥터 계열인지 판정한다. */
function isCoordinateEditConnectorParent(node: EditorNode | null | undefined) {
  return node?.type === 'connector' || node?.type === 'elbowConnector' || node?.type === 'teeConnector'
}

/** 좌표 변경 대상 child 파이프가 실제 길이축을 따라 조정 가능한지 확인한다. */
function getCoordinateEditablePipeAxis(childNode: EditorNode, childPort: EditorPort | null): ChangeAxis | null {
  if (childNode.type !== 'pipeSegment') {
    return null
  }

  const axis = getCoordinateAxisForChildPort(childPort)
  if (!axis) {
    return null
  }

  const orientation = getNodeOrientation(childNode)
  const isPipeLengthAxis =
    (orientation === 'horizontal' && axis === 'x') ||
    (orientation === 'vertical' && axis === 'y')
  if (!isPipeLengthAxis) {
    return null
  }

  const resizableEdges = getAttachResizableEdges(childNode)
  const canResizeOnAxis = (Object.keys(resizableEdges) as ResizeEdge[]).some((edge) => (
    resizableEdges[edge] && isResizeEdgeOnAxis(edge, axis)
  ))

  return canResizeOnAxis ? axis : null
}

type TeeTrunkSide = 'min' | 'max'

type TeeTrunkPipeAttachment = {
  relation: EditorLink
  teeEndpoint: EditorEndpoint
  teePort: EditorPort
  pipeEndpoint: EditorEndpoint
  pipeNode: EditorNode
  pipePort: EditorPort
  pipeEdge: ResizeEdge
  side: TeeTrunkSide
}

/** T자 커넥터의 ㅡ 축이 현재 화면에서 움직일 축을 계산한다. */
function getTeeTrunkAxis(node: EditorNode): ChangeAxis {
  const rotation = getTeeConnectorRotation(node)
  return rotation === 90 || rotation === 270 ? 'y' : 'x'
}

/** T자 커넥터 포트가 ㅡ 축의 좌/우 또는 상/하 중 어느 쪽인지 판정한다. */
function getTeeTrunkSideForPort(node: EditorNode, port: EditorPort): TeeTrunkSide | null {
  if (node.type !== 'teeConnector') {
    return null
  }

  const baseSide = getTeeBaseSideForPort(node, port.side)
  if (baseSide !== 'left' && baseSide !== 'right') {
    return null
  }

  const axis = getTeeTrunkAxis(node)
  if (axis === 'x') {
    if (port.side === 'left') {
      return 'min'
    }
    if (port.side === 'right') {
      return 'max'
    }
    return null
  }

  if (port.side === 'top') {
    return 'min'
  }
  if (port.side === 'bottom') {
    return 'max'
  }

  return null
}

/** 파이프 edge가 최소 길이를 유지하며 이동할 수 있는 좌표 범위다. */
function getPipeResizeEdgeCoordinateBounds(node: EditorNode, edge: ResizeEdge) {
  if (edge === 'left') {
    return {
      min: Number.NEGATIVE_INFINITY,
      max: node.x + node.width - MIN_PIPE_SEGMENT_LENGTH,
    }
  }

  if (edge === 'right') {
    return {
      min: node.x + MIN_PIPE_SEGMENT_LENGTH,
      max: Number.POSITIVE_INFINITY,
    }
  }

  if (edge === 'top') {
    return {
      min: Number.NEGATIVE_INFINITY,
      max: node.y + node.height - MIN_PIPE_SEGMENT_LENGTH,
    }
  }

  return {
    min: node.y + MIN_PIPE_SEGMENT_LENGTH,
    max: Number.POSITIVE_INFINITY,
  }
}

/** T자 ㅡ 축 양쪽에 연결된 파이프와 resize edge를 수집한다. */
function getTeeTrunkPipeAttachments(layout: EditorLayout, teeNode: EditorNode): TeeTrunkPipeAttachment[] {
  if (teeNode.type !== 'teeConnector') {
    return []
  }

  const axis = getTeeTrunkAxis(teeNode)
  const attachments: TeeTrunkPipeAttachment[] = []

  getRelationLinksForNode(layout, teeNode.id).forEach((relation) => {
    const teeEndpoint = getEndpointForNode(relation, teeNode.id)
    const pipeEndpoint = getOtherRelationEndpoint(relation, teeNode.id)
    if (!teeEndpoint || !pipeEndpoint) {
      return
    }

    const teePort = getNodePort(teeNode, teeEndpoint.portId)
    const side = teePort ? getTeeTrunkSideForPort(teeNode, teePort) : null
    if (!teePort || !side) {
      return
    }

    const pipeNode = layout.nodes.find((candidate) => candidate.id === pipeEndpoint.nodeId)
    const pipePort = pipeNode ? getNodePort(pipeNode, pipeEndpoint.portId) : null
    const pipeEdge = pipePort ? getAttachResizeEdgeForPort(pipePort) : null
    if (
      !pipeNode ||
      pipeNode.type !== 'pipeSegment' ||
      !pipePort ||
      !pipeEdge ||
      !isResizeEdgeOnAxis(pipeEdge, axis)
    ) {
      return
    }

    attachments.push({
      relation,
      teeEndpoint,
      teePort,
      pipeEndpoint,
      pipeNode,
      pipePort,
      pipeEdge,
      side,
    })
  })

  return attachments
}

/** T자 ㅡ 축이 양쪽 pipe를 모두 가지고 있는지 확인하고 한 쌍으로 반환한다. */
function getTeeTrunkPipeAttachmentPair(layout: EditorLayout, teeNode: EditorNode) {
  const attachments = getTeeTrunkPipeAttachments(layout, teeNode)
  const min = attachments.find((attachment) => attachment.side === 'min') ?? null
  const max = attachments.find((attachment) => attachment.side === 'max') ?? null

  return min && max ? { min, max } : null
}

/** T자 branch 쪽에 붙은 객체들은 T자 슬라이드와 함께 이동해야 한다. */
function getTeeBranchSideNodeIds(layout: EditorLayout, teeNode: EditorNode) {
  const branchNodeIds = new Set<string>()

  getRelationLinksForNode(layout, teeNode.id).forEach((relation) => {
    const teeEndpoint = getEndpointForNode(relation, teeNode.id)
    if (!teeEndpoint) {
      return
    }

    const teePort = getNodePort(teeNode, teeEndpoint.portId)
    if (!teePort || getTeeTrunkSideForPort(teeNode, teePort)) {
      return
    }

    getRelationSideNodeIds(layout, teeEndpoint).forEach((nodeId) => {
      branchNodeIds.add(nodeId)
    })
  })

  return Array.from(branchNodeIds)
}

/** 우클릭 좌표 변경에 필요한 parent/child/port/axis 정보를 모은다. */
function getCoordinateEditableRelationInfo(
  layout: EditorLayout,
  relation: EditorLink | undefined,
  sourceEndpoint?: EditorPortSelection,
): CoordinateEditableRelationInfo | null {
  if (relation?.type !== 'relation') {
    return null
  }

  const parentNode = layout.nodes.find((node) => node.id === relation.from.nodeId)
  const childNode = layout.nodes.find((node) => node.id === relation.to.nodeId)
  const parentPort = parentNode ? getNodePort(parentNode, relation.from.portId) : null
  const childPort = childNode ? getNodePort(childNode, relation.to.portId) : null
  if (!parentNode || !parentPort || !childNode || !childPort) {
    return null
  }

  const getTeeInfoForEndpoint = (endpoint: EditorEndpoint): CoordinateEditableRelationInfo | null => {
    const teeNode = layout.nodes.find((node) => node.id === endpoint.nodeId)
    const teePort = teeNode ? getNodePort(teeNode, endpoint.portId) : null
    if (!teeNode || teeNode.type !== 'teeConnector' || !teePort || !getTeeTrunkSideForPort(teeNode, teePort)) {
      return null
    }

    if (!getTeeTrunkPipeAttachmentPair(layout, teeNode)) {
      return null
    }

    const counterpartEndpoint = endpointKey(relation.from) === endpointKey(endpoint)
      ? relation.to
      : relation.from
    const counterpartNode = layout.nodes.find((node) => node.id === counterpartEndpoint.nodeId)
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
    if (!counterpartNode || !counterpartPort) {
      return null
    }

    return {
      relation,
      parentNode: teeNode,
      parentPort: teePort,
      childNode: counterpartNode,
      childPort: counterpartPort,
      axis: getTeeTrunkAxis(teeNode),
      mode: 'teeSlide',
      teeEndpoint: endpoint,
    }
  }

  if (sourceEndpoint) {
    const sourceKey = endpointKey(sourceEndpoint)
    if (sourceKey !== endpointKey(relation.from) && sourceKey !== endpointKey(relation.to)) {
      return null
    }

    const teeInfo = getTeeInfoForEndpoint(sourceEndpoint)
    if (teeInfo) {
      return teeInfo
    }

    if (endpointKey(relation.from) !== sourceKey) {
      return null
    }
  } else {
    const teeInfo = getTeeInfoForEndpoint(relation.from) ?? getTeeInfoForEndpoint(relation.to)
    if (teeInfo) {
      return teeInfo
    }
  }

  if (!isCoordinateEditConnectorParent(parentNode)) {
    return null
  }

  const axis = getCoordinateEditablePipeAxis(childNode, childPort)
  if (!axis) {
    return null
  }

  return { relation, parentNode, parentPort, childNode, childPort, axis, mode: 'pipeAttach' }
}

/** T자 객체 우클릭 메뉴에서 trunk 좌표 변경을 시작할 relation을 찾는다. */
function getCoordinateEditableTeeRelationInfo(layout: EditorLayout, nodeId: string) {
  const node = layout.nodes.find((candidate) => candidate.id === nodeId)
  if (!node || node.type !== 'teeConnector') {
    return null
  }

  for (const relation of getRelationLinksForNode(layout, nodeId)) {
    const teeEndpoint = getEndpointForNode(relation, nodeId)
    if (!teeEndpoint) {
      continue
    }

    const info = getCoordinateEditableRelationInfo(layout, relation, teeEndpoint)
    if (info?.mode === 'teeSlide') {
      return info
    }
  }

  return null
}

/** 좌표 객체에서 지정 축의 값을 읽는다. */
function getAxisCoordinate(point: Point, axis: ChangeAxis) {
  return axis === 'x' ? point.x : point.y
}

/** 좌표 변경 중 attach 지점을 다른 anchor 너머로 끌지 못하게 축 범위를 계산한다. */
function getCoordinateEditAxisBounds(
  layout: EditorLayout,
  info: CoordinateEditableRelationInfo,
): { min: number; max: number } | null {
  const { relation, parentNode, parentPort, childNode, childPort, axis } = info
  const currentChildPoint = getEndpointPointWithCounterpart(layout, relation.to, relation.from)
  if (!currentChildPoint) {
    return null
  }

  const minEdge: ResizeEdge = axis === 'x' ? 'left' : 'top'
  const maxEdge: ResizeEdge = axis === 'x' ? 'right' : 'bottom'
  const movingMinClearance = getCounterpartResizeClearance(childNode, childPort, parentNode, parentPort, minEdge)
  const movingMaxClearance = getCounterpartResizeClearance(childNode, childPort, parentNode, parentPort, maxEdge)
  let min = (axis === 'x' ? childNode.x : childNode.y) + movingMinClearance
  let max = (axis === 'x' ? childNode.x + childNode.width : childNode.y + childNode.height) - movingMaxClearance
  const currentCoordinate = getAxisCoordinate(currentChildPoint, axis)

  layout.links.forEach((candidateRelation) => {
    if (candidateRelation.type !== 'relation' || candidateRelation.id === relation.id) {
      return
    }

    const endpoint = getEndpointForNode(candidateRelation, childNode.id)
    const counterpartEndpoint = getOtherRelationEndpoint(candidateRelation, childNode.id)
    if (!endpoint || !counterpartEndpoint) {
      return
    }

    const endpointPort = getNodePort(childNode, endpoint.portId)
    if (!endpointPort || endpointPort.side !== childPort.side) {
      return
    }

    const anchorPoint = getEndpointPointWithCounterpart(layout, endpoint, counterpartEndpoint)
    if (!anchorPoint) {
      return
    }

    const anchorCoordinate = getAxisCoordinate(anchorPoint, axis)
    if (anchorCoordinate < currentCoordinate - ATTACH_ANCHOR_EDGE_EPSILON) {
      const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
      const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
      const anchorClearance = getCounterpartResizeClearance(
        childNode,
        endpointPort,
        counterpartNode ?? null,
        counterpartPort,
        maxEdge,
      )
      min = Math.max(min, anchorCoordinate + anchorClearance + movingMinClearance + ATTACH_ANCHOR_RESIZE_MARGIN)
      return
    }

    if (anchorCoordinate > currentCoordinate + ATTACH_ANCHOR_EDGE_EPSILON) {
      const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
      const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
      const anchorClearance = getCounterpartResizeClearance(
        childNode,
        endpointPort,
        counterpartNode ?? null,
        counterpartPort,
        minEdge,
      )
      max = Math.min(max, anchorCoordinate - anchorClearance - movingMaxClearance - ATTACH_ANCHOR_RESIZE_MARGIN)
    }
  })

  if (max < min) {
    return { min: currentCoordinate, max: currentCoordinate }
  }

  return { min, max }
}

/** T자 커넥터의 ㅡ 축을 따라 슬라이드하고 양쪽 trunk 파이프 길이를 재분배한다. */
function updateTeeConnectorSlide(
  layout: EditorLayout,
  info: CoordinateEditableRelationInfo,
  point: Point,
): EditorLayout {
  const teeNode = info.parentNode
  if (info.mode !== 'teeSlide' || teeNode.type !== 'teeConnector') {
    return layout
  }

  const trunkPair = getTeeTrunkPipeAttachmentPair(layout, teeNode)
  const centerPort = getNodePort(teeNode, 'center')
  if (!trunkPair || !centerPort) {
    return layout
  }

  const axis = info.axis
  const currentCenterPoint = getPortPoint(teeNode, centerPort)
  const currentAxisPoint = getAxisCoordinate(currentCenterPoint, axis)
  const requestedAxisPoint = getAxisCoordinate(point, axis)
  let min = Number.NEGATIVE_INFINITY
  let max = Number.POSITIVE_INFINITY

  ;[trunkPair.min, trunkPair.max].forEach((attachment) => {
    const currentTeePortPoint = getPortPoint(teeNode, attachment.teePort)
    const currentTeePortCoordinate = getAxisCoordinate(currentTeePortPoint, axis)
    const edgeBounds = getPipeResizeEdgeCoordinateBounds(attachment.pipeNode, attachment.pipeEdge)

    min = Math.max(min, edgeBounds.min - currentTeePortCoordinate + currentAxisPoint)
    max = Math.min(max, edgeBounds.max - currentTeePortCoordinate + currentAxisPoint)
  })

  if (max < min) {
    return layout
  }

  const nextAxisPoint = clampNumber(requestedAxisPoint, min, max)
  const delta = nextAxisPoint - currentAxisPoint
  if (Math.abs(delta) < 0.5) {
    return layout
  }

  const move = getAxisMove(axis, delta)
  const movingNodeIds = Array.from(new Set([
    teeNode.id,
    ...getTeeBranchSideNodeIds(layout, teeNode),
  ]))
  let nextLayout = moveNodeIdsBy(layout, movingNodeIds, move.dx, move.dy)
  const movedTeeNode = nextLayout.nodes.find((node) => node.id === teeNode.id)
  const movedTrunkPair = movedTeeNode ? getTeeTrunkPipeAttachmentPair(nextLayout, movedTeeNode) : null
  if (!movedTeeNode || !movedTrunkPair) {
    return nextLayout
  }

  ;[movedTrunkPair.min, movedTrunkPair.max].forEach((attachment) => {
    const currentPipeNode = nextLayout.nodes.find((node) => node.id === attachment.pipeNode.id)
    if (!currentPipeNode) {
      return
    }

    const movedTeePort = getNodePort(movedTeeNode, attachment.teeEndpoint.portId)
    const movedTeePortPoint = movedTeePort
      ? getPortPoint(movedTeeNode, movedTeePort)
      : getPortPoint(movedTeeNode, attachment.teePort)
    const edgeCoordinate = getAxisCoordinate(movedTeePortPoint, axis)
    const resizedPipeNode = resizeNodeEdgeToCoordinate(currentPipeNode, attachment.pipeEdge, edgeCoordinate)
    nextLayout = replaceNodeInLayout(nextLayout, resizedPipeNode)
  })

  return nextLayout
}

/** 좌표 변경 드래그 입력을 relation endpoint와 parent-side 그룹 이동으로 반영한다. */
function updateCoordinateEditEndpoint(
  layout: EditorLayout,
  linkId: string,
  point: Point,
): EditorLayout {
  const relation = layout.links.find((link) => link.id === linkId)
  const coordinateEditInfo = getCoordinateEditableRelationInfo(layout, relation)
  if (!coordinateEditInfo) {
    return layout
  }

  if (coordinateEditInfo.mode === 'teeSlide') {
    return updateTeeConnectorSlide(layout, coordinateEditInfo, point)
  }

  const { relation: editableRelation, axis } = coordinateEditInfo
  const currentParentPoint = getEndpointPointWithCounterpart(layout, editableRelation.from, editableRelation.to)
  if (!currentParentPoint) {
    return layout
  }

  const currentAxisPoint = axis === 'x' ? currentParentPoint.x : currentParentPoint.y
  const axisBounds = getCoordinateEditAxisBounds(layout, coordinateEditInfo)
  const requestedAxisPoint = axis === 'x' ? point.x : point.y
  const nextAxisPoint = axisBounds
    ? clampNumber(requestedAxisPoint, axisBounds.min, axisBounds.max)
    : requestedAxisPoint
  const delta = nextAxisPoint - currentAxisPoint
  if (Math.abs(delta) < 0.5) {
    return layout
  }

  const move = getAxisMove(axis, delta)
  const parentSideNodeIds = getRelationSideNodeIds(layout, editableRelation.to)
  const movingNodeIds = parentSideNodeIds.length > 0 ? parentSideNodeIds : [editableRelation.from.nodeId]
  if (axis === 'y' && hasFixedYNodeInNodeIds(layout, movingNodeIds)) {
    const adjustedLayout = applyRelationEndpointDelta(
      layout,
      editableRelation.from,
      editableRelation.to,
      move.dx,
      move.dy,
      layout,
    )

    return propagateAttachEndpointChanges(
      layout,
      adjustedLayout,
      [editableRelation.from.nodeId],
      new Set([editableRelation.to.nodeId]),
    )
  }

  return moveNodeIdsBy(layout, movingNodeIds, move.dx, move.dy)
}

/** endpoint가 가리키는 포트 또는 노드 중심의 현재 좌표를 반환한다. */
function getEndpointPoint(layout: EditorLayout, endpoint: EditorEndpoint): Point | null {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!node) {
    return null
  }

  const port = getNodePort(node, endpoint.portId)
  if (!port) {
    return getNodeCenter(node)
  }

  return getPortPoint(node, port)
}

/** 상대 endpoint까지 고려해 하단부 attach 보정이 들어간 endpoint 좌표를 반환한다. */
function getEndpointPointWithCounterpart(
  layout: EditorLayout,
  endpoint: EditorEndpoint,
  counterpartEndpoint: EditorEndpoint,
): Point | null {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!node) {
    return null
  }

  const port = getNodePort(node, endpoint.portId)
  if (!port) {
    return getNodeCenter(node)
  }

  const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
  const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null

  return getAttachedPortPoint(node, port, counterpartNode, counterpartPort)
}

/** 일반 링크와 relation 링크의 endpoint 좌표 계산 방식을 통합한다. */
function getLinkEndpointPoint(layout: EditorLayout, link: EditorLink, endpointName: 'from' | 'to') {
  if (link.type !== 'relation') {
    return getEndpointPoint(layout, link[endpointName])
  }

  return endpointName === 'from'
    ? getEndpointPointWithCounterpart(layout, link.from, link.to)
    : getEndpointPointWithCounterpart(layout, link.to, link.from)
}

/** endpoint에서 실제 포트 정의를 찾는다. */
function getEndpointPort(layout: EditorLayout, endpoint: EditorEndpoint): EditorPort | null {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)

  return node ? getNodePort(node, endpoint.portId) : null
}

/** 두 endpoint 좌표를 SVG path 문자열로 연결한다. */
function getLinkPathForPoints(layout: EditorLayout, link: EditorLink, start: Point, end: Point): string {
  if (link.props.route === 'straight') {
    return `M${start.x} ${start.y} L${end.x} ${end.y}`
  }

  const startPort = getEndpointPort(layout, link.from)
  const prefersHorizontalStart = startPort?.side === 'left' || startPort?.side === 'right'

  if (prefersHorizontalStart) {
    const midX = start.x + (end.x - start.x) * 0.58
    return `M${start.x} ${start.y} H${midX} V${end.y} H${end.x}`
  }

  const midY = start.y + (end.y - start.y) * 0.58
  return `M${start.x} ${start.y} V${midY} H${end.x} V${end.y}`
}

/** 링크 endpoint 좌표를 계산한 뒤 렌더링 path를 만든다. */
function getLinkPath(layout: EditorLayout, link: EditorLink): string | null {
  const start = getLinkEndpointPoint(layout, link, 'from')
  const end = getLinkEndpointPoint(layout, link, 'to')
  if (!start || !end) {
    return null
  }

  return getLinkPathForPoints(layout, link, start, end)
}

/** nodeId와 portId를 relation lookup용 문자열 key로 만든다. */
function endpointKey(selection: EditorPortSelection) {
  return `${selection.nodeId}:${selection.portId}`
}

/** 특정 포트에 이미 연결된 relation을 찾는다. */
function getRelationLinkForPort(layout: EditorLayout, port: EditorPortSelection) {
  const portKey = endpointKey(port)

  return layout.links.find((link) => (
    link.type === 'relation' &&
    (endpointKey(link.from) === portKey || endpointKey(link.to) === portKey)
  )) ?? null
}

/** 두 endpoint 사이에 이미 존재하는 relation ID를 찾는다. */
function getRelationIdForEndpointPair(
  layout: EditorLayout,
  firstEndpoint: EditorPortSelection,
  secondEndpoint: EditorPortSelection,
) {
  const firstKey = endpointKey(firstEndpoint)
  const secondKey = endpointKey(secondEndpoint)
  const relation = layout.links.find((link) => (
    link.type === 'relation' &&
    (
      (endpointKey(link.from) === firstKey && endpointKey(link.to) === secondKey) ||
      (endpointKey(link.from) === secondKey && endpointKey(link.to) === firstKey)
    )
  ))

  return relation?.id ?? null
}

/** parent가 child보다 위에 보이도록 relation 깊이를 계산한다. */
function getNodeRenderDepths(layout: EditorLayout) {
  const childNodeIdsByParent = new Map<string, string[]>()
  layout.links.forEach((link) => {
    if (link.type !== 'relation') {
      return
    }

    const childNodeIds = childNodeIdsByParent.get(link.from.nodeId) ?? []
    childNodeIds.push(link.to.nodeId)
    childNodeIdsByParent.set(link.from.nodeId, childNodeIds)
  })

  const depths = new Map<string, number>()
  const visitingNodeIds = new Set<string>()

  const getDepth = (nodeId: string): number => {
    const memoizedDepth = depths.get(nodeId)
    if (memoizedDepth !== undefined) {
      return memoizedDepth
    }

    if (visitingNodeIds.has(nodeId)) {
      return 0
    }

    visitingNodeIds.add(nodeId)
    const childDepth = (childNodeIdsByParent.get(nodeId) ?? []).reduce(
      (maxDepth, childNodeId) => Math.max(maxDepth, getDepth(childNodeId) + 1),
      0,
    )
    visitingNodeIds.delete(nodeId)
    depths.set(nodeId, childDepth)

    return childDepth
  }

  layout.nodes.forEach((node) => getDepth(node.id))
  return depths
}

/** 서로 마주보는 포트 조합이면 직선 relation route를 사용할지 판정한다. */
function shouldUseStraightRoute(fromPort: EditorPort | null, toPort: EditorPort | null) {
  if (!fromPort || !toPort) {
    return false
  }

  const horizontalPair =
    (fromPort.side === 'left' || fromPort.side === 'right') &&
    (toPort.side === 'left' || toPort.side === 'right')
  const verticalPair =
    (fromPort.side === 'top' || fromPort.side === 'bottom') &&
    (toPort.side === 'top' || toPort.side === 'bottom')

  return horizontalPair || verticalPair
}

/** relation 방향 화살표 크기를 child 크기와 거리 기준으로 계산한다. */
function getRelationArrowSize(layout: EditorLayout, link: EditorLink, start: Point, end: Point) {
  const childNode = layout.nodes.find((node) => node.id === link.to.nodeId)
  const childPort = childNode ? getNodePort(childNode, link.to.portId) : null
  const childSpan = childNode && childPort
    ? getPortFaceSpan(childNode, childPort)
    : childNode
      ? Math.min(childNode.width, childNode.height)
      : RELATION_ARROW_MAX_SIZE
  const distanceSize = getPointDistance(start, end) * 0.16
  const childSize = childSpan * 0.32

  return clampNumber(Math.min(distanceSize, childSize), RELATION_ARROW_MIN_SIZE, RELATION_ARROW_MAX_SIZE)
}

/** SVG marker ID에 안전한 문자열로 변환한다. */
function getSvgSafeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** relation 화살표 marker의 고유 ID를 만든다. */
function getRelationMarkerId(link: EditorLink, selected: boolean) {
  return `relation-arrow-${getSvgSafeId(link.id)}-${selected ? 'selected' : 'normal'}`
}

/** attach metadata에 저장할 좌표/비율 값을 소수점 4자리로 정리한다. */
function roundAttachValue(value: number) {
  return Number(value.toFixed(4))
}

/** 노드 특정 면의 ratio 위치에 해당하는 월드 좌표를 계산한다. */
function getPointOnNodeSide(node: EditorNode, side: EditorPortSide, ratio: number): Point {
  const safeRatio = clampNumber(ratio, 0, 1)

  if (side === 'top') {
    return {
      x: node.x + node.width * safeRatio,
      y: node.y,
    }
  }

  if (side === 'bottom') {
    return {
      x: node.x + node.width * safeRatio,
      y: node.y + node.height,
    }
  }

  if (side === 'right') {
    return {
      x: node.x + node.width,
      y: node.y + node.height * safeRatio,
    }
  }

  if (side === 'left') {
    return {
      x: node.x,
      y: node.y + node.height * safeRatio,
    }
  }

  return getNodeCenter(node)
}

/** 월드 좌표가 노드 특정 면에서 차지하는 원시 ratio를 계산한다. */
function getRawRatioOnNodeSide(node: EditorNode, side: EditorPortSide, sourcePoint: Point) {
  if ((side === 'top' || side === 'bottom') && node.width > 0) {
    return (sourcePoint.x - node.x) / node.width
  }

  if ((side === 'left' || side === 'right') && node.height > 0) {
    return (sourcePoint.y - node.y) / node.height
  }

  return 0.5
}

/** endpoint의 실제 attach 좌표와 ratio를 JSON metadata로 만든다. */
function createAttachPointMetadata(
  node: EditorNode,
  endpoint: EditorEndpoint,
  port: EditorPort,
  sourcePoint: Point,
) {
  const rawRatio = getRawRatioOnNodeSide(node, port.side, sourcePoint)
  const ratio = clampNumber(rawRatio, 0, 1)
  const point = getPointOnNodeSide(node, port.side, ratio)

  return {
    nodeId: endpoint.nodeId,
    portId: endpoint.portId,
    side: port.side,
    ratio: roundAttachValue(ratio),
    rawRatio: roundAttachValue(rawRatio),
    point: {
      x: roundAttachValue(point.x),
      y: roundAttachValue(point.y),
    },
  }
}

/** relation의 parent/child 양쪽 attach 최신 좌표 metadata를 계산한다. */
function getRelationAttachMetadata(layout: EditorLayout, link: EditorLink) {
  if (link.type !== 'relation') {
    return undefined
  }

  const parentNode = layout.nodes.find((node) => node.id === link.from.nodeId)
  const childNode = layout.nodes.find((node) => node.id === link.to.nodeId)
  const parentPort = parentNode ? getNodePort(parentNode, link.from.portId) : null
  const childPort = childNode ? getNodePort(childNode, link.to.portId) : null
  if (!parentNode || !childNode || !parentPort || !childPort) {
    return undefined
  }

  const parentPoint = getEndpointPointWithCounterpart(layout, link.from, link.to)
  const childPoint = getEndpointPointWithCounterpart(layout, link.to, link.from)
  if (!parentPoint || !childPoint) {
    return undefined
  }

  return {
    parentEndpoint: createAttachPointMetadata(parentNode, link.from, parentPort, parentPoint),
    childEndpoint: createAttachPointMetadata(childNode, link.to, childPort, childPoint),
    parentOnChild: createAttachPointMetadata(childNode, link.to, childPort, parentPoint),
    childOnParent: createAttachPointMetadata(parentNode, link.from, parentPort, childPoint),
    aligned: getPointDistance(parentPoint, childPoint) < 0.5,
  }
}

/** 저장된 attach 위치를 동적 tap 포트 ID로 변환한다. */
function getTapPortIdForAttachPoint(node: EditorNode, attachPoint: EditorAttachPoint) {
  if (
    attachPoint.side === 'center' ||
    !getResolvableAttachTapSides(node).includes(attachPoint.side)
  ) {
    return null
  }

  const percentage = clampNumber(
    attachPoint.ratio * 100,
    ATTACH_TAP_MIN_PERCENTAGE,
    ATTACH_TAP_MAX_PERCENTAGE,
  )

  return `tap-${attachPoint.side}-${formatAttachTapPercentage(percentage)}`
}

/** attach metadata와 endpoint의 tap 포트 ID가 어긋나면 endpoint를 보정한다. */
function syncTapEndpointToAttachPoint(
  layout: EditorLayout,
  endpoint: EditorEndpoint,
  attachPoint: EditorAttachPoint,
): EditorEndpoint {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!node || !supportsAttachTapPorts(node) || !getAttachTapPortInfo(endpoint.portId)) {
    return endpoint
  }

  const nextPortId = getTapPortIdForAttachPoint(node, attachPoint)
  if (!nextPortId || nextPortId === endpoint.portId) {
    return endpoint
  }

  return {
    ...endpoint,
    portId: nextPortId,
  }
}

/** relation 양쪽 endpoint의 동적 tap 포트 ID를 최신 attach 좌표에 맞춘다. */
function syncRelationTapEndpointPortIds(layout: EditorLayout, link: EditorLink): EditorLink {
  if (link.type !== 'relation') {
    return link
  }

  const attach = getRelationAttachMetadata(layout, link)
  if (!attach) {
    return link
  }

  const from = syncTapEndpointToAttachPoint(layout, link.from, attach.childOnParent)
  const to = syncTapEndpointToAttachPoint(layout, link.to, attach.parentOnChild)
  if (from === link.from && to === link.to) {
    return link
  }

  return {
    ...link,
    from,
    to,
  }
}

/** 모든 relation의 attach metadata와 tap endpoint를 최신 layout 기준으로 정규화한다. */
export function normalizeRelationAttachments(layout: EditorLayout): EditorLayout {
  const linksWithSyncedTapPorts = layout.links.map((link) => syncRelationTapEndpointPortIds(layout, link))
  const syncedLayout = linksWithSyncedTapPorts.some((link, index) => link !== layout.links[index])
    ? { ...layout, links: linksWithSyncedTapPorts }
    : layout

  return {
    ...syncedLayout,
    links: syncedLayout.links.map((link) => {
      if (link.type !== 'relation') {
        if (link.attach === undefined) {
          return link
        }

        const { attach: _attach, ...linkWithoutAttach } = link
        return linkWithoutAttach
      }

      const attach = getRelationAttachMetadata(syncedLayout, link)
      if (!attach) {
        if (link.attach === undefined) {
          return link
        }

        const { attach: _attach, ...linkWithoutAttach } = link
        return linkWithoutAttach
      }

      return {
        ...link,
        attach,
      }
    }),
  }
}

/** 지상/고정 y 객체가 기준 지면에 붙도록 y 좌표를 보정한다. */
function snapNodeToGround(node: EditorNode, groundSurfaceY: number): EditorNode {
  const fixedY = FIXED_NODE_Y_BY_TYPE[node.type]
  if (fixedY !== undefined) {
    return {
      ...node,
      y: fixedY,
    }
  }

  if (!SURFACE_NODE_TYPES.has(node.type)) {
    return node
  }

  return {
    ...node,
    y: groundSurfaceY - node.height,
  }
}

/** 숫자 입력 문자열을 파싱하고 실패 시 fallback을 사용한다. */
function parseNumberInput(value: string, fallback: number) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

/** 선택 패널 숫자 입력에 표시할 문자열을 만든다. */
function formatNumberInput(value: number | undefined) {
  return value === undefined ? '' : String(value)
}

/** 선택/연결/attach 상태에 따라 실제로 화면에 보여줄 포트 목록을 만든다. */
function getNodeRenderablePorts(
  node: EditorNode,
  pendingPort: EditorPortSelection | null,
  includeAttachCandidatePorts: boolean,
  connectedPortKeys: Set<string>,
  selectedRelationPortRoles: Map<string, RelationPortRole>,
) {
  const portsById = new Map(node.ports.map((port) => [port.id, port]))
  if (!supportsAttachTapPorts(node)) {
    return Array.from(portsById.values())
  }

  if (includeAttachCandidatePorts) {
    getAttachCandidatePorts(node).forEach((port) => portsById.set(port.id, port))
  }

  const nodeKeyPrefix = `${node.id}:`
  const addPortFromKey = (portKey: string) => {
    if (!portKey.startsWith(nodeKeyPrefix)) {
      return
    }

    const portId = portKey.slice(nodeKeyPrefix.length)
    const port = getNodePort(node, portId)
    if (port) {
      portsById.set(port.id, port)
    }
  }

  connectedPortKeys.forEach(addPortFromKey)
  selectedRelationPortRoles.forEach((_role, portKey) => addPortFromKey(portKey))
  if (pendingPort?.nodeId === node.id) {
    addPortFromKey(endpointKey(pendingPort))
  }

  return Array.from(portsById.values())
}


// ---------------------------------------------------------------------------
// 레이아웃 정규화와 legacy 데이터 마이그레이션
// ---------------------------------------------------------------------------
/** 저장 JSON과 legacy 데이터를 현재 에디터 스키마로 정리한다. */
function normalizeEditorLayout(layout: EditorLayout): EditorLayout {
  const migratedPipeLinks = layout.links.filter((link) => link.id.startsWith('pipe_free_'))
  const migratedConnectorIds = new Set<string>()
  const migratedPipeNodes = migratedPipeLinks.flatMap((link): EditorNode[] => {
    const startNode = layout.nodes.find((node) => node.id === link.from.nodeId)
    const endNode = layout.nodes.find((node) => node.id === link.to.nodeId)
    const start = getEndpointPoint(layout, link.from)
    const end = getEndpointPoint(layout, link.to)
    if (!startNode || !endNode || !start || !end) {
      return []
    }

    if (startNode.id.startsWith('pipe_free_start_')) {
      migratedConnectorIds.add(startNode.id)
    }
    if (endNode.id.startsWith('pipe_free_end_')) {
      migratedConnectorIds.add(endNode.id)
    }

    const size = link.size
    const height = PIPE_THICKNESS[size] + PIPE_BORDER[size] * 2
    const width = Math.max(160, Math.abs(end.x - start.x))
    const x = Math.min(start.x, end.x)
    const y = (start.y + end.y) / 2 - height / 2

    return [{
      id: link.id,
      swmmId: link.swmmId,
      name: link.name,
      type: 'pipeSegment',
      x,
      y,
      width,
      height,
      ports: CONNECTOR_PORTS,
      props: {
        size,
        pipeKind: normalizePipeKind(link.props.pipeKind),
        slope: link.props.slope ?? 0.001154,
        blockage: link.props.blockage ?? 0,
      },
    }]
  })

  const links = migratedPipeLinks.length
    ? layout.links.filter((link) => !link.id.startsWith('pipe_free_'))
    : layout.links

  const normalizedLinks: EditorLink[] = links.map((link): EditorLink => {
    const normalizedLink = link.type !== 'relation'
      ? {
          ...link,
          props: {
            ...link.props,
            pipeKind: normalizePipeKind(link.props.pipeKind),
          },
        }
      : link

    if (!normalizedLink.id.startsWith('link_')) {
      return normalizedLink
    }

    return {
      ...normalizedLink,
      name: normalizedLink.name === '직선 관' || normalizedLink.name === 'ㄱ자 관' ? '관계' : normalizedLink.name,
      type: 'relation',
    }
  })

  const normalizedLayout: EditorLayout = {
    ...layout,
    links: normalizedLinks,
    nodes: [
      ...layout.nodes.filter((node) => !migratedConnectorIds.has(node.id)).map((node) => {
        const normalizedNode = node.type !== 'connector' || node.width > 30 || node.height > 30
          ? node
          : {
              ...node,
              width: EDITOR_CONNECTOR_SHORT_SIDE,
              height: EDITOR_CONNECTOR_LONG_SIDE,
            }

        const nodeWithProps = (() => {
          if (
            normalizedNode.type === 'connector' ||
            normalizedNode.type === 'elbowConnector' ||
            normalizedNode.type === 'teeConnector' ||
            normalizedNode.type === 'pipeSegment'
          ) {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                size: isEditorPipeSize(normalizedNode.props.size) ? normalizedNode.props.size : 'medium',
                pipeKind: normalizePipeKind(normalizedNode.props.pipeKind),
              },
            }
          }

          if (normalizedNode.type === 'facility') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                facilityKind: normalizeFacilityKind(normalizedNode.props.facilityKind),
              },
            }
          }

          if (normalizedNode.type === 'outfall') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                outfallKind: normalizeOutfallKind(normalizedNode.props.outfallKind),
              },
            }
          }

          if (normalizedNode.type === 'manhole') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                manholeKind: normalizeManholeKind(normalizedNode.props.manholeKind),
              },
            }
          }

          if (normalizedNode.type === 'terrain') {
            return {
              ...normalizedNode,
              props: {
                ...normalizedNode.props,
                terrainKind: normalizeTerrainKind(normalizedNode.props.terrainKind),
              },
            }
          }

          return normalizedNode
        })()

        return snapNodeToGround(
          normalizeNodePorts(normalizeNodeGeometryForPipePreset(nodeWithProps)),
          layout.groundSurfaceY,
        )
      }),
        ...migratedPipeNodes,
      ],
  }

  return normalizeRelationAttachments(normalizedLayout)
}


// ---------------------------------------------------------------------------
// relation 생성, 선택 그룹, 복사/붙여넣기 helper
// ---------------------------------------------------------------------------
/** 두 포트 선택으로 새 링크 또는 relation 객체를 생성한다. */
function createLink(layout: EditorLayout, from: EditorPortSelection, to: EditorPortSelection): EditorLink {
  const fromPort = getEndpointPort(layout, from)
  const toPort = getEndpointPort(layout, to)
  const route = shouldUseStraightRoute(fromPort, toPort) ? 'straight' : 'elbow'
  const id = `link_${Date.now()}`

  return {
    id,
    swmmId: id,
    name: '관계',
    type: 'relation',
    from,
    to,
    size: 'medium',
    props: {
      route,
      slope: route === 'straight' ? 0.001154 : 0.03,
      blockage: 0,
    },
  }
}

/** relation으로 연결된 동일 그룹의 노드 ID를 탐색한다. */
function getRelationGroupNodeIds(layout: EditorLayout, startNodeId: string): string[] {
  const visited = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()
    if (!currentNodeId) {
      continue
    }

    layout.links.forEach((link) => {
      if (link.type !== 'relation') {
        return
      }

      let nextNodeId: string | null = null
      if (link.from.nodeId === currentNodeId) {
        nextNodeId = link.to.nodeId
      } else if (link.to.nodeId === currentNodeId) {
        nextNodeId = link.from.nodeId
      }

      if (nextNodeId && !visited.has(nextNodeId)) {
        visited.add(nextNodeId)
        queue.push(nextNodeId)
      }
    })
  }

  return Array.from(visited)
}

/** 선택된 노드 일부가 relation 그룹이면 그룹 전체 선택으로 확장한다. */
function getExpandedRelationGroupNodeIds(layout: EditorLayout, nodeIds: string[]): string[] {
  const expandedNodeIds = new Set<string>()

  nodeIds.forEach((nodeId) => {
    getRelationGroupNodeIds(layout, nodeId).forEach((groupNodeId) => {
      expandedNodeIds.add(groupNodeId)
    })
  })

  return Array.from(expandedNodeIds)
}

/** 현재 selection에서 노드 ID 목록만 추출한다. */
function getSelectionNodeIds(selection: EditorSelection): string[] {
  if (!selection) {
    return []
  }

  if (selection.kind === 'node') {
    return [selection.id]
  }

  if (selection.kind === 'multi') {
    return selection.ids
  }

  return []
}

/** 영역 선택 사각형과 겹치는 노드를 찾는다. */
function getMarqueeSelectedNodeIds(layout: EditorLayout, rect: RectBounds): string[] {
  return layout.nodes
    .filter((node) => rectsIntersect(rect, getNodeRect(node)))
    .map((node) => node.id)
}

/** drag 시작 시 각 노드의 원래 좌표를 보관한다. */
function getOriginNodes(layout: EditorLayout, nodeIds: string[]): Record<string, Point> {
  const selectedNodeIds = new Set(nodeIds)

  return Object.fromEntries(
    layout.nodes
      .filter((candidate) => selectedNodeIds.has(candidate.id))
      .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
  )
}

/** 복사/붙여넣기 시 기존 ID와 충돌하지 않는 새 ID를 만든다. */
function createUniqueLayoutId(existingIds: Set<string>, prefix: string) {
  const timestamp = Date.now()
  let index = 1
  let id = `${prefix}_${timestamp}_${index}`

  while (existingIds.has(id)) {
    index += 1
    id = `${prefix}_${timestamp}_${index}`
  }

  existingIds.add(id)
  return id
}

/** 복사본 이름이 기존 이름과 충돌하지 않도록 새 이름을 만든다. */
function createUniqueCopyName(name: string, existingNames: Set<string>) {
  const baseName = `${name} 복사`
  let nextName = baseName
  let index = 2

  while (existingNames.has(nextName)) {
    nextName = `${baseName} ${index}`
    index += 1
  }

  existingNames.add(nextName)
  return nextName
}

/** 현재 선택된 노드/링크를 붙여넣기 가능한 스냅샷으로 만든다. */
function createCopiedEditorSelection(layout: EditorLayout, selection: EditorSelection): CopiedEditorSelection | null {
  const selectedNodeIds = getSelectionNodeIds(selection)
  if (selectedNodeIds.length === 0) {
    return null
  }

  const copiedNodeIds = new Set(getExpandedRelationGroupNodeIds(layout, selectedNodeIds))
  const nodes = layout.nodes.filter((node) => copiedNodeIds.has(node.id))
  if (nodes.length === 0) {
    return null
  }

  const links = layout.links.filter(
    (link) => copiedNodeIds.has(link.from.nodeId) && copiedNodeIds.has(link.to.nodeId),
  )

  return {
    nodes: structuredClone(nodes),
    links: structuredClone(links),
  }
}

/** 복사 스냅샷의 ID를 재생성하고 새 위치에 붙여넣는다. */
function pasteCopiedEditorSelection(
  layout: EditorLayout,
  copiedSelection: CopiedEditorSelection,
): { layout: EditorLayout; selectedNodeIds: string[] } {
  const existingNodeIds = new Set(layout.nodes.map((node) => node.id))
  const existingLinkIds = new Set(layout.links.map((link) => link.id))
  const existingNames = new Set(layout.nodes.map((node) => node.name))
  const nodeIdMap = new Map<string, string>()
  const hasFixedYNode = copiedSelection.nodes.some((node) => isFixedYNode(node))
  const dx = 32
  const dy = hasFixedYNode ? 0 : 32

  const pastedNodes = copiedSelection.nodes.map((node) => {
    const nextId = createUniqueLayoutId(existingNodeIds, `${node.type}_copy`)
    nodeIdMap.set(node.id, nextId)

    return snapNodeToGround(
      normalizeNodePorts({
        ...node,
        id: nextId,
        swmmId: nextId,
        name: createUniqueCopyName(node.name, existingNames),
        x: node.x + dx,
        y: node.y + dy,
        ports: node.ports.map((port) => ({ ...port })),
        props: { ...node.props },
      }),
      layout.groundSurfaceY,
    )
  })

  const pastedLinks = copiedSelection.links.flatMap((link) => {
    const fromNodeId = nodeIdMap.get(link.from.nodeId)
    const toNodeId = nodeIdMap.get(link.to.nodeId)
    if (!fromNodeId || !toNodeId) {
      return []
    }

    const nextId = createUniqueLayoutId(existingLinkIds, 'link_copy')
    const pastedLink: EditorLink = {
      ...link,
      id: nextId,
      swmmId: nextId,
      from: {
        ...link.from,
        nodeId: fromNodeId,
      },
      to: {
        ...link.to,
        nodeId: toNodeId,
      },
      props: { ...link.props },
    }

    delete pastedLink.attach
    return [pastedLink]
  })

  return {
    layout: normalizeRelationAttachments({
      ...layout,
      nodes: [...layout.nodes, ...pastedNodes],
      links: [...layout.links, ...pastedLinks],
    }),
    selectedNodeIds: pastedNodes.map((node) => node.id),
  }
}


// ---------------------------------------------------------------------------
// relation 그래프 탐색과 순환 방지 helper
// ---------------------------------------------------------------------------
/** 특정 노드의 relation parent 체인을 위쪽으로 탐색한다. */
function getRelationAncestorNodeIds(layout: EditorLayout, startNodeId: string): string[] {
  const visited = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()
    if (!currentNodeId) {
      continue
    }

    layout.links.forEach((link) => {
      if (link.type !== 'relation' || link.to.nodeId !== currentNodeId) {
        return
      }

      const nextNodeId = link.from.nodeId
      if (!visited.has(nextNodeId)) {
        visited.add(nextNodeId)
        queue.push(nextNodeId)
      }
    })
  }

  return Array.from(visited)
}

/** 새 relation이 parent-child 순환을 만들지 확인한다. */
function wouldCreateRelationCycle(layout: EditorLayout, parentNodeId: string, childNodeId: string) {
  return getRelationAncestorNodeIds(layout, parentNodeId).includes(childNodeId)
}

/** 특정 endpoint 기준으로 반대편 relation 그룹을 구한다. */
function getRelationSideNodeIds(layout: EditorLayout, endpoint: EditorPortSelection): string[] {
  const relation = getRelationLinkForPort(layout, endpoint)
  if (!relation) {
    return []
  }

  const blockedNodeId = endpoint.nodeId
  const startNodeId = relation.from.nodeId === blockedNodeId ? relation.to.nodeId : relation.from.nodeId
  const visited = new Set<string>([blockedNodeId])
  const sideNodeIds = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentNodeId = queue.shift()
    if (!currentNodeId) {
      continue
    }

    visited.add(currentNodeId)

    layout.links.forEach((link) => {
      if (link.type !== 'relation') {
        return
      }

      let nextNodeId: string | null = null
      if (link.from.nodeId === currentNodeId) {
        nextNodeId = link.to.nodeId
      } else if (link.to.nodeId === currentNodeId) {
        nextNodeId = link.from.nodeId
      }

      if (!nextNodeId || visited.has(nextNodeId)) {
        return
      }

      visited.add(nextNodeId)
      sideNodeIds.add(nextNodeId)
      queue.push(nextNodeId)
    })
  }

  return Array.from(sideNodeIds)
}

/** 특정 노드가 참여한 모든 relation을 찾는다. */
function getRelationLinksForNode(layout: EditorLayout, nodeId: string) {
  return layout.links.filter((link) => (
    link.type === 'relation' &&
    (link.from.nodeId === nodeId || link.to.nodeId === nodeId)
  ))
}

/** relation에서 현재 노드 반대편 endpoint를 반환한다. */
function getOtherRelationEndpoint(link: EditorLink, nodeId: string): EditorPortSelection | null {
  if (link.from.nodeId === nodeId) {
    return link.to
  }

  if (link.to.nodeId === nodeId) {
    return link.from
  }

  return null
}

/** relation에서 현재 노드가 차지하는 endpoint를 반환한다. */
function getEndpointForNode(link: EditorLink, nodeId: string): EditorPortSelection | null {
  if (link.from.nodeId === nodeId) {
    return link.from
  }

  if (link.to.nodeId === nodeId) {
    return link.to
  }

  return null
}


// ---------------------------------------------------------------------------
// relation 전파와 길이/좌표 보정 규칙
// ---------------------------------------------------------------------------
/** layout 안의 특정 노드를 새 노드 값으로 교체한다. */
function replaceNodeInLayout(layout: EditorLayout, nextNode: EditorNode): EditorLayout {
  return {
    ...layout,
    nodes: layout.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
  }
}

/** 축과 delta를 dx/dy 이동량으로 변환한다. */
function getAxisMove(axis: ChangeAxis, delta: number) {
  return axis === 'x'
    ? { dx: delta, dy: 0 }
    : { dx: 0, dy: delta }
}

/** resize edge가 특정 축의 길이 변경에 해당하는지 판정한다. */
function isResizeEdgeOnAxis(edge: ResizeEdge, axis: ChangeAxis) {
  return axis === 'x'
    ? edge === 'left' || edge === 'right'
    : edge === 'top' || edge === 'bottom'
}

/** 전파 대상 노드에서 지정 축을 조정할 수 있는 endpoint edge를 찾는다. */
function getResizableEndpointForAxis(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  axis: ChangeAxis,
) {
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  const port = node ? getNodePort(node, endpoint.portId) : null
  if (!node || !port) {
    return null
  }

  const resizeEdge = getAttachResizeEdgeForPort(port)
  const resizableEdges = getAttachResizableEdges(node)
  if (!resizeEdge || !resizableEdges[resizeEdge] || !isResizeEdgeOnAxis(resizeEdge, axis)) {
    return null
  }

  return { node, port, resizeEdge }
}

/** 노드의 위치나 크기가 실제로 변경되었는지 비교한다. */
function hasNodeLayoutChanged(first: EditorNode, second: EditorNode) {
  return (
    first.x !== second.x ||
    first.y !== second.y ||
    first.width !== second.width ||
    first.height !== second.height
  )
}

/** relation endpoint 변화량을 노드 resize 또는 이동으로 해소한다. */
function resizeRelationEndpointOnAxisByDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  axis: ChangeAxis,
  delta: number,
  anchorLayout = layout,
) {
  if (Math.abs(delta) < 0.5) {
    return null
  }

  const currentPoint = getEndpointPointWithCounterpart(layout, endpoint, counterpartEndpoint)
  const node = layout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  if (!currentPoint || !node) {
    return null
  }

  const activeRelationId = getRelationIdForEndpointPair(anchorLayout, endpoint, counterpartEndpoint)
  const ignoredAnchorRelationIds = activeRelationId ? new Set([activeRelationId]) : undefined

  if (axis === 'y') {
    const endpointPort = getNodePort(node, endpoint.portId)
    const anchorNode = anchorLayout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
    const anchorBounds = anchorNode
      ? getResizeAnchorBoundsForNode(anchorLayout, anchorNode, ignoredAnchorRelationIds)
      : undefined
    const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null
    const resizedBranchNode = resizeBranchNodeToEndpointY(
      node,
      node,
      endpoint,
      currentPoint.y + delta,
      counterpartNode,
      counterpartPort,
    )
    if (resizedBranchNode && endpointPort) {
      const resizeEdge = node.type === 'manhole' && (endpointPort.side === 'left' || endpointPort.side === 'right')
        ? 'bottom'
        : getAttachResizeEdgeForPort(endpointPort)
      const guardedBranchNode = resizeEdge
        ? clampNodeResizeByInternalRelationAnchors(
            anchorLayout,
            anchorNode ?? node,
            resizedBranchNode,
            resizeEdge,
            anchorBounds,
          )
        : resizedBranchNode
      const resizedLayout = replaceNodeInLayout(layout, guardedBranchNode)
      const nextPoint = getEndpointPointWithCounterpart(resizedLayout, endpoint, counterpartEndpoint)
      const achievedDelta = nextPoint ? nextPoint.y - currentPoint.y : 0
      if (Math.abs(achievedDelta) >= 0.5 && Math.sign(achievedDelta) === Math.sign(delta)) {
        return {
          layout: resizedLayout,
          achievedDelta,
        }
      }
    }
  }

  const target = getResizableEndpointForAxis(layout, endpoint, axis)
  if (!target) {
    return null
  }

  const desiredCoordinate = axis === 'x' ? currentPoint.x + delta : currentPoint.y + delta
  const resizedNode = resizeNodeEdgeToCoordinate(target.node, target.resizeEdge, desiredCoordinate)
  const anchorNode = anchorLayout.nodes.find((candidate) => candidate.id === endpoint.nodeId)
  const guardedNode = clampNodeResizeByInternalRelationAnchors(
    anchorLayout,
    anchorNode ?? target.node,
    resizedNode,
    target.resizeEdge,
    anchorNode ? getResizeAnchorBoundsForNode(anchorLayout, anchorNode, ignoredAnchorRelationIds) : undefined,
  )
  const resizedLayout = replaceNodeInLayout(layout, guardedNode)
  const nextPoint = getEndpointPointWithCounterpart(resizedLayout, endpoint, counterpartEndpoint)
  if (!nextPoint) {
    return null
  }

  const achievedDelta = axis === 'x'
    ? nextPoint.x - currentPoint.x
    : nextPoint.y - currentPoint.y
  if (Math.abs(achievedDelta) < 0.5 || Math.sign(achievedDelta) !== Math.sign(delta)) {
    return null
  }

  return {
    layout: resizedLayout,
    achievedDelta,
  }
}

/** 특정 축의 endpoint delta를 layout에 적용한다. */
function applyRelationEndpointAxisDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  axis: ChangeAxis,
  delta: number,
  anchorLayout = layout,
) {
  if (Math.abs(delta) < 0.5) {
    return layout
  }

  let nextLayout = layout
  let remainingDelta = delta
  const resizeResult = resizeRelationEndpointOnAxisByDelta(
    nextLayout,
    endpoint,
    counterpartEndpoint,
    axis,
    remainingDelta,
    anchorLayout,
  )
  if (resizeResult) {
    nextLayout = resizeResult.layout
    remainingDelta -= resizeResult.achievedDelta
  }

  if (Math.abs(remainingDelta) < 0.5) {
    return nextLayout
  }

  const move = getAxisMove(axis, remainingDelta)
  return moveNodeIdsBy(nextLayout, [endpoint.nodeId], move.dx, move.dy)
}

/** x/y endpoint delta를 순서대로 적용해 노드를 맞춘다. */
function applyRelationEndpointDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  dx: number,
  dy: number,
  anchorLayout = layout,
) {
  let nextLayout = applyRelationEndpointAxisDelta(layout, endpoint, counterpartEndpoint, 'x', dx, anchorLayout)
  nextLayout = applyRelationEndpointAxisDelta(nextLayout, endpoint, counterpartEndpoint, 'y', dy, anchorLayout)

  return nextLayout
}

/** parent-to-child 전파 중 child endpoint를 보정한다. */
function applyPropagatedRelationEndpointDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  dx: number,
  dy: number,
  anchorLayout = layout,
  options: ChildPropagationOptions = {},
) {
  if (options.sourceLengthAxis !== 'x') {
    return applyRelationEndpointDelta(layout, endpoint, counterpartEndpoint, dx, dy, anchorLayout)
  }

  return moveNodeIdsBy(layout, [endpoint.nodeId], dx, dy)
}

/** 다중 parent child에서 다른 parent 쪽 endpoint를 1단계 보정한다. */
function applyReverseParentEndpointDelta(
  layout: EditorLayout,
  endpoint: EditorPortSelection,
  counterpartEndpoint: EditorPortSelection,
  dx: number,
  dy: number,
  anchorLayout = layout,
  sourceLengthAxis?: ChangeAxis | null,
) {
  if (sourceLengthAxis === 'x') {
    return moveNodeIdsBy(layout, [endpoint.nodeId], dx, dy)
  }

  if (sourceLengthAxis === 'y') {
    return applyRelationEndpointDelta(layout, endpoint, counterpartEndpoint, dx, dy, anchorLayout)
  }

  let nextLayout = layout

  if (Math.abs(dx) >= 0.5) {
    const move = getAxisMove('x', dx)
    nextLayout = moveNodeIdsBy(nextLayout, [endpoint.nodeId], move.dx, move.dy)
  }

  nextLayout = applyRelationEndpointAxisDelta(
    nextLayout,
    endpoint,
    counterpartEndpoint,
    'y',
    dy,
    anchorLayout,
  )

  return nextLayout
}

/** attach/resize 이후 parent 변경을 child 체인으로 전파한다. */
function propagateAttachEndpointChanges(
  baseLayout: EditorLayout,
  nextLayout: EditorLayout,
  changedNodeIds: string[],
  blockedNodeIds = new Set<string>(),
  options: ChildPropagationOptions = {},
) {
  if (
    !ENABLE_PARENT_CHILD_PROPAGATION_RULE ||
    changedNodeIds.length === 0
  ) {
    return nextLayout
  }

  let propagatedLayout = nextLayout
  const queue = [...new Set(changedNodeIds.filter((nodeId) => !blockedNodeIds.has(nodeId)))]
  const processedRelationIds = new Set<string>()

  while (queue.length > 0) {
    const changedNodeId = queue.shift()
    if (!changedNodeId || blockedNodeIds.has(changedNodeId)) {
      continue
    }

    getRelationLinksForNode(baseLayout, changedNodeId).forEach((relation) => {
      if (processedRelationIds.has(relation.id)) {
        return
      }
      processedRelationIds.add(relation.id)

      const changedEndpoint = getEndpointForNode(relation, changedNodeId)
      const targetEndpoint = getOtherRelationEndpoint(relation, changedNodeId)
      if (!changedEndpoint || !targetEndpoint || blockedNodeIds.has(targetEndpoint.nodeId)) {
        return
      }

      const baseChangedPoint = getEndpointPointWithCounterpart(baseLayout, changedEndpoint, targetEndpoint)
      const nextChangedPoint = getEndpointPointWithCounterpart(
        propagatedLayout,
        changedEndpoint,
        targetEndpoint,
      )
      if (!baseChangedPoint || !nextChangedPoint) {
        return
      }

      const dx = nextChangedPoint.x - baseChangedPoint.x
      const dy = nextChangedPoint.y - baseChangedPoint.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return
      }

      const targetBefore = propagatedLayout.nodes.find((node) => node.id === targetEndpoint.nodeId)
      if (!targetBefore) {
        return
      }

      propagatedLayout = applyPropagatedRelationEndpointDelta(
        propagatedLayout,
        targetEndpoint,
        changedEndpoint,
        dx,
        dy,
        baseLayout,
        options,
      )

      const targetAfter = propagatedLayout.nodes.find((node) => node.id === targetEndpoint.nodeId)
      if (targetAfter && hasNodeLayoutChanged(targetBefore, targetAfter)) {
        queue.push(targetAfter.id)
      }
    })
  }

  return propagatedLayout
}

/** child가 움직였을 때 다중 parent 보정이 필요한 incoming parent를 처리한다. */
function propagateIncomingParentEndpointChanges(
  baseLayout: EditorLayout,
  nextLayout: EditorLayout,
  changedChildNodeId: string,
  ignoredRelationId: string,
  processedRelationIds: Set<string>,
  options: ChildPropagationOptions = {},
) {
  let propagatedLayout = nextLayout
  const processedIncomingRelationIds = new Set<string>()

  baseLayout.links.forEach((incomingRelation) => {
    if (
      incomingRelation.type !== 'relation' ||
      incomingRelation.to.nodeId !== changedChildNodeId ||
      incomingRelation.id === ignoredRelationId ||
      processedRelationIds.has(incomingRelation.id) ||
      processedIncomingRelationIds.has(incomingRelation.id)
    ) {
      return
    }
    processedIncomingRelationIds.add(incomingRelation.id)

    const baseChildPoint = getEndpointPointWithCounterpart(
      baseLayout,
      incomingRelation.to,
      incomingRelation.from,
    )
    const nextChildPoint = getEndpointPointWithCounterpart(
      propagatedLayout,
      incomingRelation.to,
      incomingRelation.from,
    )
    if (!baseChildPoint || !nextChildPoint) {
      return
    }

    const dx = nextChildPoint.x - baseChildPoint.x
    const dy = nextChildPoint.y - baseChildPoint.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      return
    }

    const parentBefore = propagatedLayout.nodes.find((node) => node.id === incomingRelation.from.nodeId)
    if (!parentBefore) {
      return
    }

    propagatedLayout = applyReverseParentEndpointDelta(
      propagatedLayout,
      incomingRelation.from,
      incomingRelation.to,
      dx,
      dy,
      baseLayout,
      options.sourceLengthAxis,
    )

    const parentAfter = propagatedLayout.nodes.find((node) => node.id === incomingRelation.from.nodeId)
    if (!parentAfter || !hasNodeLayoutChanged(parentBefore, parentAfter)) {
      return
    }

    propagatedLayout = propagateAttachEndpointChanges(
      baseLayout,
      propagatedLayout,
      [parentAfter.id],
      new Set([changedChildNodeId]),
      options,
    )

    processedRelationIds.add(incomingRelation.id)
  })

  return propagatedLayout
}

/** 특정 child가 현재 relation 외의 parent를 더 가지고 있는지 확인한다. */
function hasOtherIncomingParentRelation(
  layout: EditorLayout,
  childNodeId: string,
  ignoredRelationId: string,
) {
  return layout.links.some((relation) => (
    relation.type === 'relation' &&
    relation.to.nodeId === childNodeId &&
    relation.id !== ignoredRelationId
  ))
}

/** 한 노드 변경 후 직결 child와 필요한 parent 보정을 queue로 전파한다. */
function propagateChildEndpointChanges(
  baseLayout: EditorLayout,
  nextLayout: EditorLayout,
  changedParentNodeIds: string[],
  options: ChildPropagationOptions = {},
) {
  if (
    !ENABLE_PARENT_CHILD_PROPAGATION_RULE ||
    changedParentNodeIds.length === 0
  ) {
    return nextLayout
  }

  let propagatedLayout = nextLayout
  const queue = [...new Set(changedParentNodeIds)]
  const processedRelationIds = new Set<string>()

  while (queue.length > 0) {
    const parentNodeId = queue.shift()
    if (!parentNodeId) {
      continue
    }

    baseLayout.links.forEach((relation) => {
      if (
        relation.type !== 'relation' ||
        relation.from.nodeId !== parentNodeId ||
        processedRelationIds.has(relation.id)
      ) {
        return
      }
      processedRelationIds.add(relation.id)

      const baseParentPoint = getEndpointPointWithCounterpart(baseLayout, relation.from, relation.to)
      const nextParentPoint = getEndpointPointWithCounterpart(propagatedLayout, relation.from, relation.to)
      if (!baseParentPoint || !nextParentPoint) {
        return
      }

      const dx = nextParentPoint.x - baseParentPoint.x
      const dy = nextParentPoint.y - baseParentPoint.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return
      }

      const childBefore = propagatedLayout.nodes.find((node) => node.id === relation.to.nodeId)
      if (!childBefore) {
        return
      }

      propagatedLayout = applyPropagatedRelationEndpointDelta(
        propagatedLayout,
        relation.to,
        relation.from,
        dx,
        dy,
        baseLayout,
        options,
      )

      const childAfter = propagatedLayout.nodes.find((node) => node.id === relation.to.nodeId)
      if (childAfter && hasNodeLayoutChanged(childBefore, childAfter)) {
        if (
          ENABLE_REVERSE_PARENT_PROPAGATION_RULE &&
          hasOtherIncomingParentRelation(baseLayout, childAfter.id, relation.id)
        ) {
          const reverseResult = propagateIncomingParentEndpointChanges(
            baseLayout,
            propagatedLayout,
            childAfter.id,
            relation.id,
            processedRelationIds,
            options,
          )
          propagatedLayout = reverseResult
        }
        queue.push(childAfter.id)
      }
    })
  }

  return propagatedLayout
}


// ---------------------------------------------------------------------------
// 노드 이동, drag, resize helper
// ---------------------------------------------------------------------------
/** 노드 ID 목록을 같은 dx/dy만큼 이동하고 relation 전파를 실행한다. */
function moveNodeIdsBy(layout: EditorLayout, nodeIds: string[], dx: number, dy: number): EditorLayout {
  if (nodeIds.length === 0 || (dx === 0 && dy === 0)) {
    return layout
  }

  const movingNodeIds = new Set(nodeIds)

  return {
    ...layout,
    nodes: layout.nodes.map((node) => (
      movingNodeIds.has(node.id)
        ? snapNodeToGround({ ...node, x: node.x + dx, y: node.y + dy }, layout.groundSurfaceY)
        : node
    )),
  }
}

/** 고정 y branch의 세로 길이를 endpoint y 위치에 맞춰 역산한다. */
function resizeBranchNodeToEndpointY(
  baseNode: EditorNode,
  currentNode: EditorNode,
  endpoint: EditorPortSelection,
  desiredY: number,
  counterpartNode?: EditorNode | null,
  counterpartPort?: EditorPort | null,
): EditorNode | null {
  const port = getNodePort(baseNode, endpoint.portId)
  if (!port) {
    return null
  }

  if (baseNode.type === 'pipeSegment') {
    if (getNodeOrientation(baseNode) !== 'vertical') {
      return null
    }

    if (port.side === 'bottom') {
      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: baseNode.y,
        width: baseNode.width,
        height: Math.max(MIN_PIPE_SEGMENT_LENGTH, desiredY - baseNode.y),
      })
    }

    if (port.side === 'top') {
      const bottom = baseNode.y + baseNode.height
      const height = Math.max(MIN_PIPE_SEGMENT_LENGTH, bottom - desiredY)

      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: bottom - height,
        width: baseNode.width,
        height,
      })
    }

    return null
  }

  if (baseNode.type === 'manhole') {
    if (port.side === 'bottom') {
      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: baseNode.y,
        width: baseNode.width,
        height: Math.max(MIN_MANHOLE_HEIGHT, desiredY - baseNode.y),
      })
    }

    if (port.side === 'left' || port.side === 'right') {
      const counterpartHalfSpan = counterpartNode && counterpartPort
        ? getLowerSideAttachmentCounterpartHalfSpan(counterpartNode, counterpartPort)
        : LOWER_SIDE_PORT_BOTTOM_GAP
      const height = getHeightForLowerSideAttachmentOffset(
        desiredY - baseNode.y,
        counterpartHalfSpan,
        MIN_MANHOLE_HEIGHT,
      )

      return normalizeNodePorts({
        ...currentNode,
        x: baseNode.x,
        y: baseNode.y,
        width: baseNode.width,
        height,
      })
    }
  }

  return null
}

/** 드래그 중 relation 그룹의 목표 좌표를 계산하고 이동 제약을 적용한다. */
function moveDragGroupTo(layout: EditorLayout, dragState: DragState, x: number, y: number): EditorLayout {
  const rootOrigin = dragState.originNodes[dragState.nodeId]
  if (!rootOrigin) {
    return layout
  }

  const dx = x - rootOrigin.x
  const groupNodeIds = new Set(dragState.groupNodeIds)
  const hasFixedYNode = layout.nodes.some((node) => groupNodeIds.has(node.id) && isFixedYNode(node))
  const dy = hasFixedYNode ? 0 : y - rootOrigin.y

  return {
    ...layout,
    nodes: layout.nodes.map((node) => {
      if (!groupNodeIds.has(node.id)) {
        return node
      }

      const originNode = dragState.originNodes[node.id]
      if (!originNode) {
        return node
      }

      const movedNode = {
        ...node,
        x: originNode.x + dx,
        y: originNode.y + dy,
      }

      return hasFixedYNode ? movedNode : snapNodeToGround(movedNode, layout.groundSurfaceY)
    }),
  }
}

/** 커서 위치 기준으로 노드의 특정 edge를 직접 resize한다. */
function resizeNodeFromEdge(node: EditorNode, edge: ResizeEdge, cursor: Point): EditorNode {
  if (!ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE) {
    return node
  }

  if (node.type === 'road') {
    if (edge === 'right') {
      return {
        ...node,
        width: Math.max(MIN_ROAD_WIDTH, cursor.x - node.x),
      }
    }

    if (edge === 'left') {
      const right = node.x + node.width
      const width = Math.max(MIN_ROAD_WIDTH, right - cursor.x)

      return {
        ...node,
        x: right - width,
        width,
      }
    }

    return node
  }

  if (node.type === 'terrain') {
    if (edge === 'right') {
      return {
        ...node,
        width: Math.max(MIN_TERRAIN_WIDTH, cursor.x - node.x),
      }
    }

    if (edge === 'left') {
      const right = node.x + node.width
      const width = Math.max(MIN_TERRAIN_WIDTH, right - cursor.x)

      return {
        ...node,
        x: right - width,
        width,
      }
    }

    if (edge === 'bottom') {
      return {
        ...node,
        height: Math.max(MIN_TERRAIN_HEIGHT, cursor.y - node.y),
      }
    }

    return node
  }

  if (node.type === 'manhole') {
    if (edge !== 'bottom') {
      return node
    }

    return {
      ...node,
      height: Math.max(MIN_MANHOLE_HEIGHT, cursor.y - node.y),
    }
  }

  if (node.type !== 'pipeSegment') {
    return node
  }

  const isHorizontal = getNodeOrientation(node) === 'horizontal'

  if (isHorizontal) {
    if (edge === 'right') {
      return {
        ...node,
        width: Math.max(MIN_PIPE_SEGMENT_LENGTH, cursor.x - node.x),
      }
    }

    if (edge === 'left') {
      const right = node.x + node.width
      const width = Math.max(MIN_PIPE_SEGMENT_LENGTH, right - cursor.x)

      return {
        ...node,
        x: right - width,
        width,
      }
    }

    return node
  }

  if (edge === 'bottom') {
    return {
      ...node,
      height: Math.max(MIN_PIPE_SEGMENT_LENGTH, cursor.y - node.y),
    }
  }

  if (edge === 'top') {
    const bottom = node.y + node.height
    const height = Math.max(MIN_PIPE_SEGMENT_LENGTH, bottom - cursor.y)

    return {
      ...node,
      y: bottom - height,
      height,
    }
  }

  return node
}

/** resize edge가 담당하는 축을 반환한다. */
function getResizeEdgeAxis(edge: ResizeEdge): ChangeAxis {
  return edge === 'left' || edge === 'right' ? 'x' : 'y'
}

/** 노드의 x/y 축 길이를 읽는다. */
function getNodeLengthOnAxis(node: EditorNode, axis: ChangeAxis) {
  return axis === 'x' ? node.width : node.height
}

/** 노드 특정 edge에 길이 delta를 적용한다. */
function resizeNodeFromEdgeByLengthDelta(
  node: EditorNode,
  edge: ResizeEdge,
  deltaLength: number,
): EditorNode {
  if (!ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE) {
    return node
  }

  if (Math.abs(deltaLength) < 0.5) {
    return node
  }

  if (edge === 'right') {
    return resizeNodeEdgeToCoordinate(node, edge, node.x + node.width + deltaLength)
  }

  if (edge === 'left') {
    return resizeNodeEdgeToCoordinate(node, edge, node.x - deltaLength)
  }

  if (edge === 'bottom') {
    return resizeNodeEdgeToCoordinate(node, edge, node.y + node.height + deltaLength)
  }

  return resizeNodeEdgeToCoordinate(node, edge, node.y - deltaLength)
}

/** 길이 변경을 child 방향으로 보낼 때 사용할 edge를 고른다. */
function getChildResizeEdgeForLengthChange(
  layout: EditorLayout,
  node: EditorNode,
  requestedEdge: ResizeEdge,
): ResizeEdge | null {
  const axis = getResizeEdgeAxis(requestedEdge)
  const resizableEdges = getAttachResizableEdges(node)

  for (const relation of layout.links) {
    if (relation.type !== 'relation' || relation.from.nodeId !== node.id) {
      continue
    }

    const port = getNodePort(node, relation.from.portId)
    const childEdge = port ? getAttachResizeEdgeForPort(port) : null
    if (
      childEdge &&
      resizableEdges[childEdge] &&
      isResizeEdgeOnAxis(childEdge, axis)
    ) {
      return childEdge
    }
  }

  return null
}

/** 수동 resize 결과를 relation child 방향 edge 변경으로 보정한다. */
function redirectLengthResizeTowardChildEdge(
  layout: EditorLayout,
  originNode: EditorNode,
  requestedEdge: ResizeEdge,
  requestedResizeNode: EditorNode,
  anchorBounds?: ResizeAnchorBounds,
): { node: EditorNode; movedEdge: ResizeEdge } {
  const childEdge = getChildResizeEdgeForLengthChange(layout, originNode, requestedEdge)
  if (!childEdge) {
    return {
      node: clampNodeResizeByInternalRelationAnchors(
        layout,
        originNode,
        requestedResizeNode,
        requestedEdge,
        anchorBounds,
      ),
      movedEdge: requestedEdge,
    }
  }

  if (childEdge === requestedEdge) {
    return {
      node: clampNodeResizeByInternalRelationAnchors(
        layout,
        originNode,
        requestedResizeNode,
        childEdge,
        anchorBounds,
      ),
      movedEdge: childEdge,
    }
  }

  const axis = getResizeEdgeAxis(requestedEdge)
  const deltaLength = getNodeLengthOnAxis(requestedResizeNode, axis) - getNodeLengthOnAxis(originNode, axis)

  return {
    node: clampNodeResizeByInternalRelationAnchors(
      layout,
      originNode,
      resizeNodeFromEdgeByLengthDelta(originNode, childEdge, deltaLength),
      childEdge,
      anchorBounds,
    ),
    movedEdge: childEdge,
  }
}

/** 명시적 길이 입력에서 기본으로 사용할 resize edge를 고른다. */
function getDefaultLengthResizeEdge(node: EditorNode): ResizeEdge | null {
  if (node.type === 'manhole') {
    return 'bottom'
  }

  if (node.type !== 'pipeSegment') {
    return null
  }

  return getNodeOrientation(node) === 'horizontal' ? 'right' : 'bottom'
}

/** 패널 숫자 입력으로 바뀐 길이를 child 방향 변경으로 재해석한다. */
function redirectExplicitLengthUpdateTowardChildEdge(
  layout: EditorLayout,
  currentNode: EditorNode,
  nextNode: EditorNode,
): EditorNode {
  const defaultEdge = getDefaultLengthResizeEdge(currentNode)
  if (!defaultEdge) {
    return nextNode
  }

  const childEdge = getChildResizeEdgeForLengthChange(layout, currentNode, defaultEdge)
  if (!childEdge) {
    return nextNode
  }

  const axis = getResizeEdgeAxis(defaultEdge)
  const deltaLength = getNodeLengthOnAxis(nextNode, axis) - getNodeLengthOnAxis(currentNode, axis)
  if (Math.abs(deltaLength) < 0.5) {
    return nextNode
  }

  const resizedNode = clampNodeResizeByInternalRelationAnchors(
    layout,
    currentNode,
    resizeNodeFromEdgeByLengthDelta(currentNode, childEdge, deltaLength),
    childEdge,
  )
  return normalizeNodePorts({
    ...nextNode,
    x: resizedNode.x,
    y: resizedNode.y,
    width: resizedNode.width,
    height: resizedNode.height,
    ports: resizedNode.ports,
  })
}

/** 수동 resize가 어떤 축의 길이 변경인지 판정한다. */
function getNodeLengthChangeAxisForResize(
  currentNode: EditorNode,
  nextNode: EditorNode,
): ChangeAxis | null {
  if (currentNode.type === 'pipeSegment') {
    const isHorizontal = getNodeOrientation(currentNode) === 'horizontal'
    const lengthChanged = isHorizontal
      ? nextNode.width !== currentNode.width
      : nextNode.height !== currentNode.height

    return lengthChanged ? (isHorizontal ? 'x' : 'y') : null
  }

  if (currentNode.type === 'manhole' && nextNode.height !== currentNode.height) {
    return 'y'
  }

  return null
}

/** 노드 길이 변경을 layout에 넣고 relation 전파를 실행한다. */
function applyConnectedPortResizeToLayout(
  layout: EditorLayout,
  currentNode: EditorNode,
  nextNode: EditorNode,
): EditorLayout {
  let nextLayout: EditorLayout = {
    ...layout,
    nodes: layout.nodes.map((node) => (node.id === currentNode.id ? nextNode : node)),
  }

  nextLayout = propagateChildEndpointChanges(layout, nextLayout, [currentNode.id], {
    sourceLengthAxis: getNodeLengthChangeAxisForResize(currentNode, nextNode),
  })

  return nextLayout
}

/** 파이프 resize를 기본 규칙에 맞춰 layout에 적용한다. */
function applyPipeResizeToLayout(
  layout: EditorLayout,
  currentPipeNode: EditorNode,
  nextPipeNode: EditorNode,
): EditorLayout {
  return applyConnectedPortResizeToLayout(layout, currentPipeNode, nextPipeNode)
}

/** resize 전후 노드 차이를 기준으로 파이프 최종 resize 결과를 만든다. */
function getPipeResizeResult(
  layout: EditorLayout,
  resizeState: ResizeState,
  cursor: Point,
): { node: EditorNode; movedEdge: ResizeEdge } {
  const originNode = resizeState.originNode
  if (originNode.type !== 'pipeSegment') {
    const requestedResizeNode = resizeNodeFromEdge(originNode, resizeState.edge, cursor)
    const resizeResult = redirectLengthResizeTowardChildEdge(
      layout,
      originNode,
      resizeState.edge,
      requestedResizeNode,
      resizeState.anchorBounds,
    )

    return {
      node: resizeResult.node,
      movedEdge: resizeResult.movedEdge,
    }
  }

  const requestedResizeNode = resizeNodeFromEdge(originNode, resizeState.edge, cursor)
  const childResizeEdge = getChildResizeEdgeForLengthChange(layout, originNode, resizeState.edge)
  const childResizeResult = redirectLengthResizeTowardChildEdge(
    layout,
    originNode,
    resizeState.edge,
    requestedResizeNode,
    resizeState.anchorBounds,
  )
  if (childResizeEdge) {
    return childResizeResult
  }

  const isVertical = getNodeOrientation(originNode) === 'vertical'
  const groupNodeIds = getRelationGroupNodeIds(layout, originNode.id)
  const hasFixedYNode = layout.nodes.some((node) => groupNodeIds.includes(node.id) && isFixedYNode(node))

  if (
    ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE &&
    isVertical &&
    hasFixedYNode &&
    resizeState.edge === 'top'
  ) {
    const requestedTopDelta = cursor.y - originNode.y
    const bottomCursor = {
      ...cursor,
      y: originNode.y + originNode.height - requestedTopDelta,
    }
    const bottomResizedNode = resizeNodeFromEdge(originNode, 'bottom', bottomCursor)

    return {
      node: clampNodeResizeByInternalRelationAnchors(
        layout,
        originNode,
        bottomResizedNode,
        'bottom',
        resizeState.anchorBounds,
      ),
      movedEdge: 'bottom',
    }
  }

  return {
    node: childResizeResult.node,
    movedEdge: childResizeResult.movedEdge,
  }
}

/** 현재 resize interaction 상태와 커서 좌표로 layout을 갱신한다. */
function resizeLayoutFromState(layout: EditorLayout, resizeState: ResizeState, cursor: Point): EditorLayout {
  const currentNode = layout.nodes.find((node) => node.id === resizeState.nodeId)
  if (!currentNode) {
    return layout
  }

  if (resizeState.originNode.type !== 'pipeSegment') {
    const requestedResizeNode = resizeNodeFromEdge(resizeState.originNode, resizeState.edge, cursor)
    const childDirectedNode = redirectLengthResizeTowardChildEdge(
      layout,
      resizeState.originNode,
      resizeState.edge,
      requestedResizeNode,
      resizeState.anchorBounds,
    ).node
    const nextNode = snapNodeToGround(
      normalizeNodePorts(childDirectedNode),
      layout.groundSurfaceY,
    )

    return resizeState.originNode.type === 'manhole'
      ? applyConnectedPortResizeToLayout(layout, currentNode, nextNode)
      : {
          ...layout,
          nodes: layout.nodes.map((node) => (node.id === resizeState.nodeId ? nextNode : node)),
        }
  }

  const { node: resizedPipeNode } = getPipeResizeResult(layout, resizeState, cursor)
  const nextPipeNode = normalizeNodePorts(resizedPipeNode)
  return applyPipeResizeToLayout(layout, currentNode, nextPipeNode)
}

/** resize 시작 시 커서와 edge 사이의 오프셋을 보관한다. */
function getResizeEdgePointerOffset(node: EditorNode, edge: ResizeEdge, cursor: Point) {
  if (edge === 'right') {
    return node.x + node.width - cursor.x
  }

  if (edge === 'left') {
    return cursor.x - node.x
  }

  if (edge === 'bottom') {
    return node.y + node.height - cursor.y
  }

  return cursor.y - node.y
}

/** 저장된 edge 오프셋을 반영한 resize용 커서 좌표를 계산한다. */
function getResizeEdgeCursor(resizeState: ResizeState, cursor: Point): Point {
  if (resizeState.edge === 'right') {
    return { ...cursor, x: cursor.x + resizeState.edgePointerOffset }
  }

  if (resizeState.edge === 'left') {
    return { ...cursor, x: cursor.x - resizeState.edgePointerOffset }
  }

  if (resizeState.edge === 'bottom') {
    return { ...cursor, y: cursor.y + resizeState.edgePointerOffset }
  }

  return { ...cursor, y: cursor.y - resizeState.edgePointerOffset }
}


// ---------------------------------------------------------------------------
// 회전, resize 가능 edge, z-index helper
// ---------------------------------------------------------------------------
/** 파이프 세그먼트를 오른쪽 90도로 회전한다. */
function rotatePipeSegmentClockwise(node: EditorNode): EditorNode {
  if (node.type !== 'pipeSegment') {
    return node
  }

  const center = getNodeCenter(node)
  const nextWidth = node.height
  const nextHeight = node.width
  const nextRotation = (getPipeSegmentRotation(node) + 90) % 360

  return {
    ...node,
    x: center.x - nextWidth / 2,
    y: center.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
    props: {
      ...node.props,
      rotation: nextRotation,
    },
  }
}

/** 일반 커넥터를 오른쪽 90도로 회전한다. */
function rotateConnectorClockwise(node: EditorNode): EditorNode {
  if (node.type !== 'connector') {
    return node
  }

  const center = getNodeCenter(node)
  const nextWidth = node.height
  const nextHeight = node.width

  return {
    ...node,
    x: center.x - nextWidth / 2,
    y: center.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  }
}

/** ㄱ자 커넥터를 회전하고 relation endpoint 포트 ID remap 정보를 만든다. */
function rotateElbowConnectorClockwise(node: EditorNode): { node: EditorNode; portMap: Record<string, string> } {
  if (node.type !== 'elbowConnector') {
    return { node, portMap: {} }
  }

  const currentRotation = getElbowConnectorRotation(node)
  const nextRotation = (currentRotation + 90) % 360
  const portMap = Object.fromEntries(
    node.ports.map((port) => [port.id, rotateSideClockwise(port.side)]),
  )

  return {
    node: {
      ...node,
      ports: getElbowConnectorPorts(nextRotation),
      props: {
        ...node.props,
        rotation: nextRotation,
      },
    },
    portMap,
  }
}

/** T자 커넥터를 회전하고 relation endpoint 포트 ID remap 정보를 만든다. */
function rotateTeeConnectorClockwise(node: EditorNode): { node: EditorNode; portMap: Record<string, string> } {
  if (node.type !== 'teeConnector') {
    return { node, portMap: {} }
  }

  const currentRotation = getTeeConnectorRotation(node)
  const nextRotation = (currentRotation + 90) % 360
  const portMap = Object.fromEntries(
    node.ports.map((port) => [port.id, port.side === 'center' ? 'center' : rotateSideClockwise(port.side)]),
  )

  return {
    node: {
      ...node,
      ports: getTeeConnectorPorts(nextRotation),
      props: {
        ...node.props,
        rotation: nextRotation,
      },
    },
    portMap,
  }
}

/** attach 규칙이 사용할 수 있는 resize edge 목록을 반환한다. */
function getAttachResizableEdges(node: EditorNode): Record<ResizeEdge, boolean> {
  if (node.type === 'manhole') {
    return { top: false, right: false, bottom: true, left: false }
  }

  if (node.type === 'pipeSegment') {
    return getNodeOrientation(node) === 'horizontal'
      ? { top: false, right: true, bottom: false, left: true }
      : { top: true, right: false, bottom: true, left: false }
  }

  return { top: false, right: false, bottom: false, left: false }
}

/** 사용자가 마우스로 직접 조작할 수 있는 resize edge 목록을 반환한다. */
function getManualResizableEdges(node: EditorNode): Record<ResizeEdge, boolean> {
  if (node.type === 'manhole') {
    return { top: false, right: false, bottom: false, left: false }
  }

  if (node.type === 'road') {
    return { top: false, right: true, bottom: false, left: true }
  }

  if (node.type === 'terrain') {
    return { top: false, right: true, bottom: true, left: true }
  }

  return getAttachResizableEdges(node)
}

/** 노드에 수동 resize 가능한 edge가 하나라도 있는지 확인한다. */
function hasManualResizableEdge(node: EditorNode) {
  const edges = getManualResizableEdges(node)
  return edges.top || edges.right || edges.bottom || edges.left
}

/** 노드 타입별 기본 렌더링 레이어 우선순위를 반환한다. */
function getNodeLayerPriority(node: EditorNode) {
  if (node.type === 'terrain') {
    return -30
  }

  if (node.type === 'road') {
    return -20
  }

  return 0
}

type NodeZOrderAction = 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'

/** 사용자가 지정한 z-order 값을 읽는다. */
function getNodeUserZOrder(node: EditorNode) {
  const zOrder = Number(node.props.zOrder ?? 0)
  return Number.isFinite(zOrder) ? zOrder : 0
}

/** 앞/뒤로 보내기 액션에 사용할 다음 z-order 값을 계산한다. */
function getNextNodeZOrder(nodes: EditorNode[], action: NodeZOrderAction) {
  const zOrders = nodes.map(getNodeUserZOrder)
  const minZOrder = Math.min(0, ...zOrders)
  const maxZOrder = Math.max(0, ...zOrders)

  if (action === 'bringToFront' || action === 'bringForward') {
    return maxZOrder + 1
  }

  return minZOrder - 1
}

/** 선택 노드들의 사용자 z-order를 변경한다. */
function reorderNodesByZOrder(nodes: EditorNode[], nodeIds: string[], action: NodeZOrderAction) {
  const targetIds = new Set(nodeIds)
  if (targetIds.size === 0) {
    return nodes
  }

  const nextZOrder = getNextNodeZOrder(nodes, action)
  const withUpdatedZOrder = nodes.map((node) => (
    targetIds.has(node.id)
      ? {
          ...node,
          props: {
            ...node.props,
            zOrder: nextZOrder,
          },
        }
      : node
  ))

  const nextNodes = [...nodes]

  if (action === 'bringToFront') {
    return [
      ...withUpdatedZOrder.filter((node) => !targetIds.has(node.id)),
      ...withUpdatedZOrder.filter((node) => targetIds.has(node.id)),
    ]
  }

  if (action === 'sendToBack') {
    return [
      ...withUpdatedZOrder.filter((node) => targetIds.has(node.id)),
      ...withUpdatedZOrder.filter((node) => !targetIds.has(node.id)),
    ]
  }

  nextNodes.splice(0, nextNodes.length, ...withUpdatedZOrder)

  if (action === 'bringForward') {
    for (let index = nextNodes.length - 2; index >= 0; index -= 1) {
      if (targetIds.has(nextNodes[index].id) && !targetIds.has(nextNodes[index + 1].id)) {
        const currentNode = nextNodes[index]
        nextNodes[index] = nextNodes[index + 1]
        nextNodes[index + 1] = currentNode
      }
    }
    return nextNodes
  }

  for (let index = 1; index < nextNodes.length; index += 1) {
    if (targetIds.has(nextNodes[index].id) && !targetIds.has(nextNodes[index - 1].id)) {
      const currentNode = nextNodes[index]
      nextNodes[index] = nextNodes[index - 1]
      nextNodes[index - 1] = currentNode
    }
  }

  return nextNodes
}


// ---------------------------------------------------------------------------
// 레이아웃 삽입과 attach-anchor guard helper
// ---------------------------------------------------------------------------
/** 레이아웃 + 핸들 위치에서 새 지형이 붙을 기준 좌표를 계산한다. */
function getLayoutAddPoint(source: ContextMenuState['layoutAdd']): Point {
  if (!source) {
    return { x: 0, y: 0 }
  }

  if (source.side === 'left') {
    return {
      x: source.bounds.left,
      y: (source.bounds.top + source.bounds.bottom) / 2,
    }
  }

  if (source.side === 'right') {
    return {
      x: source.bounds.right,
      y: (source.bounds.top + source.bounds.bottom) / 2,
    }
  }

  return {
    x: (source.bounds.left + source.bounds.right) / 2,
    y: source.bounds.bottom,
  }
}

/** 포트 면을 그에 대응하는 resize edge로 바꾼다. */
function getAttachResizeEdgeForPort(port: EditorPort): ResizeEdge | null {
  return port.side === 'top' ||
    port.side === 'right' ||
    port.side === 'bottom' ||
    port.side === 'left'
    ? port.side
    : null
}

/** 노드 edge가 지정 좌표에 오도록 크기와 위치를 조정한다. */
function resizeNodeEdgeToCoordinate(node: EditorNode, edge: ResizeEdge, coordinate: number): EditorNode {
  const minLength = (() => {
    if (node.type === 'manhole') {
      return MIN_MANHOLE_HEIGHT
    }

    if (node.type === 'road') {
      return MIN_ROAD_WIDTH
    }

    if (node.type === 'terrain') {
      return edge === 'top' || edge === 'bottom' ? MIN_TERRAIN_HEIGHT : MIN_TERRAIN_WIDTH
    }

    return MIN_PIPE_SEGMENT_LENGTH
  })()

  if (edge === 'top') {
    const bottom = node.y + node.height
    const height = Math.max(minLength, bottom - coordinate)

    return normalizeNodePorts({
      ...node,
      y: bottom - height,
      height,
    })
  }

  if (edge === 'bottom') {
    return normalizeNodePorts({
      ...node,
      height: Math.max(minLength, coordinate - node.y),
    })
  }

  if (edge === 'left') {
    const right = node.x + node.width
    const width = Math.max(minLength, right - coordinate)

    return normalizeNodePorts({
      ...node,
      x: right - width,
      width,
    })
  }

  return normalizeNodePorts({
    ...node,
    width: Math.max(minLength, coordinate - node.x),
  })
}

/** 노드 특정 edge의 현재 좌표를 반환한다. */
function getNodeEdgeCoordinate(node: EditorNode, edge: ResizeEdge) {
  if (edge === 'left') {
    return node.x
  }

  if (edge === 'right') {
    return node.x + node.width
  }

  if (edge === 'top') {
    return node.y
  }

  return node.y + node.height
}

/** 좌표가 노드 특정 resize edge 위에 있는지 확인한다. */
function isPointOnResizeEdge(point: Point, node: EditorNode, edge: ResizeEdge) {
  const edgeCoordinate = getNodeEdgeCoordinate(node, edge)
  const pointCoordinate = edge === 'left' || edge === 'right' ? point.x : point.y

  return Math.abs(pointCoordinate - edgeCoordinate) <= ATTACH_ANCHOR_EDGE_EPSILON
}

/** 상대 객체 크기를 고려해 attach edge 주변에 필요한 여유를 계산한다. */
function getCounterpartResizeClearance(
  node: EditorNode,
  port: EditorPort,
  counterpartNode: EditorNode | null,
  counterpartPort: EditorPort | null,
  edge: ResizeEdge,
) {
  if (!counterpartNode || !counterpartPort) {
    return 0
  }

  const counterpartPoint = getAttachedPortPoint(counterpartNode, counterpartPort, node, port)
  const axis = getResizeEdgeAxis(edge)
  if (axis === 'x') {
    if (counterpartPort.side !== 'top' && counterpartPort.side !== 'bottom' && counterpartPort.side !== 'center') {
      return 0
    }

    return edge === 'right'
      ? Math.max(0, counterpartNode.x + counterpartNode.width - counterpartPoint.x)
      : Math.max(0, counterpartPoint.x - counterpartNode.x)
  }

  if (counterpartPort.side !== 'left' && counterpartPort.side !== 'right' && counterpartPort.side !== 'center') {
    return 0
  }

  return edge === 'bottom'
    ? Math.max(0, counterpartNode.y + counterpartNode.height - counterpartPoint.y)
    : Math.max(0, counterpartPoint.y - counterpartNode.y)
}

/** 노드 내부 relation anchor 중 resize guard 후보를 수집한다. */
function getInternalRelationAnchorPointsForResize(
  layout: EditorLayout,
  node: EditorNode,
  edge: ResizeEdge,
  ignoredRelationIds?: Set<string>,
) {
  const points: ResizeAnchorPoint[] = []

  layout.links.forEach((link) => {
    if (link.type !== 'relation' || ignoredRelationIds?.has(link.id)) {
      return
    }

    const endpoint = getEndpointForNode(link, node.id)
    const counterpartEndpoint = getOtherRelationEndpoint(link, node.id)
    if (!endpoint || !counterpartEndpoint) {
      return
    }

    const port = getNodePort(node, endpoint.portId)
    const point = getEndpointPointWithCounterpart(layout, endpoint, counterpartEndpoint)
    if (!port || !point || isPointOnResizeEdge(point, node, edge)) {
      return
    }

    const counterpartNode = layout.nodes.find((candidate) => candidate.id === counterpartEndpoint.nodeId)
    const counterpartPort = counterpartNode ? getNodePort(counterpartNode, counterpartEndpoint.portId) : null

    points.push({
      point,
      clearance: getCounterpartResizeClearance(node, port, counterpartNode ?? null, counterpartPort, edge),
    })
  })

  return points
}

/** 특정 edge가 넘어가면 안 되는 anchor 경계를 계산한다. */
function getResizeAnchorBoundForEdge(
  layout: EditorLayout,
  node: EditorNode,
  edge: ResizeEdge,
  ignoredRelationIds?: Set<string>,
) {
  if (!shouldUseAttachAnchorResizeGuard(layout, node)) {
    return undefined
  }

  const anchors = getInternalRelationAnchorPointsForResize(layout, node, edge, ignoredRelationIds)
  if (anchors.length === 0) {
    return undefined
  }

  if (edge === 'right') {
    return Math.max(...anchors.map((anchor) => (
      anchor.point.x + anchor.clearance + ATTACH_ANCHOR_RESIZE_MARGIN
    )))
  }

  if (edge === 'left') {
    return Math.min(...anchors.map((anchor) => (
      anchor.point.x - anchor.clearance - ATTACH_ANCHOR_RESIZE_MARGIN
    )))
  }

  if (edge === 'bottom') {
    return Math.max(...anchors.map((anchor) => (
      anchor.point.y + anchor.clearance + ATTACH_ANCHOR_RESIZE_MARGIN
    )))
  }

  return Math.min(...anchors.map((anchor) => (
    anchor.point.y - anchor.clearance - ATTACH_ANCHOR_RESIZE_MARGIN
  )))
}

/** 현재 노드에 attach-anchor resize 보호 규칙을 적용할지 판정한다. */
function shouldUseAttachAnchorResizeGuard(layout: EditorLayout, node: EditorNode) {
  if (!ENABLE_ATTACH_ANCHOR_RESIZE_GUARD) {
    return false
  }

  const ancestorNodeIds = getRelationAncestorNodeIds(layout, node.id).filter((nodeId) => nodeId !== node.id)
  let hasFixedBranchRoot = false
  let hasManholeAncestor = node.type === 'manhole'

  for (const ancestorNodeId of ancestorNodeIds) {
    const ancestorNode = layout.nodes.find((candidate) => candidate.id === ancestorNodeId)
    if (!ancestorNode) {
      continue
    }

    if (ancestorNode.type === 'manhole') {
      hasManholeAncestor = true
    }

    if (ATTACH_ANCHOR_GUARD_FIXED_BRANCH_TYPES.has(ancestorNode.type)) {
      hasFixedBranchRoot = true
    }
  }

  return hasFixedBranchRoot && !hasManholeAncestor
}

/** resize 시작 시 노드의 anchor guard 경계를 계산해 저장한다. */
function getResizeAnchorBoundsForNode(
  layout: EditorLayout,
  node: EditorNode,
  ignoredRelationIds?: Set<string>,
): ResizeAnchorBounds {
  return {
    top: getResizeAnchorBoundForEdge(layout, node, 'top', ignoredRelationIds),
    right: getResizeAnchorBoundForEdge(layout, node, 'right', ignoredRelationIds),
    bottom: getResizeAnchorBoundForEdge(layout, node, 'bottom', ignoredRelationIds),
    left: getResizeAnchorBoundForEdge(layout, node, 'left', ignoredRelationIds),
  }
}

/** 저장된 anchor 경계를 기준으로 resize 결과를 clamp한다. */
function clampNodeResizeByAnchorBound(
  resizedNode: EditorNode,
  edge: ResizeEdge,
  bound: number | undefined,
) {
  if (bound === undefined) {
    return resizedNode
  }

  if (edge === 'right') {
    const resizedRight = resizedNode.x + resizedNode.width

    return resizedRight < bound
      ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
      : resizedNode
  }

  if (edge === 'left') {
    return resizedNode.x > bound
      ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
      : resizedNode
  }

  if (edge === 'bottom') {
    const resizedBottom = resizedNode.y + resizedNode.height

    return resizedBottom < bound
      ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
      : resizedNode
  }

  return resizedNode.y > bound
    ? resizeNodeEdgeToCoordinate(resizedNode, edge, bound)
    : resizedNode
}

/** 노드 내부 relation anchor를 기준으로 resize 결과를 추가 clamp한다. */
function clampNodeResizeByInternalRelationAnchors(
  layout: EditorLayout,
  originNode: EditorNode,
  resizedNode: EditorNode,
  edge: ResizeEdge,
  anchorBounds?: ResizeAnchorBounds,
): EditorNode {
  const bound = anchorBounds?.[edge] ?? getResizeAnchorBoundForEdge(layout, originNode, edge)

  return clampNodeResizeByAnchorBound(resizedNode, edge, bound)
}


// ---------------------------------------------------------------------------
// attach 실행 규칙
// ---------------------------------------------------------------------------
/** parent는 유지하고 child/child-group을 attach 목표 위치로 맞춘다. */
function snapChildToParentByAttachRule(
  layout: EditorLayout,
  parentEndpoint: EditorPortSelection,
  childEndpoint: EditorPortSelection,
  parentNode: EditorNode,
  childNode: EditorNode,
  parentPort: EditorPort,
  childPort: EditorPort,
) {
  const anchorPoint = getAttachedPortPoint(parentNode, parentPort, childNode, childPort)
  const movingPoint = getAttachedPortPoint(childNode, childPort, parentNode, parentPort)
  const dx = anchorPoint.x - movingPoint.x
  const dy = anchorPoint.y - movingPoint.y
  const adjustedLayout = applyRelationEndpointDelta(
    layout,
    childEndpoint,
    parentEndpoint,
    dx,
    dy,
  )
  const parentGroupNodeIds = new Set(getRelationGroupNodeIds(layout, parentEndpoint.nodeId))

  return propagateAttachEndpointChanges(
    layout,
    adjustedLayout,
    [childEndpoint.nodeId],
    parentGroupNodeIds,
  )
}

/** 두 포트 선택으로 attach할 때 snapping과 전파를 한 번에 적용한다. */
function snapRelationEndpoints(
  layout: EditorLayout,
  parentEndpoint: EditorPortSelection,
  childEndpoint: EditorPortSelection,
): EditorLayout {
  if (
    parentEndpoint.nodeId === childEndpoint.nodeId ||
    wouldCreateRelationCycle(layout, parentEndpoint.nodeId, childEndpoint.nodeId)
  ) {
    return layout
  }

  const parentNode = layout.nodes.find((node) => node.id === parentEndpoint.nodeId)
  const childNode = layout.nodes.find((node) => node.id === childEndpoint.nodeId)
  const parentPort = parentNode ? getNodePort(parentNode, parentEndpoint.portId) : null
  const childPort = childNode ? getNodePort(childNode, childEndpoint.portId) : null
  if (!parentNode || !childNode || !parentPort || !childPort) {
    return layout
  }

  return snapChildToParentByAttachRule(
    layout,
    parentEndpoint,
    childEndpoint,
    parentNode,
    childNode,
    parentPort,
    childPort,
  )
}


// ---------------------------------------------------------------------------
// localStorage, undo/redo, 파일 다운로드 helper
// ---------------------------------------------------------------------------
/** 함수형/값형 layout 업데이트를 현재 layout 기준으로 해석한다. */
function resolveLayoutUpdate(currentLayout: EditorLayout, update: LayoutUpdate) {
  return typeof update === 'function' ? update(currentLayout) : update
}

/** history 기록 전 layout JSON이 동일한지 비교한다. */
function areLayoutsEqual(first: EditorLayout, second: EditorLayout) {
  return JSON.stringify(first) === JSON.stringify(second)
}

/** undo history 길이를 제한하면서 새 snapshot을 추가한다. */
function pushLimitedHistory(history: EditorLayout[], layout: EditorLayout) {
  return [...history, layout].slice(-LAYOUT_HISTORY_LIMIT)
}

/** localStorage 또는 기본 layout으로 history 초기 상태를 만든다. */
function createInitialLayoutHistoryState(): LayoutHistoryState {
  return {
    present: normalizeEditorLayout(loadEditorLayout() ?? createDefaultEditorLayout()),
    past: [],
    future: [],
    batchStart: null,
  }
}

/** layout apply, batch, undo, redo를 처리하는 reducer다. */
function layoutHistoryReducer(state: LayoutHistoryState, action: LayoutHistoryAction): LayoutHistoryState {
  if (action.type === 'apply') {
    const nextLayout = normalizeRelationAttachments(resolveLayoutUpdate(state.present, action.update))
    if (areLayoutsEqual(state.present, nextLayout)) {
      return state
    }

    return {
      present: nextLayout,
      past: action.recordHistory ? pushLimitedHistory(state.past, state.present) : state.past,
      future: action.recordHistory ? [] : state.future,
      batchStart: action.recordHistory ? null : state.batchStart,
    }
  }

  if (action.type === 'beginBatch') {
    return state.batchStart ? state : { ...state, batchStart: state.present }
  }

  if (action.type === 'commitBatch') {
    if (!state.batchStart || areLayoutsEqual(state.batchStart, state.present)) {
      return { ...state, batchStart: null }
    }

    return {
      ...state,
      past: pushLimitedHistory(state.past, state.batchStart),
      future: [],
      batchStart: null,
    }
  }

  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (!previous) {
      return { ...state, batchStart: null }
    }

    return {
      present: normalizeRelationAttachments(previous),
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future].slice(0, LAYOUT_HISTORY_LIMIT),
      batchStart: null,
    }
  }

  if (action.type === 'redo') {
    const next = state.future[0]
    if (!next) {
      return { ...state, batchStart: null }
    }

    return {
      present: normalizeRelationAttachments(next),
      past: pushLimitedHistory(state.past, state.present),
      future: state.future.slice(1),
      batchStart: null,
    }
  }

  return state
}

/** 키보드 단축키가 입력 필드 편집을 방해하지 않도록 대상 요소를 판정한다. */
function isTextEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** 현재 editor layout을 JSON 파일로 내려받는다. */
function downloadLayout(layout: EditorLayout) {
  const exportLayout = normalizeRelationAttachments(layout)
  const blob = new Blob([JSON.stringify(exportLayout, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'drainage-layout.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

/** 서버 응답 header에서 다운로드 파일명을 추출한다. */
function getDownloadFilename(response: Response, fallback: string) {
  const disposition = response.headers.get('Content-Disposition')
  const filenameMatch = disposition?.match(/filename="([^"]+)"/)

  return filenameMatch?.[1] ?? fallback
}

/** 텍스트 Blob을 만들어 브라우저 다운로드를 실행한다. */
function downloadTextFile(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** 서버 warning header를 사용자에게 보여줄 문자열 목록으로 파싱한다. */
function parseWarningHeader(value: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(value)
    return Array.isArray(parsedValue) ? parsedValue.map(String) : []
  } catch {
    return [value]
  }
}

interface SwmmConversionReport {
  ok: boolean
  counts: Record<string, number>
  warnings: string[]
  errors: string[]
  dynamicControls?: {
    rainfallTargets?: string[]
    dryWeatherTargets?: string[]
    blockageTargets?: Array<{
      swmmLinkId: string
      sourceEditorId?: string
      sourceEditorName?: string
      pipeKind?: string
    }>
  }
}

interface SwmmConversionResponse {
  ok: boolean
  inpText: string
  report: SwmmConversionReport
  mapping: Record<string, unknown>
}

async function requestSwmmConversionValidation(layout: EditorLayout): Promise<SwmmConversionResponse> {
  const exportLayout = normalizeRelationAttachments(layout)
  const response = await fetch(`${SWMM_ENGINE_URL}/editor/convert/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      layout: exportLayout,
      title: 'SWMM model generated from React editor layout',
    }),
  })

  const payload = await response.json().catch(() => null) as SwmmConversionResponse | { message?: string } | null
  if (!response.ok || !payload || !('report' in payload)) {
    const message = payload && 'message' in payload ? payload.message : undefined
    throw new Error(message ?? `SWMM 변환 검증 요청이 실패했습니다. (${response.status})`)
  }

  return payload
}

async function downloadSwmmConversionZip(layout: EditorLayout) {
  const exportLayout = normalizeRelationAttachments(layout)
  const response = await fetch(`${SWMM_ENGINE_URL}/editor/convert/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      layout: exportLayout,
      filename: 'swmm-editor-export.zip',
      title: 'SWMM model generated from React editor layout',
    }),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string; report?: SwmmConversionReport } | null
    const errors = errorPayload?.report?.errors ?? []
    throw new Error(errors.length > 0 ? errors.join('\n') : errorPayload?.message ?? `SWMM ZIP 내보내기 요청이 실패했습니다. (${response.status})`)
  }

  const blob = await response.blob()
  const filename = getDownloadFilename(response, 'swmm-editor-export.zip')
  downloadBlobFile(blob, filename)
}

async function downloadSwmmInp(layout: EditorLayout) {
  const exportLayout = normalizeRelationAttachments(layout)
  const response = await fetch(`${SWMM_ENGINE_URL}/editor/export-inp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      layout: exportLayout,
      filename: 'generated_from_editor.inp',
      title: 'SWMM model generated from React editor layout',
    }),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(errorPayload?.message ?? `SWMM INP 변환 요청이 실패했습니다. (${response.status})`)
  }

  const text = await response.text()
  const filename = getDownloadFilename(response, 'generated_from_editor.inp')
  downloadTextFile(text, filename)

  return parseWarningHeader(response.headers.get('X-Editor-Inp-Warnings'))
}


// ---------------------------------------------------------------------------
// EditorCanvas에서 쓰는 layout 상태 hook
// ---------------------------------------------------------------------------
/** layout 저장, history, undo/redo API를 하나의 hook으로 묶는다. */
function useEditorLayoutState() {
  const [historyState, dispatchLayoutHistory] = useReducer(
    layoutHistoryReducer,
    undefined,
    createInitialLayoutHistoryState,
  )
  const layout = historyState.present

  useEffect(() => {
    saveEditorLayout(layout)
  }, [layout])

  const setLayout = useCallback((update: LayoutUpdate, options: LayoutSetOptions = {}) => {
    dispatchLayoutHistory({
      type: 'apply',
      update,
      recordHistory: options.recordHistory !== false,
    })
  }, [])

  const beginLayoutHistoryBatch = useCallback(() => {
    dispatchLayoutHistory({ type: 'beginBatch' })
  }, [])

  const commitLayoutHistoryBatch = useCallback(() => {
    dispatchLayoutHistory({ type: 'commitBatch' })
  }, [])

  const undoLayout = useCallback(() => {
    dispatchLayoutHistory({ type: 'undo' })
  }, [])

  const redoLayout = useCallback(() => {
    dispatchLayoutHistory({ type: 'redo' })
  }, [])

  return [
    layout,
    setLayout,
    {
      beginLayoutHistoryBatch,
      commitLayoutHistoryBatch,
      undoLayout,
      redoLayout,
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
    },
  ] as const
}

export function EditorCanvas({ theme = 'light' }: { theme?: WorkbenchTheme }) {
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  // layout hook은 localStorage 저장, undo/redo history, batch 기록을 한곳에서 관리한다.
  const [layout, setLayout, layoutHistory] = useEditorLayoutState()
  const {
    beginLayoutHistoryBatch,
    commitLayoutHistoryBatch,
    undoLayout,
    redoLayout,
    canUndo,
    canRedo,
  } = layoutHistory

  // 선택/attach/좌표 변경/drag/resize는 동시에 겹치면 안 되는 사용자 인터랙션 상태다.
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [pendingPort, setPendingPort] = useState<EditorPortSelection | null>(null)
  const [attachTargetNodeId, setAttachTargetNodeId] = useState<string | null>(null)
  const [coordinateEditState, setCoordinateEditState] = useState<CoordinateEditState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [marqueeSelectionState, setMarqueeSelectionState] = useState<MarqueeSelectionState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isExportingInp, setIsExportingInp] = useState(false)
  const [isValidatingSwmm, setIsValidatingSwmm] = useState(false)
  const [isExportingSwmmZip, setIsExportingSwmmZip] = useState(false)
  const [isEditorInfoPanelOpen, setIsEditorInfoPanelOpen] = useState(false)
  const [editorZoom, setEditorZoom] = useState(EDITOR_ZOOM_DEFAULT)
  const [editorCanvasFitWidth, setEditorCanvasFitWidth] = useState(0)
  const [swmmConversionResult, setSwmmConversionResult] = useState<SwmmConversionResponse | null>(null)

  // ref는 브라우저 파일 입력, SVG 좌표 변환, 좌표 변경 후속 클릭 억제를 위해 사용한다.
  const copiedSelectionRef = useRef<CopiedEditorSelection | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorCanvasViewportRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const suppressCoordinateEditFollowUpClickUntilRef = useRef(0)
  const nextNodeIndex = layout.nodes.length + 1

  useEffect(() => {
    const element = editorCanvasViewportRef.current
    if (!element) {
      return undefined
    }

    const updateFitWidth = () => {
      setEditorCanvasFitWidth(Math.max(320, Math.floor(element.clientWidth - 48)))
    }

    updateFitWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFitWidth)
      return () => window.removeEventListener('resize', updateFitWidth)
    }

    const observer = new ResizeObserver(updateFitWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // 좌표 변경 완료 직후 port click이 한 번 더 들어오는 브라우저 이벤트 중복을 막는다.
  const suppressCoordinateEditFollowUpClick = useCallback(() => {
    suppressCoordinateEditFollowUpClickUntilRef.current = window.performance.now() + 500
  }, [])

  // 선택 상태에서 오른쪽 패널과 캔버스 렌더링이 공통으로 참조하는 파생 데이터를 계산한다.
  const selectedNode = useMemo(() => {
    if (selection?.kind !== 'node') {
      return null
    }

    return layout.nodes.find((node) => node.id === selection.id) ?? null
  }, [layout.nodes, selection])

  const selectedLink = useMemo(() => {
    if (selection?.kind !== 'link') {
      return null
    }

    return layout.links.find((link) => link.id === selection.id) ?? null
  }, [layout.links, selection])

  // multi selection도 단일 node처럼 빠르게 포함 여부를 확인하기 위해 Set으로 바꾼다.
  const selectedNodeIds = useMemo(() => {
    return new Set(getSelectionNodeIds(selection))
  }, [selection])

  // 캔버스 크기는 일반 객체에는 여백을 주고, terrain은 자기 경계까지만 확장한다.
  const canvasHeight = useMemo(() => {
    const contentBottom = layout.nodes.reduce(
      (maxBottom, node) => (
        node.type === 'terrain' ? maxBottom : Math.max(maxBottom, node.y + node.height)
      ),
      layout.groundSurfaceY,
    )
    const terrainBottom = layout.nodes.reduce(
      (maxBottom, node) => (
        node.type === 'terrain' ? Math.max(maxBottom, node.y + node.height) : maxBottom
      ),
      layout.groundSurfaceY,
    )

    return Math.max(
      EDITOR_CANVAS_HEIGHT,
      Math.ceil(contentBottom + CANVAS_BOTTOM_PADDING),
      Math.ceil(terrainBottom),
    )
  }, [layout.groundSurfaceY, layout.nodes])

  const canvasWidth = useMemo(() => {
    const contentRight = layout.nodes.reduce(
      (maxRight, node) => (
        node.type === 'terrain' ? maxRight : Math.max(maxRight, node.x + node.width)
      ),
      EDITOR_CANVAS_WIDTH,
    )
    const terrainRight = layout.nodes.reduce(
      (maxRight, node) => (
        node.type === 'terrain' ? Math.max(maxRight, node.x + node.width) : maxRight
      ),
      EDITOR_CANVAS_WIDTH,
    )

    return Math.max(
      EDITOR_CANVAS_WIDTH,
      Math.ceil(contentRight + CANVAS_RIGHT_PADDING),
      Math.ceil(terrainRight),
    )
  }, [layout.nodes])

  // 기본 땅 배경은 첫 side/bottom terrain 전까지만 남겨, 하천/바다 아래에 땅이 깔리지 않게 한다.
  const baseGroundBounds = useMemo<RectBounds>(() => {
    const firstSideTerrainX = layout.nodes.reduce((leftMostTerrainX, node) => {
      if (node.type !== 'terrain') {
        return leftMostTerrainX
      }

      const startsAtGroundSurface = Math.abs(node.y - layout.groundSurfaceY) <= 1
      if (!startsAtGroundSurface || node.x <= 0) {
        return leftMostTerrainX
      }

      return Math.min(leftMostTerrainX, node.x)
    }, canvasWidth)
    const firstBottomTerrainY = layout.nodes.reduce((topMostTerrainY, node) => {
      if (node.type !== 'terrain') {
        return topMostTerrainY
      }

      if (node.y <= layout.groundSurfaceY + 1) {
        return topMostTerrainY
      }

      return Math.min(topMostTerrainY, node.y)
    }, canvasHeight)

    return {
      left: 0,
      top: layout.groundSurfaceY,
      right: Math.max(0, firstSideTerrainX),
      bottom: Math.max(layout.groundSurfaceY, firstBottomTerrainY),
    }
  }, [canvasHeight, canvasWidth, layout.groundSurfaceY, layout.nodes])
  const baseGroundWidth = Math.max(0, baseGroundBounds.right - baseGroundBounds.left)
  const baseGroundHeight = Math.max(0, baseGroundBounds.bottom - baseGroundBounds.top)

  // 선택된 노드에 연결된 relation/link 목록은 포트 색상과 오른쪽 패널 표시에서 사용한다.
  const selectedConnectedLinks = useMemo(() => {
    if (!selectedNode) {
      return []
    }

    return layout.links.filter(
      (link) => link.from.nodeId === selectedNode.id || link.to.nodeId === selectedNode.id,
    )
  }, [layout.links, selectedNode])

  // 이미 relation이 붙은 포트는 파란색으로 표시해야 하므로 endpoint key를 모아둔다.
  const connectedPortKeys = useMemo(() => {
    const portKeys = new Set<string>()

    layout.links.forEach((link) => {
      if (link.type !== 'relation') {
        return
      }

      portKeys.add(endpointKey(link.from))
      portKeys.add(endpointKey(link.to))
    })

    return portKeys
  }, [layout.links])

  // relation 링크 선택 시 양 끝 포트에 parent/child 역할 표시를 붙인다.
  const selectedRelationPortRoles = useMemo(() => {
    const roles = new Map<string, RelationPortRole>()

    if (selectedLink?.type === 'relation') {
      roles.set(endpointKey(selectedLink.from), 'parent')
      roles.set(endpointKey(selectedLink.to), 'child')
    }

    return roles
  }, [selectedLink])

  // parent 노드를 선택했을 때 우클릭 가능한 파란 relation 포트를 구분한다.
  const selectedParentPortKeys = useMemo(() => {
    const portKeys = new Set<string>()
    if (!selectedNode) {
      return portKeys
    }

    layout.links.forEach((link) => {
      if (link.type === 'relation' && link.from.nodeId === selectedNode.id) {
        portKeys.add(endpointKey(link.from))
      }
    })

    return portKeys
  }, [layout.links, selectedNode])

  // terrain/road 같은 레이어, 사용자가 지정한 zOrder, relation depth 순서로 실제 렌더 순서를 정한다.
  const renderedNodes = useMemo(() => {
    const nodeIndex = new Map(layout.nodes.map((node, index) => [node.id, index]))
    const renderDepths = getNodeRenderDepths(layout)

    return [...layout.nodes].sort((first, second) => {
      const layerDelta = getNodeLayerPriority(first) - getNodeLayerPriority(second)
      if (layerDelta !== 0) {
        return layerDelta
      }

      const userZOrderDelta = getNodeUserZOrder(first) - getNodeUserZOrder(second)
      if (userZOrderDelta !== 0) {
        return userZOrderDelta
      }

      const depthDelta = (renderDepths.get(first.id) ?? 0) - (renderDepths.get(second.id) ?? 0)
      if (depthDelta !== 0) {
        return depthDelta
      }

      return (nodeIndex.get(first.id) ?? 0) - (nodeIndex.get(second.id) ?? 0)
    })
  }, [layout])

  // 좌표 변경 모드의 커서 모양을 x/y 축에 맞춰 바꾸기 위한 파생 상태다.
  const coordinateEditAxis = useMemo(() => {
    if (!coordinateEditState) {
      return null
    }

    const relation = layout.links.find((link) => link.id === coordinateEditState.linkId)
    if (relation?.type !== 'relation') {
      return null
    }

    return getCoordinateEditableRelationInfo(layout, relation)?.axis ?? null
  }, [coordinateEditState, layout])

  // 좌표 변경 모드에서 브라우저 pointer 위치를 SVG 좌표로 바꾸고 relation endpoint를 갱신한다.
  const updateCoordinateEditFromClientPoint = useCallback((clientX: number, clientY: number) => {
    if (!coordinateEditState || !svgRef.current) {
      return false
    }

    const cursor = getSvgCursor(svgRef.current, clientX, clientY)
    setLayout(
      (currentLayout) => updateCoordinateEditEndpoint(currentLayout, coordinateEditState.linkId, cursor),
      { recordHistory: false },
    )
    return true
  }, [coordinateEditState, setLayout])

  // 좌표 변경 모드는 마우스를 누르지 않아도 포인터를 따라가고, 클릭/마우스업으로 확정한다.
  useEffect(() => {
    if (!coordinateEditState) {
      return
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    return () => window.removeEventListener('pointermove', handleWindowPointerMove)
  }, [coordinateEditState, updateCoordinateEditFromClientPoint])

  // 오른쪽 선택 패널에서 발생하는 노드 편집 액션이다. 길이 변경은 relation 전파 규칙으로 넘긴다.
  const updateNode = (nodeId: string, updates: Partial<EditorNode>) => {
    setLayout((currentLayout) => {
      const currentNode = currentLayout.nodes.find((node) => node.id === nodeId)
      if (!currentNode) {
        return currentLayout
      }

      const nextNode = snapNodeToGround(
        normalizeNodePorts({ ...currentNode, ...updates }),
        currentLayout.groundSurfaceY,
      )

      if (currentNode.type === 'pipeSegment') {
        const isHorizontal = getNodeOrientation(currentNode) === 'horizontal'
        const axisLengthChanged = isHorizontal
          ? nextNode.width !== currentNode.width
          : nextNode.height !== currentNode.height

        if (axisLengthChanged) {
          const childDirectedNode = redirectExplicitLengthUpdateTowardChildEdge(
            currentLayout,
            currentNode,
            nextNode,
          )
          return applyPipeResizeToLayout(currentLayout, currentNode, childDirectedNode)
        }
      }

      if (currentNode.type === 'manhole' && nextNode.height !== currentNode.height) {
        const childDirectedNode = redirectExplicitLengthUpdateTowardChildEdge(
          currentLayout,
          currentNode,
          nextNode,
        )
        return applyConnectedPortResizeToLayout(currentLayout, currentNode, childDirectedNode)
      }

      return {
        ...currentLayout,
        nodes: currentLayout.nodes.map((node) => (node.id === nodeId ? nextNode : node)),
      }
    })
  }

  // 회전 버튼 액션이다. ㄱ자 커넥터는 회전 후 포트 ID도 함께 재매핑해야 한다.
  const rotateNodeClockwise = (nodeId: string) => {
    setLayout((currentLayout) => {
      let rotatedPortMap: Record<string, string> = {}

      const nodes = currentLayout.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node
        }

        if (node.type === 'elbowConnector') {
          const rotated = rotateElbowConnectorClockwise(node)
          rotatedPortMap = rotated.portMap
          return rotated.node
        }

        if (node.type === 'teeConnector') {
          const rotated = rotateTeeConnectorClockwise(node)
          rotatedPortMap = rotated.portMap
          return rotated.node
        }

        if (node.type === 'connector') {
          return rotateConnectorClockwise(node)
        }

        return rotatePipeSegmentClockwise(node)
      })

      const remapEndpoint = (endpoint: EditorEndpoint): EditorEndpoint => (
        endpoint.nodeId === nodeId && rotatedPortMap[endpoint.portId]
          ? { ...endpoint, portId: rotatedPortMap[endpoint.portId] }
          : endpoint
      )

      return {
        ...currentLayout,
        nodes,
        links: Object.keys(rotatedPortMap).length > 0
          ? currentLayout.links.map((link) => ({
              ...link,
              from: remapEndpoint(link.from),
              to: remapEndpoint(link.to),
            }))
          : currentLayout.links,
      }
    })
  }

  // link 본문 필드와 props 필드는 오른쪽 패널에서 따로 갱신한다.
  const updateLink = (linkId: string, updates: Partial<Omit<EditorLink, 'props'>>) => {
    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.map((link) => (link.id === linkId ? { ...link, ...updates } : link)),
    }))
  }

  // link props는 relation/pipe link의 확장 메타데이터를 안전하게 병합한다.
  const updateLinkProps = (linkId: string, updates: Partial<EditorLink['props']>) => {
    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.map((link) => (
        link.id === linkId
          ? {
              ...link,
              props: {
                ...link.props,
                ...updates,
              },
            }
          : link
      )),
    }))
  }

  // Backspace/Delete와 버튼 삭제가 공유하는 선택 삭제 액션이다.
  const deleteSelection = useCallback(() => {
    if (!selection) {
      return
    }

    setLayout((currentLayout) => {
      if (selection.kind === 'link') {
        return {
          ...currentLayout,
          links: currentLayout.links.filter((link) => link.id !== selection.id),
        }
      }

      if (selection.kind === 'multi') {
        const selectedIds = new Set(selection.ids)

        return {
          ...currentLayout,
          nodes: currentLayout.nodes.filter((node) => !selectedIds.has(node.id)),
          links: currentLayout.links.filter(
            (link) => !selectedIds.has(link.from.nodeId) && !selectedIds.has(link.to.nodeId),
          ),
        }
      }

      return {
        ...currentLayout,
        nodes: currentLayout.nodes.filter((node) => node.id !== selection.id),
        links: currentLayout.links.filter(
          (link) => link.from.nodeId !== selection.id && link.to.nodeId !== selection.id,
        ),
      }
    })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setMarqueeSelectionState(null)
    setSelection(null)
  }, [selection, setLayout])

  // undo/redo나 pointer 종료 전에 임시 인터랙션 상태를 닫고 history batch를 확정한다.
  const clearTransientEditorState = useCallback(() => {
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setDragState(null)
    setResizeState(null)
    setMarqueeSelectionState(null)
    commitLayoutHistoryBatch()
  }, [commitLayoutHistoryBatch])

  // undo/redo는 drag/resize/attach 같은 임시 상태를 먼저 정리한 뒤 layout history만 이동한다.
  const undoEditorLayout = useCallback(() => {
    clearTransientEditorState()
    undoLayout()
  }, [clearTransientEditorState, undoLayout])

  const redoEditorLayout = useCallback(() => {
    clearTransientEditorState()
    redoLayout()
  }, [clearTransientEditorState, redoLayout])

  // 복사/붙여넣기는 현재 선택을 relation 그룹 단위로 확장한 뒤 새 ID로 복제한다.
  const copySelection = useCallback(() => {
    const copiedSelection = createCopiedEditorSelection(layout, selection)
    if (!copiedSelection) {
      return false
    }

    copiedSelectionRef.current = copiedSelection
    return true
  }, [layout, selection])

  const pasteSelection = useCallback(() => {
    const copiedSelection = copiedSelectionRef.current
    if (!copiedSelection) {
      return false
    }

    const result = pasteCopiedEditorSelection(layout, copiedSelection)
    const pastedNodeIds = result.selectedNodeIds
    setLayout(result.layout)

    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setDragState(null)
    setResizeState(null)
    setMarqueeSelectionState(null)
    setSelection(pastedNodeIds.length === 1
      ? { kind: 'node', id: pastedNodeIds[0] }
      : { kind: 'multi', ids: pastedNodeIds })
    return true
  }, [layout, setLayout])

  // 전역 키보드 단축키는 입력 필드 편집 중에는 동작하지 않게 제한한다.
  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      if (isTextEditingTarget(event.target) || !selection) {
        return
      }

      event.preventDefault()
      deleteSelection()
    }

    window.addEventListener('keydown', handleDeleteKey)
    return () => window.removeEventListener('keydown', handleDeleteKey)
  }, [deleteSelection, selection])

  // macOS Command와 Windows/Linux Ctrl을 모두 같은 undo/redo modifier로 취급한다.
  useEffect(() => {
    const handleHistoryKey = (event: KeyboardEvent) => {
      const isPrimaryModifier = event.metaKey || event.ctrlKey
      const isUndoRedoKey = event.key.toLowerCase() === 'z'
      if (!isPrimaryModifier || !isUndoRedoKey || event.altKey || isTextEditingTarget(event.target)) {
        return
      }

      event.preventDefault()
      if (event.shiftKey) {
        redoEditorLayout()
      } else {
        undoEditorLayout()
      }
    }

    window.addEventListener('keydown', handleHistoryKey)
    return () => window.removeEventListener('keydown', handleHistoryKey)
  }, [redoEditorLayout, undoEditorLayout])

  // Cmd/Ctrl+C/V는 브라우저 기본 텍스트 복사 대신 editor selection 복사를 수행한다.
  useEffect(() => {
    const handleClipboardKey = (event: KeyboardEvent) => {
      const isPrimaryModifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (!isPrimaryModifier || event.altKey || isTextEditingTarget(event.target)) {
        return
      }

      if (key === 'c') {
        if (copySelection()) {
          event.preventDefault()
        }
        return
      }

      if (key === 'v') {
        if (pasteSelection()) {
          event.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleClipboardKey)
    return () => window.removeEventListener('keydown', handleClipboardKey)
  }, [copySelection, pasteSelection])

  // 우클릭 메뉴는 Escape로 닫을 수 있게 전역 keydown을 연결한다.
  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [contextMenu])

  // 아래 함수들은 SVG 캔버스에서 직접 발생하는 pointer/context menu 액션의 진입점이다.
  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return
    }

    const cursor = getSvgCursor(event.currentTarget, event.clientX, event.clientY)

    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
      setContextMenu(null)
      return
    }

    setSelection(null)
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setMarqueeSelectionState({
      start: cursor,
      current: cursor,
    })
  }

  const handleCanvasContextMenu = (event: ReactMouseEvent<SVGSVGElement>) => {
    event.preventDefault()
    const cursor = getSvgCursor(event.currentTarget, event.clientX, event.clientY)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point: cursor,
    })
  }

  // 우클릭 z-order는 multi selection 안의 노드를 누른 경우 선택 그룹 전체에 적용한다.
  const getZOrderTargetNodeIds = useCallback((nodeId: string) => {
    if (selection?.kind === 'multi' && selectedNodeIds.has(nodeId)) {
      return selection.ids
    }

    return [nodeId]
  }, [selectedNodeIds, selection])

  const handleNodeContextMenu = (
    node: EditorNode,
    event: ReactMouseEvent<SVGGElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const svg = event.currentTarget.ownerSVGElement
    const point = svg ? getSvgCursor(svg, event.clientX, event.clientY) : { x: node.x, y: node.y }

    if (!(selection?.kind === 'multi' && selectedNodeIds.has(node.id))) {
      setSelection({ kind: 'node', id: node.id })
    }
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point,
      nodeId: node.id,
    })
  }

  // 객체 우클릭 메뉴에서 선택 객체 또는 선택 그룹의 z-order를 바꾼다.
  const changeContextNodeZOrder = (action: NodeZOrderAction) => {
    if (!contextMenu?.nodeId) {
      return
    }

    const targetNodeIds = getZOrderTargetNodeIds(contextMenu.nodeId)
    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: reorderNodesByZOrder(currentLayout.nodes, targetNodeIds, action),
    }))
    setContextMenu(null)
  }

  // 선택된 객체의 파란 relation 포트를 우클릭했을 때 해체 메뉴를 연다.
  const handlePortContextMenu = (
    nodeId: string,
    portId: string,
    event: ReactMouseEvent<SVGElement>,
  ) => {
    const endpoint = { nodeId, portId }
    const relation = layout.links.find((link) => (
      link.type === 'relation' &&
      (endpointKey(link.from) === endpointKey(endpoint) || endpointKey(link.to) === endpointKey(endpoint)) &&
      selection?.kind === 'node' &&
      selection.id === nodeId
    ))

    if (!relation) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    const point = svg ? getSvgCursor(svg, event.clientX, event.clientY) : { x: 0, y: 0 }

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point,
      relationPort: {
        linkId: relation.id,
        endpoint,
      },
    })
  }

  // terrain edge의 + 핸들을 누르면 땅/하천/바다 추가 메뉴를 같은 context menu 시스템으로 연다.
  const openLayoutAddMenu = useCallback((
    source: ContextMenuState['layoutAdd'],
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    if (!source) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      point: getLayoutAddPoint(source),
      layoutAdd: source,
    })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setDragState(null)
    setResizeState(null)
    setMarqueeSelectionState(null)
  }, [])

  // 기본 땅 배경의 좌/우/하단 edge에서 새 terrain을 이어 붙이는 진입점이다.
  const handleBaseLayoutAddPointerDown = useCallback((
    side: LayoutAddSide,
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    openLayoutAddMenu({
      side,
      bounds: baseGroundBounds,
    }, event)
  }, [baseGroundBounds, openLayoutAddMenu])

  // 이미 추가된 terrain 노드의 좌/우/하단 edge에서 새 terrain을 체인으로 이어 붙인다.
  const handleNodeLayoutAddPointerDown = useCallback((
    node: EditorNode,
    side: LayoutAddSide,
    event: ReactPointerEvent<SVGGElement>,
  ) => {
    openLayoutAddMenu({
      side,
      bounds: {
        left: node.x,
        top: node.y,
        right: node.x + node.width,
        bottom: node.y + node.height,
      },
      sourceNodeId: node.id,
    }, event)
  }, [openLayoutAddMenu])

  // relation 포트 우클릭 메뉴에서 해체를 실행한다.
  const detachContextRelation = () => {
    const relationPort = contextMenu?.relationPort
    if (!relationPort) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.filter((link) => link.id !== relationPort.linkId),
    }))
    setContextMenu(null)
    setCoordinateEditState(null)
  }

  // T자 객체 우클릭 메뉴에서 trunk 축 좌표 변경 모드로 진입한다.
  const startContextTeeCoordinateEdit = () => {
    const nodeId = contextMenu?.nodeId
    if (!nodeId) {
      return
    }

    const coordinateInfo = getCoordinateEditableTeeRelationInfo(layout, nodeId)
    if (!coordinateInfo) {
      setContextMenu(null)
      return
    }

    beginLayoutHistoryBatch()
    setSelection({ kind: 'node', id: coordinateInfo.parentNode.id })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState({ linkId: coordinateInfo.relation.id })
    setContextMenu(null)
  }

  // pointer up/leave에서 좌표 변경, marquee, drag, resize batch를 확정한다.
  const finishPointerInteraction = useCallback(() => {
    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      setCoordinateEditState(null)
      commitLayoutHistoryBatch()
      return
    }

    if (marqueeSelectionState) {
      const marqueeRect = normalizeRect(marqueeSelectionState.start, marqueeSelectionState.current)
      const isIntentionalMarquee = marqueeRect.right - marqueeRect.left > 4 || marqueeRect.bottom - marqueeRect.top > 4
      const selectedIds = isIntentionalMarquee
        ? getExpandedRelationGroupNodeIds(layout, getMarqueeSelectedNodeIds(layout, marqueeRect))
        : []

      setSelection(selectedIds.length === 0
        ? null
        : selectedIds.length === 1
          ? { kind: 'node', id: selectedIds[0] }
          : { kind: 'multi', ids: selectedIds })
      setMarqueeSelectionState(null)
      setDragState(null)
      setResizeState(null)
      commitLayoutHistoryBatch()
      return
    }

    setCoordinateEditState(null)
    setDragState(null)
    setResizeState(null)
    setMarqueeSelectionState(null)
    commitLayoutHistoryBatch()
  }, [
    commitLayoutHistoryBatch,
    coordinateEditState,
    layout,
    marqueeSelectionState,
    suppressCoordinateEditFollowUpClick,
  ])

  const handleCanvasPointerLeave = useCallback(() => {
    if (coordinateEditState) {
      return
    }

    finishPointerInteraction()
  }, [coordinateEditState, finishPointerInteraction])

  // pointer move는 현재 모드에 따라 좌표 변경, 영역 선택, resize, drag 중 하나만 수행한다.
  const handleCanvasPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const cursor = getSvgCursor(event.currentTarget, event.clientX, event.clientY)

    if (coordinateEditState) {
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
      return
    }

    if (marqueeSelectionState) {
      setMarqueeSelectionState({
        ...marqueeSelectionState,
        current: cursor,
      })
      return
    }

    if (resizeState) {
      const resizeCursor = getResizeEdgeCursor(resizeState, cursor)

      setLayout(
        (currentLayout) => resizeLayoutFromState(currentLayout, resizeState, resizeCursor),
        { recordHistory: false },
      )
      return
    }

    if (!dragState) {
      return
    }

    setLayout(
      (currentLayout) => (
        moveDragGroupTo(currentLayout, dragState, cursor.x - dragState.offsetX, cursor.y - dragState.offsetY)
      ),
      { recordHistory: false },
    )
  }

  // attach 모드의 두 번째 선택을 검증하고, snap 후 relation 링크 생성까지 마무리한다.
  const completePendingAttach = (nextPort: EditorPortSelection) => {
    if (!pendingPort) {
      return false
    }

    if (
      pendingPort.nodeId === nextPort.nodeId ||
      endpointKey(pendingPort) === endpointKey(nextPort)
    ) {
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setSelection({ kind: 'node', id: nextPort.nodeId })
      return true
    }

    if (getRelationLinkForPort(layout, nextPort)) {
      setAttachTargetNodeId(nextPort.nodeId)
      setSelection({ kind: 'node', id: nextPort.nodeId })
      return true
    }

    if (wouldCreateRelationCycle(layout, pendingPort.nodeId, nextPort.nodeId)) {
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setSelection({ kind: 'node', id: nextPort.nodeId })
      return true
    }

    setLayout((currentLayout) => {
      if (wouldCreateRelationCycle(currentLayout, pendingPort.nodeId, nextPort.nodeId)) {
        return currentLayout
      }

      const snappedLayout = snapRelationEndpoints(currentLayout, pendingPort, nextPort)

      return {
        ...snappedLayout,
        links: [...snappedLayout.links, createLink(snappedLayout, pendingPort, nextPort)],
      }
    })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setSelection({ kind: 'node', id: nextPort.nodeId })
    return true
  }

  // 노드 클릭은 attach 중이면 target 선택, 일반 상태면 relation group drag 시작으로 분기한다.
  const handleNodePointerDown = (node: EditorNode, event: ReactPointerEvent<SVGGElement>) => {
    if (event.button !== 0) {
      return
    }

    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      return
    }

    const cursor = getSvgCursor(svg, event.clientX, event.clientY)

    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
      setDragState(null)
      setResizeState(null)
      return
    }

    const shouldDragCurrentMultiSelection = selection?.kind === 'multi' && selectedNodeIds.has(node.id) && !pendingPort
    if (!shouldDragCurrentMultiSelection) {
      setSelection({ kind: 'node', id: node.id })
    }

    if (pendingPort) {
      const nearestPort = getNearestAttachCandidatePort(layout, node, cursor)
      if (nearestPort) {
        completePendingAttach({ nodeId: node.id, portId: nearestPort.id })
        return
      }

      setAttachTargetNodeId(node.id)
      setDragState(null)
      setResizeState(null)
      return
    }

    beginLayoutHistoryBatch()

    const groupNodeIds = shouldDragCurrentMultiSelection
      ? selection.ids
      : getRelationGroupNodeIds(layout, node.id)
    const originNodes = getOriginNodes(layout, groupNodeIds)

    setDragState({
      nodeId: node.id,
      offsetX: cursor.x - node.x,
      offsetY: cursor.y - node.y,
      groupNodeIds,
      originNodes,
    })
  }

  // attach 중 다른 노드 위에 올라가면 선택 가능한 target 하이라이트를 표시한다.
  const handleNodePointerEnter = (node: EditorNode) => {
    if (!pendingPort || pendingPort.nodeId === node.id) {
      return
    }

    setAttachTargetNodeId(node.id)
  }

  // 파이프/맨홀 resize handle을 누르면 수동 길이 변경 batch를 시작한다.
  const handlePipeResizePointerDown = (
    node: EditorNode,
    edge: ResizeEdge,
    event: ReactPointerEvent<SVGRectElement>,
  ) => {
    if (event.button !== 0) {
      return
    }

    event.stopPropagation()
    if (pendingPort) {
      setSelection({ kind: 'node', id: node.id })
      setAttachTargetNodeId(node.id)
      setDragState(null)
      setResizeState(null)
      return
    }

    if (!getManualResizableEdges(node)[edge]) {
      return
    }

    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      return
    }

    const cursor = getSvgCursor(svg, event.clientX, event.clientY)
    setSelection({ kind: 'node', id: node.id })
    setDragState(null)
    beginLayoutHistoryBatch()
    setResizeState({
      nodeId: node.id,
      edge,
      originNode: node,
      edgePointerOffset: getResizeEdgePointerOffset(node, edge, cursor),
      anchorBounds: getResizeAnchorBoundsForNode(layout, node),
    })
  }

  // 포트 클릭은 attach 시작/완료만 담당하고, 이미 연결된 포트는 단순 선택으로 처리한다.
  const handlePortClick = (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => {
    event.stopPropagation()
    if (coordinateEditState || window.performance.now() < suppressCoordinateEditFollowUpClickUntilRef.current) {
      suppressCoordinateEditFollowUpClickUntilRef.current = 0
      return
    }

    const nextPort = { nodeId, portId }

    if (pendingPort) {
      completePendingAttach(nextPort)
      return
    }

    const existingRelation = getRelationLinkForPort(layout, nextPort)
    if (existingRelation) {
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setSelection({ kind: 'node', id: nodeId })
      return
    }

    setPendingPort(nextPort)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setSelection({ kind: 'node', id: nodeId })
  }

  // 우클릭 메뉴에서 시설/커넥터 같은 기본 노드를 추가하는 액션이다.
  const addNode = (type: EditorNodeType, point?: Point) => {
    const node = normalizeNodeGeometryForPipePreset(createEditorNode(type, nextNodeIndex, layout.groundSurfaceY))
    const positionedNode = point
      ? {
          ...node,
          x: point.x - node.width / 2,
          y: point.y - node.height / 2,
        }
      : node

    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: [
        ...currentLayout.nodes,
        snapNodeToGround(
          positionedNode,
          currentLayout.groundSurfaceY,
        ),
      ],
    }))
    setSelection({ kind: 'node', id: node.id })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
  }

  // 우클릭 메뉴의 독립 파이프 추가 액션이다.
  const addStandalonePipe = (point?: Point) => {
    const timestamp = Date.now()
    const pipeId = `pipe_free_${timestamp}`

    setLayout((currentLayout) => {
      const row = currentLayout.nodes.length % 5
      const x = point ? point.x - 160 : 180 + row * 70
      const y = point ? point.y - (PIPE_THICKNESS.medium + PIPE_BORDER.medium * 2) / 2 : currentLayout.groundSurfaceY + 270 + row * 28
      const pipeNode: EditorNode = {
        id: pipeId,
        swmmId: pipeId,
        name: '파이프',
        type: 'pipeSegment',
        x,
        y,
        width: 320,
        height: PIPE_THICKNESS.medium + PIPE_BORDER.medium * 2,
        ports: CONNECTOR_PORTS,
        props: {
          size: 'medium',
          pipeKind: DEFAULT_PIPE_KIND,
          slope: 0.001154,
          blockage: 0,
        },
      }

      return {
        ...currentLayout,
        nodes: [...currentLayout.nodes, pipeNode],
      }
    })
    setSelection({ kind: 'node', id: pipeId })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
  }

  // 레이아웃 + 핸들에서 땅/하천/바다 terrain을 기존 레이아웃과 같은 높이로 체인 추가한다.
  const addLayoutNode = (kind: LayoutAddKind, source: ContextMenuState['layoutAdd']) => {
    if (!source) {
      return
    }

    const nodeType: EditorNodeType = 'terrain'
    const createdNode = normalizeNodeGeometryForPipePreset(
      createEditorNode(nodeType, nextNodeIndex, layout.groundSurfaceY),
    )
    const sourceWidth = Math.max(80, source.bounds.right - source.bounds.left)
    const baseTerrainHeight = Math.max(MIN_TERRAIN_HEIGHT, canvasHeight - layout.groundSurfaceY)
    const width = Math.max(
      MIN_TERRAIN_WIDTH,
      source.side === 'bottom'
        ? sourceWidth
        : Math.min(Math.max(sourceWidth, createdNode.width), 1400),
    )
    const height = baseTerrainHeight
    const x = source.side === 'left'
      ? source.bounds.left - width
      : source.side === 'right'
        ? source.bounds.right
        : source.bounds.left
    const y = source.side === 'bottom'
      ? source.bounds.bottom
      : source.bounds.top
    const props: Record<string, string | number | boolean> = { terrainKind: kind }
    const nodeName = `${TERRAIN_KIND_BY_ID[kind].nodeName} ${nextNodeIndex}`
    const nextNode = normalizeNodePorts({
      ...createdNode,
      name: nodeName,
      x,
      y,
      width,
      height,
      ports: createEditorPorts(nodeType, width, height),
      props,
    })

    setLayout((currentLayout) => ({
      ...currentLayout,
      nodes: [...currentLayout.nodes, nextNode],
    }))
    setSelection({ kind: 'node', id: nextNode.id })
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
  }

  // localStorage를 지우고 기본 editor layout으로 되돌린다.
  const resetLayout = () => {
    clearEditorLayout()
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setSelection(null)
    setContextMenu(null)
    setMarqueeSelectionState(null)
    setSwmmConversionResult(null)
    setLayout(normalizeEditorLayout(createDefaultEditorLayout()))
  }

  // JSON 파일을 불러와 legacy 값을 보정한 뒤 현재 layout으로 적용한다.
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    const parsedValue: unknown = JSON.parse(text)
    if (isEditorLayout(parsedValue)) {
      setLayout(normalizeEditorLayout(parsedValue))
      setPendingPort(null)
      setAttachTargetNodeId(null)
      setCoordinateEditState(null)
      setSelection(null)
      setContextMenu(null)
      setMarqueeSelectionState(null)
      setSwmmConversionResult(null)
    }

    event.target.value = ''
  }

  // 현재 editor layout을 서버 변환 API에 보내 SWMM INP 파일로 내려받는다.
  const handleExportSwmmInp = async () => {
    if (isExportingInp) {
      return
    }

    setIsExportingInp(true)
    try {
      const warnings = await downloadSwmmInp(layout)
      if (warnings.length > 0) {
        window.alert(`SWMM INP를 생성했지만 확인할 내용이 있습니다.\n\n${warnings.join('\n')}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM INP 내보내기에 실패했습니다.\n\n${message}\n\nSWMM 엔진 서버(${SWMM_ENGINE_URL})가 실행 중인지 확인해주세요.`)
    } finally {
      setIsExportingInp(false)
    }
  }

  const handleValidateSwmmConversion = async () => {
    if (isValidatingSwmm) {
      return
    }

    setIsValidatingSwmm(true)
    try {
      const result = await requestSwmmConversionValidation(layout)
      setSwmmConversionResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 변환 검증에 실패했습니다.\n\n${message}\n\nSWMM 엔진 서버(${SWMM_ENGINE_URL})가 실행 중인지 확인해주세요.`)
    } finally {
      setIsValidatingSwmm(false)
    }
  }

  const handleExportSwmmZip = async () => {
    if (isExportingSwmmZip) {
      return
    }

    setIsExportingSwmmZip(true)
    try {
      await downloadSwmmConversionZip(layout)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM ZIP 내보내기에 실패했습니다.\n\n${message}\n\n검증 결과의 error를 먼저 확인해주세요.`)
    } finally {
      setIsExportingSwmmZip(false)
    }
  }

  const handleDownloadConversionReport = () => {
    if (!swmmConversionResult) {
      return
    }

    downloadTextFile(
      JSON.stringify(swmmConversionResult.report, null, 2),
      'conversion-report.json',
      'application/json;charset=utf-8',
    )
  }

  const handleDownloadConversionMapping = () => {
    if (!swmmConversionResult) {
      return
    }

    downloadTextFile(
      JSON.stringify(swmmConversionResult.mapping, null, 2),
      'swmm-react-mapping.json',
      'application/json;charset=utf-8',
    )
  }

  // 렌더링에서만 쓰는 최종 UI 파생 상태다.
  const hasSelection = Boolean(selectedNode || selectedLink || selection?.kind === 'multi')
  useEffect(() => {
    if (hasSelection) {
      setIsEditorInfoPanelOpen(true)
    }
  }, [hasSelection])

  const marqueeRect = marqueeSelectionState
    ? normalizeRect(marqueeSelectionState.start, marqueeSelectionState.current)
    : null
  const editorCanvasBaseWidth = editorCanvasFitWidth > 0 ? editorCanvasFitWidth : canvasWidth * EDITOR_ZOOM_DEFAULT
  const editorCanvasRenderedWidth = editorCanvasBaseWidth * (editorZoom / EDITOR_ZOOM_DEFAULT)
  const editorCanvasRenderedHeight = editorCanvasRenderedWidth * (canvasHeight / canvasWidth)

  const updateEditorZoom = (delta: number) => {
    setEditorZoom((current) => clampNumber(current + delta, EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX))
  }

  return (
    <>
    <section className="relative min-w-0 p-4" data-swmm-theme={theme}>
      <div className={`h-[calc(100vh-150px)] min-h-[640px] overflow-auto rounded-lg border shadow-sm ${themeTokens.panel}`}>
        <div className={`sticky top-0 z-40 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shadow-sm backdrop-blur ${themeTokens.controlBar}`}>
          <div>
            <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>편집 모드 v1</h2>
            <p className={`mt-1 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              지상 객체를 드래그하고 포트 두 개를 클릭하면 관계 링크만 생성됩니다.
              객체/파이프 추가는 캔버스 우클릭 메뉴에서 선택하고, 연결 시 선택 포트끼리 자동으로 맞닿습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className={`flex items-center gap-1 rounded-md border p-1 ${themeTokens.panelMuted}`}>
              <button
                type="button"
                onClick={() => updateEditorZoom(-EDITOR_ZOOM_STEP)}
                className={`rounded px-2.5 py-1.5 text-xs font-black ${themeTokens.button}`}
              >
                축소
              </button>
              <span className={`min-w-12 text-center text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {Math.round(editorZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => updateEditorZoom(EDITOR_ZOOM_STEP)}
                className={`rounded px-2.5 py-1.5 text-xs font-black ${themeTokens.button}`}
              >
                확대
              </button>
              <button
                type="button"
                onClick={() => setEditorZoom(EDITOR_ZOOM_DEFAULT)}
                className={`rounded px-2.5 py-1.5 text-xs font-black ${themeTokens.buttonMuted}`}
              >
                초기화
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsEditorInfoPanelOpen(true)}
              className={`rounded-md border px-3 py-2 text-xs font-black ${themeTokens.button}`}
            >
              편집 정보
            </button>
            <button
              type="button"
              onClick={undoEditorLayout}
              disabled={!canUndo}
              className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 ${themeTokens.button}`}
              title="Command/Ctrl + Z"
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={redoEditorLayout}
              disabled={!canRedo}
              className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 ${themeTokens.button}`}
              title="Command/Ctrl + Shift + Z"
            >
              다시 실행
            </button>
            <button
              type="button"
              onClick={() => downloadLayout(layout)}
              className={`rounded-md border px-3 py-2 text-xs font-black ${
                isDark ? 'border-blue-900 bg-slate-900 text-blue-200 hover:bg-slate-800' : 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-slate-100'
              }`}
            >
              JSON 내보내기
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-md border px-3 py-2 text-xs font-black ${
                isDark ? 'border-emerald-900 bg-slate-900 text-emerald-200 hover:bg-slate-800' : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-slate-100'
              }`}
            >
              JSON 불러오기
            </button>
            <button
              type="button"
              onClick={resetLayout}
              className={`rounded-md border px-3 py-2 text-xs font-black ${
                isDark ? 'border-rose-900 bg-slate-900 text-rose-200 hover:bg-slate-800' : 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-slate-100'
              }`}
            >
              초기화
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>

        <div ref={editorCanvasViewportRef} className="min-w-0 overflow-auto bg-[#e8f5ff] p-6">
          <div
            className="mx-auto"
            style={{
              width: editorCanvasRenderedWidth,
            }}
          >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            width={editorCanvasRenderedWidth}
            height={editorCanvasRenderedHeight}
            className={`block max-w-none rounded-md border border-dashed border-slate-300 bg-white/60 ${
              coordinateEditAxis === 'x'
                ? 'cursor-ew-resize'
                : coordinateEditAxis === 'y'
                  ? 'cursor-ns-resize'
                  : ''
            }`}
            role="img"
            aria-label="배수도 편집 캔버스"
            onPointerDown={handleCanvasPointerDown}
            onContextMenu={handleCanvasContextMenu}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={finishPointerInteraction}
            onPointerLeave={handleCanvasPointerLeave}
          >
            <rect x="0" y="0" width={canvasWidth} height={layout.groundSurfaceY} fill="#e8f5ff" />
            <rect
              x={baseGroundBounds.left}
              y={baseGroundBounds.top}
              width={baseGroundWidth}
              height={baseGroundHeight}
              fill="#a86435"
            />
            {Array.from({
              length: Math.ceil(baseGroundWidth / 260) * Math.ceil(baseGroundHeight / 44),
            }, (_, index) => {
              const columns = Math.ceil(baseGroundWidth / 260)
              const column = index % columns
              const row = Math.floor(index / columns)
              const start = baseGroundBounds.left + column * 260
              const baseY = baseGroundBounds.top + 22 + row * 44
              return (
                <path
                  key={`editor-soil-wave-${index}`}
                  d={`M${start} ${baseY} C${start + 36} ${baseY - 14} ${
                    start + 76
                  } ${baseY + 14} ${start + 116} ${baseY} S${
                    start + 204
                  } ${baseY - 14} ${start + 260} ${baseY}`}
                  fill="none"
                  stroke="rgba(255,255,255,.14)"
                  strokeWidth="3"
                />
              )
            })}
            <line
              x1={baseGroundBounds.left}
              y1={layout.groundSurfaceY}
              x2={baseGroundBounds.right}
              y2={layout.groundSurfaceY}
              stroke="#7c4a26"
              strokeWidth="4"
            />
            {marqueeRect ? (
              <rect
                x={marqueeRect.left}
                y={marqueeRect.top}
                width={marqueeRect.right - marqueeRect.left}
                height={marqueeRect.bottom - marqueeRect.top}
                fill="rgba(59, 130, 246, .12)"
                stroke="#2563eb"
                strokeWidth="2"
                strokeDasharray="8 6"
                pointerEvents="none"
              />
            ) : null}

            <g>
              {renderedNodes
                .filter((node) => node.type === 'terrain')
                .map((node) => (
                  <EditableNode
                    key={node.id}
                    layout={layout}
                    node={node}
                    connectedPortKeys={connectedPortKeys}
                    selectedRelationPortRoles={selectedRelationPortRoles}
                    selectedParentPortKeys={selectedParentPortKeys}
                    pendingPort={pendingPort}
                    attachTargetNodeId={attachTargetNodeId}
                    coordinateEditActive={Boolean(coordinateEditState)}
                    selected={selectedNodeIds.has(node.id)}
                    onPointerDown={handleNodePointerDown}
                    onPointerEnter={handleNodePointerEnter}
                    onNodeContextMenu={handleNodeContextMenu}
                    onPortClick={handlePortClick}
                    onPortContextMenu={handlePortContextMenu}
                    onResizePointerDown={handlePipeResizePointerDown}
                  />
                ))}
            </g>
            <g>
              {renderedNodes
                .filter((node) => node.type === 'terrain')
                .map((node) => (
                  <g key={`${node.id}-layout-add-handles`} transform={`translate(${node.x} ${node.y})`}>
                    <LayoutAddHandles
                      bounds={{ left: 0, top: 0, right: node.width, bottom: node.height }}
                      onPointerDown={(side, event) => handleNodeLayoutAddPointerDown(node, side, event)}
                    />
                  </g>
                ))}
              <LayoutAddHandles
                bounds={baseGroundBounds}
                onPointerDown={handleBaseLayoutAddPointerDown}
              />
            </g>

            <g>
              {layout.links.map((link) => (
                <EditableLink
                  key={link.id}
                  layout={layout}
                  link={link}
                  selected={selection?.kind === 'link' && selection.id === link.id}
                  onSelect={() => setSelection({ kind: 'link', id: link.id })}
                />
              ))}
            </g>

            <g>
              {renderedNodes.filter((node) => node.type !== 'terrain').map((node) => (
                <EditableNode
                  key={node.id}
                  layout={layout}
                  node={node}
                  connectedPortKeys={connectedPortKeys}
                  selectedRelationPortRoles={selectedRelationPortRoles}
                  selectedParentPortKeys={selectedParentPortKeys}
                  pendingPort={pendingPort}
                  attachTargetNodeId={attachTargetNodeId}
                  coordinateEditActive={Boolean(coordinateEditState)}
                  selected={selectedNodeIds.has(node.id)}
                  onPointerDown={handleNodePointerDown}
                  onPointerEnter={handleNodePointerEnter}
                  onNodeContextMenu={handleNodeContextMenu}
                  onPortClick={handlePortClick}
                  onPortContextMenu={handlePortContextMenu}
                  onResizePointerDown={handlePipeResizePointerDown}
                />
              ))}
            </g>
          </svg>
          </div>
        </div>
      </div>

      <div
        className={`fixed bottom-0 right-0 top-0 z-[100] w-[min(420px,calc(100vw-32px))] transform transition-transform duration-200 ${
          isEditorInfoPanelOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
      <aside className={`editor-drawer flex h-full flex-col overflow-hidden shadow-2xl ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>
          <h2 className="text-base font-black">편집 정보</h2>
          <button
            type="button"
            onClick={() => setIsEditorInfoPanelOpen(false)}
            className={`rounded-md border px-3 py-2 text-xs font-black ${themeTokens.button}`}
          >
            닫기
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
        {hasSelection ? (
          <>
            <p className={`mt-2 text-sm font-semibold leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              현재 편집 상태는 localStorage에 자동 저장됩니다. 내보낸 JSON은 다음 단계의 SWMM 모델/React 렌더링
              기준 데이터로 사용할 수 있습니다.
            </p>

            <div className={`mt-5 rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-slate-200/70'}`}>
              <div className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>포트 연결 상태</div>
              <div className={`mt-1 text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {coordinateEditState
                  ? `좌표 변경 중 (${coordinateEditAxis === 'x' ? 'x축' : coordinateEditAxis === 'y' ? 'y축' : '축 미확인'})`
                  : pendingPort
                  ? `${pendingPort.nodeId} / ${pendingPort.portId} 선택됨`
                  : selection?.kind === 'multi'
                  ? `${selectedNodeIds.size}개 객체 선택됨`
                  : '첫 번째 포트를 선택하세요'}
              </div>
              {coordinateEditState ? (
                <div className="mt-2 text-xs font-semibold leading-5 text-blue-700">
                  마우스를 움직여 붙는 위치를 조정하고, 원하는 위치에서 한 번 클릭하면 종료됩니다.
                </div>
              ) : null}
            </div>

            {selection?.kind === 'multi' ? (
              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-800">여러 객체 선택</h3>
                  <button
                    type="button"
                    onClick={deleteSelection}
                    className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-white"
                  >
                    삭제
                  </button>
                </div>
                <p className="mt-2 text-sm font-bold leading-6 text-blue-700">
                  {selectedNodeIds.size}개 객체가 선택되었습니다. 드래그하면 선택된 relation 그룹 전체가 함께 이동하고,
                  Command/Ctrl + C, Command/Ctrl + V로 복사/붙여넣기할 수 있습니다.
                </p>
              </div>
            ) : (
              <SelectionPanel
                node={selectedNode}
                link={selectedLink}
                connectedLinks={selectedConnectedLinks}
                groundSurfaceY={layout.groundSurfaceY}
                onUpdateNode={updateNode}
                onRotateNode={rotateNodeClockwise}
                onUpdateLink={updateLink}
                onUpdateLinkProps={updateLinkProps}
                onDeleteSelection={deleteSelection}
              />
            )}
          </>
        ) : null}

        <div className={`mt-5 rounded-lg border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-sky-200 bg-sky-50'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>시뮬레이션</h3>
              <p className={`mt-1 text-xs font-semibold leading-5 ${isDark ? 'text-slate-300' : 'text-sky-800'}`}>
                현재 편집 JSON을 서버에서 SWMM INP, 변환 리포트, 매핑 JSON으로 변환합니다.
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
              swmmConversionResult
                ? swmmConversionResult.ok
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {swmmConversionResult ? (swmmConversionResult.ok ? 'OK' : 'ERROR') : 'READY'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleValidateSwmmConversion}
              disabled={isValidatingSwmm}
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-700 hover:bg-sky-100 disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400"
              title={`SWMM 엔진 서버: ${SWMM_ENGINE_URL}`}
            >
              {isValidatingSwmm ? '검증 중' : 'SWMM 변환 검증'}
            </button>
            <button
              type="button"
              onClick={handleExportSwmmZip}
              disabled={isExportingSwmmZip || swmmConversionResult?.ok === false}
              className="rounded-md border border-blue-200 bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {isExportingSwmmZip ? 'ZIP 생성 중' : 'INP/리포트 ZIP'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportSwmmInp}
            disabled={isExportingInp}
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400"
            title={`SWMM 엔진 서버: ${SWMM_ENGINE_URL}`}
          >
            {isExportingInp ? 'INP 생성 중' : 'INP만 다운로드'}
          </button>

          {swmmConversionResult ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <SummaryCard label="conduits" value={swmmConversionResult.report.counts.conduits ?? 0} />
                <SummaryCard label="nodes" value={
                  (swmmConversionResult.report.counts.junctions ?? 0) +
                  (swmmConversionResult.report.counts.storages ?? 0) +
                  (swmmConversionResult.report.counts.outfalls ?? 0)
                } />
                <SummaryCard label="errors" value={swmmConversionResult.report.counts.errors ?? 0} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadConversionReport}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  리포트 JSON
                </button>
                <button
                  type="button"
                  onClick={handleDownloadConversionMapping}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  매핑 JSON
                </button>
              </div>
              {swmmConversionResult.report.errors.length > 0 ? (
                <div className="rounded-md border border-rose-100 bg-white px-3 py-2">
                  <div className="text-xs font-black text-rose-600">error</div>
                  <ul className="mt-1 space-y-1">
                    {swmmConversionResult.report.errors.slice(0, 4).map((message) => (
                      <li key={message} className="text-xs font-bold leading-5 text-rose-700">{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {swmmConversionResult.report.warnings.length > 0 ? (
                <div className="rounded-md border border-amber-100 bg-white px-3 py-2">
                  <div className="text-xs font-black text-amber-600">warning</div>
                  <ul className="mt-1 space-y-1">
                    {swmmConversionResult.report.warnings.slice(0, 4).map((message) => (
                      <li key={message} className="text-xs font-bold leading-5 text-amber-700">{message}</li>
                    ))}
                  </ul>
                </div>
	              ) : null}
	            </div>
	          ) : null}
	        </div>

	        <div className="mt-5">
          <h3 className="text-sm font-black">모델 요약</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SummaryCard label="nodes" value={layout.nodes.length} />
            <SummaryCard label="links" value={layout.links.length} />
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-black">drainage-layout.json</h3>
          <textarea
            readOnly
            value={JSON.stringify(layout, null, 2)}
            className="mt-2 h-72 w-full resize-none rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100"
          />
        </div>
        </div>
      </aside>
      </div>
    </section>
    {contextMenu ? (
      <div
        data-editor-context-menu="true"
        className="fixed z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="border-b border-slate-100 px-3 py-2 text-xs font-black text-slate-400">
          편집 메뉴
        </div>
        {contextMenu.nodeId ? (
          <>
            <button
              type="button"
              onClick={() => changeContextNodeZOrder('bringToFront')}
              className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              맨 앞으로 보내기
            </button>
            <button
              type="button"
              onClick={() => changeContextNodeZOrder('bringForward')}
              className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              앞으로 보내기
            </button>
            <button
              type="button"
              onClick={() => changeContextNodeZOrder('sendBackward')}
              className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              뒤로 보내기
            </button>
            <button
              type="button"
              onClick={() => changeContextNodeZOrder('sendToBack')}
              className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              맨 뒤로 보내기
            </button>
            {getCoordinateEditableTeeRelationInfo(layout, contextMenu.nodeId) ? (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={startContextTeeCoordinateEdit}
                  className="block w-full px-3 py-2 text-left text-sm font-black text-blue-700 hover:bg-blue-50"
                >
                  좌표 변경
                </button>
              </>
            ) : null}
          </>
        ) : contextMenu.layoutAdd ? (
          <>
            {LAYOUT_ADD_KIND_OPTIONS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => addLayoutNode(kind, contextMenu.layoutAdd)}
                className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                {LAYOUT_ADD_KIND_LABELS[kind]} 추가
              </button>
            ))}
          </>
        ) : contextMenu.relationPort ? (
          <>
            <button
              type="button"
              onClick={detachContextRelation}
              className="block w-full px-3 py-2 text-left text-sm font-black text-rose-700 hover:bg-rose-50"
            >
              해체
            </button>
          </>
        ) : null}
        {!contextMenu.layoutAdd && !contextMenu.nodeId && !contextMenu.relationPort ? (
          <>
            {NODE_BUTTONS.map((nodeType) => (
              <button
                key={nodeType}
                type="button"
                onClick={() => {
                  addNode(nodeType, contextMenu.point)
                  setContextMenu(null)
                }}
                className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {NODE_LABELS[nodeType]} 추가
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                addStandalonePipe(contextMenu.point)
                setContextMenu(null)
              }}
              className="block w-full px-3 py-2 text-left text-sm font-bold text-sky-700 hover:bg-sky-50"
            >
              파이프 추가
            </button>
          </>
        ) : null}
      </div>
    ) : null}
    </>
  )
}


// ---------------------------------------------------------------------------
// SVG relation/link 렌더링 컴포넌트
// ---------------------------------------------------------------------------
/** link/relation SVG path와 direction marker를 렌더링한다. */
function EditableLink({
  layout,
  link,
  selected,
  onSelect,
}: {
  layout: EditorLayout
  link: EditorLink
  selected: boolean
  onSelect: () => void
}) {
  const path = getLinkPath(layout, link)
  const start = getLinkEndpointPoint(layout, link, 'from')
  const end = getLinkEndpointPoint(layout, link, 'to')
  if (!path || !start || !end) {
    return null
  }

  const thickness = PIPE_THICKNESS[link.size]
  const border = PIPE_BORDER[link.size]
  const labelX = (start.x + end.x) / 2
  const labelY = (start.y + end.y) / 2 - 12
  const palette = getPipePalette(link.props.pipeKind)
  const fill = palette.fill
  const edge = selected ? '#f97316' : palette.stroke

  if (link.type === 'relation') {
    const arrowSize = getRelationArrowSize(layout, link, start, end)
    const arrowOffset = clampNumber(arrowSize * 0.75, 4, 8)
    const markerId = getRelationMarkerId(link, selected)
    const relationColor = selected ? '#f97316' : '#64748b'
    const relationStrokeWidth = selected ? 3.2 : 2.2

    return (
      <g onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}>
        <defs>
          <marker
            id={markerId}
            markerUnits="userSpaceOnUse"
            markerWidth={arrowSize + arrowOffset}
            markerHeight={arrowSize}
            refX={arrowSize + arrowOffset}
            refY={arrowSize / 2}
            orient="auto"
            viewBox={`0 0 ${arrowSize + arrowOffset} ${arrowSize}`}
          >
            <path
              d={`M0 0 L${arrowSize} ${arrowSize / 2} L0 ${arrowSize} Z`}
              fill={relationColor}
            />
          </marker>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke={relationColor}
          strokeWidth={relationStrokeWidth}
          strokeDasharray={selected ? 'none' : '7 7'}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#${markerId})`}
          opacity={selected ? 0.95 : 0.7}
          pointerEvents="none"
        />
      </g>
    )
  }

  return (
    <g onClick={(event) => {
      event.stopPropagation()
      onSelect()
    }}>
      <path
        d={path}
        fill="none"
        stroke={edge}
        strokeWidth={thickness + border * 2}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={fill}
        strokeWidth={thickness}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={palette.center}
        strokeWidth="10"
        strokeDasharray="24 22"
        strokeLinecap="round"
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        className="select-none text-[18px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="5"
      >
        {link.name}
      </text>
    </g>
  )
}

/** 노드 본체, 포트, resize handle을 묶어 렌더링한다. */
function EditableNode({
  layout,
  node,
  selected,
  connectedPortKeys,
  selectedRelationPortRoles,
  selectedParentPortKeys,
  pendingPort,
  attachTargetNodeId,
  coordinateEditActive,
  onPointerDown,
  onPointerEnter,
  onNodeContextMenu,
  onPortClick,
  onPortContextMenu,
  onResizePointerDown,
}: {
  layout: EditorLayout
  node: EditorNode
  selected: boolean
  connectedPortKeys: Set<string>
  selectedRelationPortRoles: Map<string, RelationPortRole>
  selectedParentPortKeys: Set<string>
  pendingPort: EditorPortSelection | null
  attachTargetNodeId: string | null
  coordinateEditActive: boolean
  onPointerDown: (node: EditorNode, event: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter: (node: EditorNode) => void
  onNodeContextMenu: (node: EditorNode, event: ReactMouseEvent<SVGGElement>) => void
  onPortClick: (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => void
  onPortContextMenu: (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => void
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}) {
  const isAttachMode = Boolean(pendingPort)
  const isAttachTarget = pendingPort !== null && attachTargetNodeId === node.id && pendingPort.nodeId !== node.id
  const includeAttachCandidatePorts = isAttachTarget
  const renderablePorts = getNodeRenderablePorts(
    node,
    pendingPort,
    includeAttachCandidatePorts,
    connectedPortKeys,
    selectedRelationPortRoles,
  )
  const showResizeHandles = selected && !isAttachMode

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      className={isAttachMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}
      onPointerDown={(event) => onPointerDown(node, event)}
      onPointerEnter={() => onPointerEnter(node)}
      onContextMenu={(event) => onNodeContextMenu(node, event)}
    >
      <NodeBody node={node} selected={selected} />
      {showResizeHandles && hasManualResizableEdge(node) ? (
        <PipeResizeHandles node={node} onResizePointerDown={onResizePointerDown} />
      ) : null}
      {renderablePorts.map((port) => {
        const point = getRenderedPortPoint(layout, node, port)
        const portKey = endpointKey({ nodeId: node.id, portId: port.id })
        const isConnected = connectedPortKeys.has(portKey)
        const isSelectedParentPort = selectedParentPortKeys.has(portKey)
        const relationRole = selectedRelationPortRoles.get(portKey)
        const isPending = pendingPort?.nodeId === node.id && pendingPort.portId === port.id
        const tapInfo = supportsAttachTapPorts(node) ? getAttachTapPortInfo(port.id) : null
        const isAttachTap = Boolean(tapInfo)
        const isCenterTap = tapInfo?.percentage === ATTACH_TAP_CENTER_PERCENTAGE
        const shouldShowPort = (
          isPending ||
          Boolean(relationRole) ||
          (!isAttachMode && selected && (!isConnected || isSelectedParentPort)) ||
          isAttachTarget
        )
        const shouldRenderAttachBar = isAttachTarget && !isPending && !relationRole
        const roleColor = relationRole === 'parent' ? '#2563eb' : '#f97316'
        const roleLabel = relationRole === 'parent' ? '부' : '자'
        const portDotRadius = isAttachTap ? 4.5 : PORT_DOT_RADIUS
        const portHitRadius = isAttachTap ? 8 : PORT_HIT_RADIUS
        const idleFill = isCenterTap ? '#fef3c7' : '#f8fafc'
        const idleStroke = isCenterTap ? '#d97706' : '#64748b'

        return (
          <g key={port.id}>
            {isPending ? (
              <>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={PENDING_PORT_HALO_RADIUS}
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="3"
                  opacity="0.55"
                  pointerEvents="none"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={PENDING_PORT_DOT_RADIUS}
                  fill="#f97316"
                  stroke="#9a3412"
                  strokeWidth="2.5"
                  pointerEvents="none"
                />
              </>
            ) : null}
            {shouldShowPort && !isPending ? (
              <>
                {isConnected && !shouldRenderAttachBar && (isSelectedParentPort || Boolean(relationRole)) ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={PORT_HALO_RADIUS}
                    fill={relationRole === 'child' ? 'rgba(249, 115, 22, 0.18)' : 'rgba(59, 130, 246, 0.18)'}
                    stroke={relationRole ? roleColor : '#2563eb'}
                    strokeWidth="3"
                    pointerEvents="none"
                  />
                ) : null}
                {shouldRenderAttachBar ? (
                  <line
                    x1={point.x}
                    y1={point.y - 8}
                    x2={point.x}
                    y2={point.y + 8}
                    stroke={isConnected ? '#2563eb' : '#f97316'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={isConnected ? 0.72 : 1}
                    pointerEvents="none"
                  />
                ) : (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={portDotRadius}
                    fill={relationRole ? roleColor : isSelectedParentPort ? '#60a5fa' : idleFill}
                    stroke={relationRole ? '#ffffff' : isSelectedParentPort ? '#1d4ed8' : idleStroke}
                    strokeWidth={isAttachTap ? 2.2 : 3}
                    pointerEvents="none"
                  />
                )}
                {relationRole ? (
                  <g pointerEvents="none">
                    <circle
                      cx={point.x + 13}
                      cy={point.y - 13}
                      r="8"
                      fill={roleColor}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={point.x + 13}
                      y={point.y - 9.8}
                      textAnchor="middle"
                      className="select-none text-[9px] font-black"
                      fill="#ffffff"
                    >
                      {roleLabel}
                    </text>
                  </g>
                ) : null}
              </>
            ) : null}
            <circle
              cx={point.x}
              cy={point.y}
              r={portHitRadius}
              fill="transparent"
              stroke="transparent"
              strokeWidth="0"
              className="cursor-crosshair"
              onPointerDown={(event) => {
                if (!coordinateEditActive) {
                  event.stopPropagation()
                }
              }}
              onClick={(event) => onPortClick(node.id, port.id, event)}
              onContextMenu={(event) => onPortContextMenu(node.id, port.id, event)}
            />
          </g>
        )
      })}
    </g>
  )
}

/** 지형 세그먼트 주변의 + 추가 핸들을 렌더링한다. */
function LayoutAddHandles({
  bounds,
  onPointerDown,
}: {
  bounds: RectBounds
  onPointerDown: (side: LayoutAddSide, event: ReactPointerEvent<SVGGElement>) => void
}) {
  const size = LAYOUT_ADD_HANDLE_SIZE
  const radius = size / 2 - 2
  const inset = 12
  const edgeHitSize = 72
  const guideStroke = 'rgba(15, 23, 42, 0.5)'
  const width = Math.max(1, bounds.right - bounds.left)
  const height = Math.max(1, bounds.bottom - bounds.top)
  const centerX = bounds.left + width / 2
  const centerY = bounds.top + height / 2
  const handles: Array<{
    side: LayoutAddSide
    x: number
    y: number
    hitX: number
    hitY: number
    hitWidth: number
    hitHeight: number
    lineX1: number
    lineY1: number
    lineX2: number
    lineY2: number
  }> = [
    {
      side: 'left',
      x: bounds.left + inset,
      y: clampNumber(centerY - size / 2, bounds.top + inset, bounds.bottom - size - inset),
      hitX: bounds.left,
      hitY: bounds.top,
      hitWidth: Math.min(edgeHitSize, width),
      hitHeight: height,
      lineX1: bounds.left + inset,
      lineY1: bounds.top + inset,
      lineX2: bounds.left + inset,
      lineY2: bounds.bottom - inset,
    },
    {
      side: 'right',
      x: bounds.right - size - inset,
      y: clampNumber(centerY - size / 2, bounds.top + inset, bounds.bottom - size - inset),
      hitX: bounds.right - Math.min(edgeHitSize, width),
      hitY: bounds.top,
      hitWidth: Math.min(edgeHitSize, width),
      hitHeight: height,
      lineX1: bounds.right - inset,
      lineY1: bounds.top + inset,
      lineX2: bounds.right - inset,
      lineY2: bounds.bottom - inset,
    },
    {
      side: 'bottom',
      x: clampNumber(centerX - size / 2, bounds.left + inset, bounds.right - size - inset),
      y: bounds.bottom - size - inset,
      hitX: bounds.left,
      hitY: bounds.bottom - Math.min(edgeHitSize, height),
      hitWidth: width,
      hitHeight: Math.min(edgeHitSize, height),
      lineX1: bounds.left + inset,
      lineY1: bounds.bottom - inset,
      lineX2: bounds.right - inset,
      lineY2: bounds.bottom - inset,
    },
  ]

  return (
    <g>
      {handles.map((handle) => (
        <g
          key={handle.side}
          className="group cursor-copy"
          onPointerDown={(event) => onPointerDown(handle.side, event)}
        >
          <rect
            x={handle.hitX}
            y={handle.hitY}
            width={handle.hitWidth}
            height={handle.hitHeight}
            fill="transparent"
            pointerEvents="all"
          />
          <line
            x1={handle.lineX1}
            y1={handle.lineY1}
            x2={handle.lineX2}
            y2={handle.lineY2}
            stroke={guideStroke}
            strokeWidth="4"
            strokeLinecap="round"
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            pointerEvents="none"
          />
          <circle
            cx={handle.x + size / 2}
            cy={handle.y + size / 2}
            r={radius}
            fill="rgba(248, 250, 252, 0.92)"
            stroke={guideStroke}
            strokeWidth="2.5"
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            pointerEvents="none"
          />
          <text
            x={handle.x + size / 2}
            y={handle.y + size / 2 + 1}
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none text-[20px] font-black opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            fill="rgba(15, 23, 42, 0.76)"
            pointerEvents="none"
          >
            +
          </text>
        </g>
      ))}
    </g>
  )
}

/** resize 가능한 edge의 보이지 않는 hit 영역과 hover 표시를 렌더링한다. */
function ResizeHandleRect({
  node,
  edge,
  x,
  y,
  width,
  height,
  cursorClassName,
  onResizePointerDown,
}: {
  node: EditorNode
  edge: ResizeEdge
  x: number
  y: number
  width: number
  height: number
  cursorClassName: string
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}) {
  if (width <= 0 || height <= 0) {
    return null
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(37, 99, 235, 0.22)"
      pointerEvents="all"
      className={`${cursorClassName} opacity-0 transition-opacity hover:opacity-100`}
      onPointerDown={(event) => onResizePointerDown(node, edge, event)}
    />
  )
}

/** 파이프/맨홀/지형/도로의 수동 resize handle을 렌더링한다. */
function PipeResizeHandles({
  node,
  onResizePointerDown,
}: {
  node: EditorNode
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}) {
  const hitSize = RESIZE_BORDER_HIT_SIZE
  const edges = getManualResizableEdges(node)

  if (node.type === 'pipeSegment') {
    const isHorizontal = getNodeOrientation(node) === 'horizontal'

    if (isHorizontal) {
      const halfWidth = Math.max(1, node.width / 2)

      return (
        <>
          {edges.left ? (
            <>
              <ResizeHandleRect
                node={node}
                edge="left"
                x={-hitSize / 2}
                y={0}
                width={hitSize}
                height={node.height}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="left"
                x={0}
                y={-hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="left"
                x={0}
                y={node.height - hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
            </>
          ) : null}
          {edges.right ? (
            <>
              <ResizeHandleRect
                node={node}
                edge="right"
                x={node.width - hitSize / 2}
                y={0}
                width={hitSize}
                height={node.height}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="right"
                x={halfWidth}
                y={-hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
              <ResizeHandleRect
                node={node}
                edge="right"
                x={halfWidth}
                y={node.height - hitSize / 2}
                width={halfWidth}
                height={hitSize}
                cursorClassName="cursor-ew-resize"
                onResizePointerDown={onResizePointerDown}
              />
            </>
          ) : null}
        </>
      )
    }

    const halfHeight = Math.max(1, node.height / 2)

    return (
      <>
        {edges.top ? (
          <>
            <ResizeHandleRect
              node={node}
              edge="top"
              x={0}
              y={-hitSize / 2}
              width={node.width}
              height={hitSize}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="top"
              x={-hitSize / 2}
              y={0}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="top"
              x={node.width - hitSize / 2}
              y={0}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
          </>
        ) : null}
        {edges.bottom ? (
          <>
            <ResizeHandleRect
              node={node}
              edge="bottom"
              x={0}
              y={node.height - hitSize / 2}
              width={node.width}
              height={hitSize}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="bottom"
              x={-hitSize / 2}
              y={halfHeight}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
            <ResizeHandleRect
              node={node}
              edge="bottom"
              x={node.width - hitSize / 2}
              y={halfHeight}
              width={hitSize}
              height={halfHeight}
              cursorClassName="cursor-ns-resize"
              onResizePointerDown={onResizePointerDown}
            />
          </>
        ) : null}
      </>
    )
  }

  return (
    <>
      {edges.left ? (
        <ResizeHandleRect
          node={node}
          edge="left"
          x={-hitSize / 2}
          y={0}
          width={hitSize}
          height={node.height}
          cursorClassName="cursor-ew-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
      {edges.right ? (
        <ResizeHandleRect
          node={node}
          edge="right"
          x={node.width - hitSize / 2}
          y={0}
          width={hitSize}
          height={node.height}
          cursorClassName="cursor-ew-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
      {edges.top ? (
        <ResizeHandleRect
          node={node}
          edge="top"
          x={0}
          y={-hitSize / 2}
          width={node.width}
          height={hitSize}
          cursorClassName="cursor-ns-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
      {edges.bottom ? (
        <ResizeHandleRect
          node={node}
          edge="bottom"
          x={0}
          y={node.height - hitSize / 2}
          width={node.width}
          height={hitSize}
          cursorClassName="cursor-ns-resize"
          onResizePointerDown={onResizePointerDown}
        />
      ) : null}
    </>
  )
}


/** 노드 타입에 맞는 실제 SVG 본체 컴포넌트를 선택한다. */
function NodeBody({ node, selected }: { node: EditorNode; selected: boolean }) {
  if (node.type === 'terrain') {
    return <TerrainNode node={node} selected={selected} />
  }

  if (node.type === 'road') {
    return <RoadNode node={node} selected={selected} />
  }

  if (node.type === 'apartment') {
    return <ApartmentNode node={node} selected={selected} />
  }

  if (node.type === 'house') {
    return <HouseNode node={node} selected={selected} />
  }

  if (node.type === 'catchBasin') {
    return <CatchBasinNode node={node} selected={selected} />
  }

  if (node.type === 'manhole') {
    return <ManholeNode node={node} selected={selected} />
  }

  if (node.type === 'connector') {
    return <ConnectorNode node={node} selected={selected} />
  }

  if (node.type === 'elbowConnector') {
    return <ElbowConnectorNode node={node} selected={selected} />
  }

  if (node.type === 'teeConnector') {
    return <TeeConnectorNode node={node} selected={selected} />
  }

  if (node.type === 'pipeSegment') {
    return <PipeSegmentNode node={node} selected={selected} />
  }

  return <FacilityNode node={node} selected={selected} />
}

/** 공통 노드 프레임과 선택 테두리를 렌더링한다. */
function NodeFrame({
  node,
  selected,
  fill,
  stroke = '#334155',
  children,
}: {
  node: EditorNode
  selected: boolean
  fill: string
  stroke?: string
  children?: React.ReactNode
}) {
  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="8"
        fill={fill}
        stroke={selected ? '#f97316' : stroke}
        strokeWidth={selected ? 5 : 3}
      />
      {children}
      <text
        x={node.width / 2}
        y={node.height / 2 + 6}
        textAnchor="middle"
        className="select-none text-[18px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="5"
      >
        {node.name}
      </text>
    </>
  )
}

/** 아파트 시설 노드를 렌더링한다. */
function ApartmentNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  return (
    <NodeFrame node={node} selected={selected} fill="#d9ecfb">
      {Array.from({ length: 9 }, (_, index) => {
        const col = index % 3
        const row = Math.floor(index / 3)
        return (
          <rect
            key={index}
            x={28 + col * 40}
            y={28 + row * 38}
            width="22"
            height="24"
            fill="#fff8dc"
            stroke="#60a5fa"
            strokeWidth="2"
          />
        )
      })}
      <rect x={node.width / 2 - 14} y={node.height - 34} width="28" height="34" fill="#9a6a34" />
    </NodeFrame>
  )
}

/** 주거지 시설 노드를 렌더링한다. */
function HouseNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const stroke = selected ? '#f97316' : '#334155'
  const bodyX = 6
  const bodyY = 18
  const bodyWidth = node.width - bodyX * 2
  const bodyHeight = node.height - bodyY
  const roofBaseY = bodyY
  const roofPeakY = -36
  const windowY = bodyY + 28
  const labelY = bodyY + 66

  return (
    <>
      <path
        d={`M${node.width / 2} ${roofPeakY} L${node.width - 12} ${roofBaseY} H12 Z`}
        fill="#f97316"
        stroke={stroke}
        strokeWidth={selected ? 4 : 3}
        strokeLinejoin="round"
      />
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        rx="8"
        fill="#fff3d6"
        stroke={stroke}
        strokeWidth={selected ? 4 : 3}
      />
      <rect
        x={bodyX + 10}
        y={roofBaseY - 5}
        width={bodyWidth - 20}
        height="8"
        rx="4"
        fill="#9a3412"
      />
      <rect x="26" y={windowY} width="23" height="25" fill="#d9ecfb" stroke="#60a5fa" strokeWidth="2" />
      <rect x={node.width - 49} y={windowY} width="23" height="25" fill="#d9ecfb" stroke="#60a5fa" strokeWidth="2" />
      <rect
        x={node.width / 2 - 15}
        y={node.height - 40}
        width="30"
        height="40"
        fill="#9a6a34"
        stroke="#6b4423"
        strokeWidth="2"
      />
      <text
        x={node.width / 2}
        y={labelY}
        textAnchor="middle"
        className="select-none text-[15px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="3"
      >
        {node.name}
      </text>
    </>
  )
}

/** 빗물받이 노드를 렌더링한다. */
function CatchBasinNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  return (
    <>
      <rect
        x="10"
        y="-16"
        width={node.width - 20}
        height="26"
        rx="3"
        fill="#475569"
        stroke={selected ? '#f97316' : '#1e293b'}
        strokeWidth="3"
      />
      {Array.from({ length: 6 }, (_, index) => (
        <line
          key={index}
          x1={28 + index * 22}
          y1="-15"
          x2={28 + index * 22}
          y2="10"
          stroke="#cbd5e1"
          strokeWidth="4"
        />
      ))}
      <NodeFrame node={node} selected={selected} fill="#111827" stroke="#020617">
        <line x1="34" y1="34" x2={node.width - 34} y2="34" stroke="#334155" strokeWidth="3" />
        <line x1="34" y1={node.height - 34} x2={node.width - 34} y2={node.height - 34} stroke="#334155" strokeWidth="3" />
      </NodeFrame>
    </>
  )
}

/** 맨홀 노드를 렌더링한다. */
function ManholeNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const definition = getNodeManholeDefinition(node)
  const palette = getPipePalette(definition.waterKind)
  const lidDiameter = Math.min(node.width * 0.9, 84)
  const lidX = node.width / 2
  const lidY = 0

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="10"
        fill={definition.fill}
        stroke={selected ? '#f97316' : definition.stroke}
        strokeWidth={selected ? 5 : 4}
      />
      <rect
        x="10"
        y={node.height * 0.48}
        width={node.width - 20}
        height={node.height * 0.42}
        fill={palette.water}
      />
      <path
        d={`M10 ${node.height * 0.48} C22 ${node.height * 0.42} 34 ${node.height * 0.54} 46 ${
          node.height * 0.48
        } S70 ${node.height * 0.42} ${node.width - 10} ${node.height * 0.48}`}
        fill="none"
        stroke="rgba(255,255,255,.75)"
        strokeWidth="8"
      />
      <circle cx={lidX} cy={lidY} r={lidDiameter / 2} fill={palette.fill} stroke={definition.stroke} strokeWidth="7" />
      <circle cx={lidX} cy={lidY} r={lidDiameter / 2 - 14} fill={palette.stroke} stroke="#172554" strokeWidth="5" />
      {[-12, 0, 12].map((offset) => (
        <line
          key={offset}
          x1={lidX - 20}
          y1={lidY + offset}
          x2={lidX + 20}
          y2={lidY + offset}
          stroke="rgba(255,255,255,.68)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
      <text
        x={node.width / 2}
        y={node.height / 2}
        textAnchor="middle"
        className="select-none text-[20px] font-black"
        fill="#334155"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="5"
      >
        {node.name}
      </text>
    </>
  )
}

/** 땅/하천/바다 지형 세그먼트를 렌더링한다. */
function TerrainNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const definition = getNodeTerrainDefinition(node)
  const columns = Math.ceil(node.width / 260)
  const rows = Math.ceil(node.height / 44)
  const showLabel = node.width >= 160 && node.height >= 100

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        fill={definition.fill}
        stroke={selected ? '#f97316' : definition.stroke}
        strokeWidth={selected ? 5 : 3}
      />
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        const start = column * 260
        const baseY = 22 + row * 44

        return (
          <path
            key={index}
            d={`M${start} ${baseY} C${start + 36} ${baseY - 14} ${
              start + 76
            } ${baseY + 14} ${start + 116} ${baseY} S${
              start + 204
            } ${baseY - 14} ${start + 260} ${baseY}`}
            fill="none"
            stroke={definition.waveStroke}
            strokeWidth="3"
          />
        )
      })}
      {showLabel ? (
        <text
          x={node.width / 2}
          y={node.height / 2 + 6}
          textAnchor="middle"
          className="select-none text-[18px] font-black"
          fill="#0f172a"
          paintOrder="stroke"
          stroke="white"
          strokeWidth="5"
        >
          {node.name}
        </text>
      ) : null}
    </>
  )
}

/** 도로 노드를 렌더링한다. */
function RoadNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const dashCount = Math.max(3, Math.floor((node.width - 80) / ROAD_DASH_SPACING))
  const dashSpacing = node.width / (dashCount + 1)

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        fill="#111827"
        stroke={selected ? '#f97316' : '#253244'}
        strokeWidth={selected ? 5 : 4}
      />
      {[0.18, 0.5, 0.82].map((ratio) => (
        <line
          key={ratio}
          x1="32"
          y1={node.height * ratio}
          x2={node.width - 32}
          y2={node.height * ratio}
          stroke="#273548"
          strokeWidth="3"
        />
      ))}
      {Array.from({ length: dashCount }, (_, index) => (
        <line
          key={index}
          x1={(index + 1) * dashSpacing - 16}
          y1={node.height / 2}
          x2={(index + 1) * dashSpacing + 16}
          y2={node.height / 2}
          stroke="#facc15"
          strokeWidth="4"
          strokeLinecap="butt"
        />
      ))}
      <text
        x={node.width / 2}
        y={node.height / 2 + 8}
        textAnchor="middle"
        className="select-none text-[18px] font-black"
        fill="#f8fafc"
        paintOrder="stroke"
        stroke="#0f172a"
        strokeWidth="5"
      >
        {node.name}
      </text>
    </>
  )
}

/** 일반 커넥터 노드를 렌더링한다. */
function ConnectorNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const isHorizontal = node.width >= node.height
  const stripeIndexes = [0, 1, 2]
  const palette = getPipePalette(node.props.pipeKind)

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="0"
        fill={palette.fill}
        stroke={selected ? '#f97316' : palette.stroke}
        strokeWidth={selected ? 5 : 4}
      />
      {stripeIndexes.map((index) => {
        const ratio = (index + 1) / 4
        if (isHorizontal) {
          const x = node.width * ratio
          return (
            <line
              key={index}
              x1={x}
              y1={8}
              x2={x}
              y2={node.height - 8}
              stroke="#f8fafc"
              strokeWidth="5"
              strokeLinecap="butt"
            />
          )
        }

        const y = node.height * ratio
        return (
          <line
            key={index}
            x1={8}
            y1={y}
            x2={node.width - 8}
            y2={y}
            stroke="#f8fafc"
            strokeWidth="5"
            strokeLinecap="butt"
          />
        )
      })}
      <text
        x={node.width / 2}
        y={node.height + 18}
        textAnchor="middle"
        className="select-none text-[12px] font-black"
        fill="#334155"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="4"
      >
        {node.name}
      </text>
    </>
  )
}

/** ㄱ자 커넥터 노드를 렌더링한다. */
function ElbowConnectorNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const palette = getPipePalette(node.props.pipeKind)
  const {
    pipeSize,
    outerStroke,
    capHorizontal,
    capVertical,
    startY,
    endX,
    pathData,
    rotation,
  } = getElbowConnectorGeometry(node)
  const rotationTransform = rotation ? `rotate(${rotation} ${node.width / 2} ${node.height / 2})` : undefined

  return (
    <>
      <g transform={rotationTransform}>
        <path
          d={pathData}
          fill="none"
          stroke={selected ? '#f97316' : palette.stroke}
          strokeWidth={outerStroke}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={pathData}
          fill="none"
          stroke={palette.fill}
          strokeWidth={pipeSize}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <ConnectorCap
          x={0}
          y={startY - capVertical.height / 2}
          width={capVertical.width}
          height={capVertical.height}
          selected={selected}
          orientation="vertical"
          palette={palette}
        />
        <ConnectorCap
          x={endX - capHorizontal.width / 2}
          y={node.height - capHorizontal.height}
          width={capHorizontal.width}
          height={capHorizontal.height}
          selected={selected}
          orientation="horizontal"
          palette={palette}
        />
      </g>
      <text
        x={node.width / 2}
        y={node.height + 18}
        textAnchor="middle"
        className="select-none text-[12px] font-black"
        fill="#334155"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="4"
      >
        {node.name}
      </text>
    </>
  )
}

/** T자 커넥터 노드를 렌더링한다. */
function TeeConnectorNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const palette = getPipePalette(node.props.pipeKind)
  const {
    pipeSize,
    outerStroke,
    capHorizontal,
    capVertical,
    centerX,
    junctionY,
    horizontalPathData,
    verticalPathData,
    rotation,
  } = getTeeConnectorGeometry(node)
  const rotationTransform = rotation ? `rotate(${rotation} ${node.width / 2} ${node.height / 2})` : undefined

  return (
    <>
      <g transform={rotationTransform}>
        <path
          d={horizontalPathData}
          fill="none"
          stroke={selected ? '#f97316' : palette.stroke}
          strokeWidth={outerStroke}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={verticalPathData}
          fill="none"
          stroke={selected ? '#f97316' : palette.stroke}
          strokeWidth={outerStroke}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={horizontalPathData}
          fill="none"
          stroke={palette.fill}
          strokeWidth={pipeSize}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d={verticalPathData}
          fill="none"
          stroke={palette.fill}
          strokeWidth={pipeSize}
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <ConnectorCap
          x={0}
          y={junctionY - capVertical.height / 2}
          width={capVertical.width}
          height={capVertical.height}
          selected={selected}
          orientation="vertical"
          palette={palette}
        />
        <ConnectorCap
          x={node.width - capVertical.width}
          y={junctionY - capVertical.height / 2}
          width={capVertical.width}
          height={capVertical.height}
          selected={selected}
          orientation="vertical"
          palette={palette}
        />
        <ConnectorCap
          x={centerX - capHorizontal.width / 2}
          y={0}
          width={capHorizontal.width}
          height={capHorizontal.height}
          selected={selected}
          orientation="horizontal"
          palette={palette}
        />
      </g>
      <text
        x={node.width / 2}
        y={node.height + 18}
        textAnchor="middle"
        className="select-none text-[12px] font-black"
        fill="#334155"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="4"
      >
        {node.name}
      </text>
    </>
  )
}

/** 파이프 끝의 커넥터 캡 모양을 렌더링한다. */
function ConnectorCap({
  x,
  y,
  width,
  height,
  selected,
  orientation,
  palette = PIPE_COLORS.default,
}: {
  x: number
  y: number
  width: number
  height: number
  selected: boolean
  orientation: 'horizontal' | 'vertical'
  palette?: { fill: string; stroke: string }
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="0"
        fill={palette.fill}
        stroke={selected ? '#f97316' : palette.stroke}
        strokeWidth={selected ? 5 : 4}
      />
      {[1, 2, 3].map((index) => {
        const ratio = index / 4

        if (orientation === 'horizontal') {
          const lineX = x + width * ratio
          return (
            <line
              key={index}
              x1={lineX}
              y1={y + 6}
              x2={lineX}
              y2={y + height - 6}
              stroke="#f8fafc"
              strokeWidth="4"
              strokeLinecap="butt"
            />
          )
        }

        const lineY = y + height * ratio
        return (
          <line
            key={index}
            x1={x + 6}
            y1={lineY}
            x2={x + width - 6}
            y2={lineY}
            stroke="#f8fafc"
            strokeWidth="4"
            strokeLinecap="butt"
          />
        )
      })}
    </>
  )
}

/** 파이프 내부 흐름 방향 화살표를 렌더링한다. */
function PipeFlowArrows({ node, palette }: { node: EditorNode; palette: ReturnType<typeof getPipePalette> }) {
  const size = getNodePipeSize(node)
  const innerInset = PIPE_BORDER[size]
  const orientation = getNodeOrientation(node)
  const rotation = getPipeSegmentRotation(node)
  const axisLength = orientation === 'horizontal' ? node.width : node.height
  const usableLength = Math.max(0, axisLength - innerInset * 2 - PIPE_FLOW_ARROW_EDGE_PADDING * 2)
  const arrowCount = Math.round(clampNumber(
    Math.floor(usableLength / PIPE_FLOW_ARROW_SPACING) + 1,
    1,
    PIPE_FLOW_ARROW_MAX_COUNT,
  ))
  const strokeWidth = size === 'small' ? 3.25 : size === 'medium' ? 4 : 4.75

  return (
    <g pointerEvents="none" opacity="0.9">
      {Array.from({ length: arrowCount }, (_, index) => {
        const ratio = (index + 1) / (arrowCount + 1)
        const offset = innerInset + PIPE_FLOW_ARROW_EDGE_PADDING + usableLength * ratio
        const x = orientation === 'horizontal' ? offset : node.width / 2
        const y = orientation === 'horizontal' ? node.height / 2 : offset

        return (
          <path
            key={`pipe-flow-arrow-${index}`}
            d="M-11 -8 L0 0 L-11 8"
            transform={`translate(${x} ${y}) rotate(${rotation})`}
            fill="none"
            stroke={palette.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
    </g>
  )
}

function getPipeLabelWidth(name: string) {
  return clampNumber(name.length * 15 + 28, 72, 260)
}

function PipeNameLabel({ node, selected }: { node: EditorNode; selected: boolean }) {
  const orientation = getNodeOrientation(node)
  const labelWidth = getPipeLabelWidth(node.name)
  const labelHeight = 28
  const labelX = orientation === 'horizontal'
    ? node.width / 2 - labelWidth / 2
    : node.width + 12
  const labelY = orientation === 'horizontal'
    ? -labelHeight - 8
    : node.height / 2 - labelHeight / 2

  return (
    <g pointerEvents="none" transform={`translate(${labelX} ${labelY})`}>
      <rect
        x="0"
        y="0"
        width={labelWidth}
        height={labelHeight}
        rx="6"
        fill="rgba(255,255,255,.92)"
        stroke={selected ? '#ef4444' : 'rgba(15,23,42,.18)'}
        strokeWidth={selected ? 3 : 1.5}
      />
      <text
        x={labelWidth / 2}
        y="19"
        textAnchor="middle"
        className="select-none text-[16px] font-black"
        fill="#0f172a"
      >
        {node.name}
      </text>
    </g>
  )
}

/** 파이프 세그먼트 본체와 흐름 표시를 렌더링한다. */
function PipeSegmentNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const size = getNodePipeSize(node)
  const palette = getPipePalette(node.props.pipeKind)
  const innerInset = PIPE_BORDER[size]

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="0"
        fill={palette.fill}
        stroke={selected ? '#f97316' : palette.stroke}
        strokeWidth={selected ? 5 : PIPE_BORDER[size]}
      />
      <rect
        x={innerInset}
        y={innerInset}
        width={Math.max(0, node.width - innerInset * 2)}
        height={Math.max(0, node.height - innerInset * 2)}
        fill={palette.water}
        opacity="0.24"
      />
      <PipeFlowArrows node={node} palette={palette} />
      <PipeNameLabel node={node} selected={selected} />
    </>
  )
}

/** 시설 노드 type을 세부 시설 렌더러로 분기한다. */
function FacilityNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  if (node.type === 'outfall') {
    return <OutfallNode node={node} selected={selected} />
  }

  const definition = getNodeFacilityDefinition(node)
  const stroke = selected ? '#f97316' : definition.stroke

  if (definition.id === 'overflowChamber') {
    return <OverflowChamberNode node={node} selected={selected} definition={definition} />
  }

  if (definition.id === 'stormPumpStation') {
    return <StormPumpStationNode node={node} selected={selected} definition={definition} />
  }

  if (definition.id === 'waterReclamationCenter') {
    return <WaterReclamationNode node={node} selected={selected} definition={definition} />
  }

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      <circle cx={node.width / 2} cy={node.height / 2 + 10} r="28" fill="#f8fafc" stroke={stroke} strokeWidth="6" />
      <path
        d={`M${node.width / 2 - 16} ${node.height / 2 - 6} L${node.width / 2 + 16} ${node.height / 2 + 26}`}
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={`M${node.width / 2 + 16} ${node.height / 2 - 6} L${node.width / 2 - 16} ${node.height / 2 + 26}`}
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </FacilityShell>
  )
}

/** 시설류 공통 외곽과 라벨을 렌더링한다. */
function FacilityShell({
  node,
  selected,
  fill,
  stroke,
  children,
}: {
  node: EditorNode
  selected: boolean
  fill: string
  stroke: string
  children: React.ReactNode
}) {
  const activeStroke = selected ? '#f97316' : stroke

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="14"
        fill={fill}
        stroke={activeStroke}
        strokeWidth={selected ? 5 : 4}
      />
      <rect
        x="8"
        y="8"
        width={Math.max(0, node.width - 16)}
        height={Math.max(0, node.height - 16)}
        rx="10"
        fill="rgba(255,255,255,.28)"
      />
      {children}
      <text
        x={node.width / 2}
        y="34"
        textAnchor="middle"
        className="select-none text-[17px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="5"
      >
        {node.name}
      </text>
    </>
  )
}

/** 월류/우수토실 시설을 렌더링한다. */
function OverflowChamberNode({
  node,
  selected,
  definition,
}: {
  node: EditorNode
  selected: boolean
  definition: typeof FACILITY_KIND_DEFINITIONS[number]
}) {
  const stroke = selected ? '#f97316' : definition.stroke
  const innerX = 22
  const innerY = 44
  const innerWidth = Math.max(0, node.width - innerX * 2)
  const innerHeight = Math.max(0, node.height - innerY - 16)
  const grateWidth = Math.max(120, node.width - 72)
  const gateStartX = node.width * 0.44
  const gateEndX = node.width * 0.66

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      <rect x="36" y="12" width={grateWidth} height="18" rx="3" fill="#687383" stroke={stroke} strokeWidth="2.5" />
      {Array.from({ length: 10 }, (_, index) => (
        <line
          key={index}
          x1={48 + index * (grateWidth - 24) / 9}
          y1="13"
          x2={48 + index * (grateWidth - 24) / 9}
          y2="29"
          stroke="#cbd5e1"
          strokeWidth="3"
        />
      ))}
      <rect
        x={innerX}
        y={innerY}
        width={innerWidth}
        height={innerHeight}
        rx="7"
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth="3"
      />
      <path
        d={`M${gateStartX} ${innerY + innerHeight} L${gateEndX} ${innerY + 18} H${gateEndX + 24} L${gateStartX + 24} ${innerY + innerHeight} Z`}
        fill="#9ca3af"
        stroke={stroke}
        strokeWidth="4"
      />
      <text
        x={innerX + 64}
        y={innerY + innerHeight - 20}
        textAnchor="middle"
        className="select-none text-[11px] font-black"
        fill="#334155"
      >
        일반 유량
      </text>
      <text
        x={node.width - 74}
        y={innerY + innerHeight - 42}
        textAnchor="middle"
        className="select-none text-[11px] font-black"
        fill="#334155"
      >
        폭우 초과분
      </text>
    </FacilityShell>
  )
}

/** 빗물펌프장 시설을 렌더링한다. */
function StormPumpStationNode({
  node,
  selected,
  definition,
}: {
  node: EditorNode
  selected: boolean
  definition: typeof FACILITY_KIND_DEFINITIONS[number]
}) {
  const stroke = selected ? '#f97316' : definition.stroke
  const centerX = node.width / 2
  const centerY = node.height * 0.62

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      <rect x="28" y={centerY - 20} width={node.width * 0.26} height="40" rx="10" fill="#f8fbff" stroke="#8cc7ff" strokeWidth="3" />
      <rect
        x={node.width - node.width * 0.26 - 28}
        y={centerY - 20}
        width={node.width * 0.26}
        height="40"
        rx="20"
        fill="#f8fbff"
        stroke="#8cc7ff"
        strokeWidth="3"
      />
      <path
        d={`M${node.width * 0.28} ${centerY} H${centerX - 42} M${centerX + 42} ${centerY} H${node.width * 0.72}`}
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx={centerX} cy={centerY} r="34" fill="#bfdbfe" stroke={stroke} strokeWidth="6" />
      <circle cx={centerX} cy={centerY} r="14" fill="#1d4ed8" />
      <path
        d={`M${centerX} ${centerY} L${centerX + 25} ${centerY - 12} M${centerX} ${centerY} L${centerX + 17} ${centerY + 22} M${centerX} ${centerY} L${centerX - 25} ${centerY + 12} M${centerX} ${centerY} L${centerX - 17} ${centerY - 22}`}
        stroke="#e9f5ff"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </FacilityShell>
  )
}

/** 물재생센터 시설을 렌더링한다. */
function WaterReclamationNode({
  node,
  selected,
  definition,
}: {
  node: EditorNode
  selected: boolean
  definition: typeof FACILITY_KIND_DEFINITIONS[number]
}) {
  const stroke = selected ? '#f97316' : definition.stroke
  const moduleWidth = Math.max(42, node.width * 0.16)
  const gap = Math.max(10, node.width * 0.035)
  const totalWidth = moduleWidth * 4 + gap * 3
  const startX = (node.width - totalWidth) / 2
  const moduleY = node.height * 0.58

  return (
    <FacilityShell node={node} selected={selected} fill={definition.fill} stroke={definition.stroke}>
      {Array.from({ length: 4 }, (_, index) => (
        <rect
          key={index}
          x={startX + index * (moduleWidth + gap)}
          y={moduleY}
          width={moduleWidth}
          height="34"
          rx="7"
          fill="#f8fff9"
          stroke="#80d99b"
          strokeWidth="3"
        />
      ))}
      {[0, 1, 2].map((index) => (
        <line
          key={index}
          x1={startX + moduleWidth + index * (moduleWidth + gap)}
          y1={moduleY + 17}
          x2={startX + moduleWidth + gap + index * (moduleWidth + gap)}
          y2={moduleY + 17}
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
        />
      ))}
    </FacilityShell>
  )
}

/** 방류구 노드를 렌더링한다. */
function OutfallNode({ node, selected }: { node: EditorNode; selected: boolean }) {
  const definition = getNodeOutfallDefinition(node)
  const stroke = selected ? '#f97316' : definition.stroke
  const grilleWidth = Math.min(70, node.width * 0.34)
  const grilleX = node.width - grilleWidth - 14
  const labelX = Math.max(58, grilleX / 2)
  const labelParts = definition.nodeName.split(' ')

  return (
    <>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx="18"
        fill={definition.fill}
        stroke={stroke}
        strokeWidth={selected ? 5 : 4}
      />
      <rect
        x={grilleX}
        y={node.height * 0.16}
        width={grilleWidth}
        height={node.height * 0.68}
        rx="10"
        fill="#d6dce2"
        stroke="#6b7280"
        strokeWidth="4"
      />
      {[0.34, 0.5, 0.66].map((ratio) => (
        <line
          key={ratio}
          x1={grilleX + 14}
          y1={node.height * ratio}
          x2={grilleX + grilleWidth - 14}
          y2={node.height * ratio}
          stroke="#6b7280"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
      <text
        x={labelX}
        y={node.height / 2 - (labelParts.length > 1 ? 8 : -6)}
        textAnchor="middle"
        className="select-none text-[17px] font-black"
        fill="#0f172a"
        paintOrder="stroke"
        stroke="white"
        strokeWidth="5"
      >
        {labelParts[0]}
      </text>
      {labelParts.length > 1 ? (
        <text
          x={labelX}
          y={node.height / 2 + 20}
          textAnchor="middle"
          className="select-none text-[17px] font-black"
          fill="#0f172a"
          paintOrder="stroke"
          stroke="white"
          strokeWidth="5"
        >
          {labelParts.slice(1).join(' ')}
        </text>
      ) : null}
    </>
  )
}


// ---------------------------------------------------------------------------
// 오른쪽 패널과 입력 필드 컴포넌트
// ---------------------------------------------------------------------------
/** 오른쪽 패널의 요약 숫자 카드를 렌더링한다. */
function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="editor-summary-card rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
    </div>
  )
}

/** 선택된 노드/링크의 편집 입력 UI를 렌더링한다. */
function SelectionPanel({
  node,
  link,
  connectedLinks,
  groundSurfaceY,
  onUpdateNode,
  onRotateNode,
  onUpdateLink,
  onUpdateLinkProps,
  onDeleteSelection,
}: {
  node: EditorNode | null
  link: EditorLink | null
  connectedLinks: EditorLink[]
  groundSurfaceY: number
  onUpdateNode: (nodeId: string, updates: Partial<EditorNode>) => void
  onRotateNode: (nodeId: string) => void
  onUpdateLink: (linkId: string, updates: Partial<Omit<EditorLink, 'props'>>) => void
  onUpdateLinkProps: (linkId: string, updates: Partial<EditorLink['props']>) => void
  onDeleteSelection: () => void
}) {
  if (node) {
    const isSurfaceNode = SURFACE_NODE_TYPES.has(node.type)
    const fixedY = FIXED_NODE_Y_BY_TYPE[node.type]
    const isYLocked = isSurfaceNode || fixedY !== undefined
    const isPositionLockedPipe = node.type === 'pipeSegment' && connectedLinks.length > 0
    const hasPipeSize = (
      node.type === 'pipeSegment' ||
      node.type === 'connector' ||
      node.type === 'elbowConnector' ||
      node.type === 'teeConnector'
    )
    const hasPipeKind = hasPipeSize
    const hasFacilityType = FACILITY_TYPE_OPTIONS.includes(node.type)
    const hasFacilityKind = node.type === 'facility'
    const hasOutfallKind = node.type === 'outfall'
	    const hasManholeKind = node.type === 'manhole'
	    const hasTerrainKind = node.type === 'terrain'
	    const hasConnectorType = CONNECTOR_TYPE_OPTIONS.includes(node.type)
	    const hasNodeBlockageControl = (
	      node.type === 'pipeSegment' ||
	      node.type === 'facility' ||
	      node.type === 'manhole' ||
	      node.type === 'catchBasin' ||
	      node.type === 'outfall'
	    )
	    const pipeKind = hasPipeKind ? getNodePipeKind(node) : DEFAULT_PIPE_KIND
    const minNodeWidth = node.type === 'road'
      ? MIN_ROAD_WIDTH
      : node.type === 'terrain'
        ? MIN_TERRAIN_WIDTH
        : 20
    const minNodeHeight = node.type === 'manhole'
      ? MIN_MANHOLE_HEIGHT
      : node.type === 'terrain'
        ? MIN_TERRAIN_HEIGHT
        : 20
    const handleNodeTypeChange = (nextType: EditorNodeType) => {
      const updates = resizeNodeForType(node, nextType)
      const nextNode = snapNodeToGround(
        normalizeNodePorts({
          ...node,
          ...updates,
        }),
        groundSurfaceY,
      )

      onUpdateNode(node.id, nextNode)
    }

    return (
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">선택 객체</h3>
          <button
            type="button"
            onClick={onDeleteSelection}
            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-white"
          >
            삭제
          </button>
        </div>

        <TextField
          label="화면 이름"
          value={node.name}
          onChange={(value) => onUpdateNode(node.id, { name: value })}
        />
        <TextField
          label="SWMM ID"
          value={node.swmmId}
          onChange={(value) => onUpdateNode(node.id, { swmmId: value })}
        />
        <Definition label="id" value={node.id} />
        <Definition label="type" value={node.type} />
        {hasFacilityType && (
          <SelectField
            label="객체 종류"
            value={node.type}
            options={FACILITY_TYPE_OPTIONS}
            optionLabels={NODE_LABELS}
            onChange={handleNodeTypeChange}
          />
        )}
        {hasFacilityKind && (
          <SelectField
            label="시설 세부 종류"
            value={getNodeFacilityKind(node)}
            options={FACILITY_KIND_OPTIONS}
            optionLabels={FACILITY_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForFacilityKind(node, value))}
          />
        )}
        {hasOutfallKind && (
          <SelectField
            label="방류구 종류"
            value={getNodeOutfallKind(node)}
            options={OUTFALL_KIND_OPTIONS}
            optionLabels={OUTFALL_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForOutfallKind(node, value))}
          />
        )}
        {hasManholeKind && (
          <SelectField
            label="맨홀 종류"
            value={getNodeManholeKind(node)}
            options={MANHOLE_KIND_OPTIONS}
            optionLabels={MANHOLE_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForManholeKind(node, value))}
          />
        )}
        {hasTerrainKind && (
          <SelectField
            label="레이아웃 종류"
            value={getNodeTerrainKind(node)}
            options={TERRAIN_KIND_OPTIONS}
            optionLabels={TERRAIN_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForTerrainKind(node, value))}
          />
        )}
        {hasConnectorType && (
          <SelectField
            label="커넥터 종류"
            value={node.type}
            options={CONNECTOR_TYPE_OPTIONS}
            optionLabels={NODE_LABELS}
            disabled={connectedLinks.length > 0}
            onChange={handleNodeTypeChange}
          />
        )}
        {hasConnectorType && connectedLinks.length > 0 && (
          <p className="mt-2 rounded-md bg-orange-50 px-2 py-2 text-xs font-bold leading-5 text-orange-700">
            연결된 커넥터는 포트 구성이 바뀌지 않도록 종류 변경이 잠겨 있습니다. 먼저 연결을 끊은 뒤 변경하세요.
          </p>
        )}
        {hasPipeKind && (
          <>
            <SelectField
              label="관 종류"
              value={pipeKind}
              options={PIPE_KIND_OPTIONS}
              optionLabels={PIPE_KIND_LABELS}
              onChange={(value) => onUpdateNode(node.id, {
                props: {
                  ...node.props,
                  pipeKind: value,
                },
              })}
            />
          </>
        )}
	        {hasPipeSize && (
	          <SelectField
	            label="굵기"
	            value={getNodePipeSize(node)}
	            options={PIPE_SIZE_OPTIONS}
	            onChange={(value) => onUpdateNode(node.id, resizeNodeForPipeSize(node, value as EditorPipeSize))}
	          />
	        )}

	        {hasNodeBlockageControl && (
	          <div className="mt-3">
	            <NumberField
	              label="막힘 정도"
	              value={clampPercent(node.props.blockage)}
	              min={0}
	              max={100}
	              onChange={(value) => onUpdateNode(node.id, {
	                props: {
	                  ...node.props,
	                  blockage: Math.min(100, Math.max(0, value)),
	                },
	              })}
	            />
	          </div>
	        )}

	        {(
          node.type === 'pipeSegment' ||
          node.type === 'connector' ||
          node.type === 'elbowConnector' ||
          node.type === 'teeConnector'
        ) && (
          <button
            type="button"
            onClick={() => onRotateNode(node.id)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800"
            title="오른쪽으로 90도 회전"
            aria-label={`${NODE_LABELS[node.type]} 오른쪽 90도 회전`}
          >
            <RotateClockwiseIcon />
            오른쪽 90도 회전
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="x"
            value={node.x}
            disabled={isPositionLockedPipe}
            onChange={(value) => onUpdateNode(node.id, { x: value })}
          />
          <NumberField
            label="y"
            value={node.y}
            disabled={isYLocked || isPositionLockedPipe}
            onChange={(value) => onUpdateNode(node.id, { y: value })}
          />
          <NumberField
            label="가로"
            value={node.width}
            onChange={(value) => onUpdateNode(node.id, { width: Math.max(minNodeWidth, value) })}
          />
          <NumberField
            label="세로"
            value={node.height}
            min={minNodeHeight}
            disabled={node.type === 'road'}
            onChange={(value) => onUpdateNode(node.id, { height: Math.max(minNodeHeight, value) })}
          />
        </div>

        {fixedY !== undefined && (
          <p className="mt-2 rounded-md bg-blue-50 px-2 py-2 text-xs font-bold leading-5 text-blue-700">
            {node.type === 'catchBasin' ? '빗물받이' : '맨홀'}은 y={fixedY}px로 고정되고 x만 이동할 수 있습니다.
          </p>
        )}

        {isSurfaceNode && fixedY === undefined && (
          <p className="mt-2 rounded-md bg-blue-50 px-2 py-2 text-xs font-bold leading-5 text-blue-700">
            지상 고정 객체는 y={groundSurfaceY}px 지상선에 자동 스냅됩니다.
          </p>
        )}

        {isPositionLockedPipe && (
          <p className="mt-2 rounded-md bg-orange-50 px-2 py-2 text-xs font-bold leading-5 text-orange-700">
            관계에 연결된 파이프는 캔버스에서 그룹 단위로 이동합니다. 숫자 위치 편집은 잠겨 있고 길이는 가로/세로 값으로 조정하세요.
          </p>
        )}

        <Definition label="ports" value={node.ports.map((port) => port.id).join(', ')} />
        <div className="mt-3 text-xs font-black text-slate-400">연결 링크</div>
        <ul className="mt-2 space-y-1">
          {connectedLinks.length > 0 ? connectedLinks.map((connectedLink) => (
            <li key={connectedLink.id} className="rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
              {connectedLink.name}
            </li>
          )) : (
            <li className="text-xs font-semibold text-slate-400">아직 연결된 링크가 없습니다.</li>
          )}
        </ul>
      </div>
    )
  }

  if (link) {
    const hasPipeKind = link.type !== 'relation'
    const pipeKind = hasPipeKind ? getLinkPipeKind(link) : DEFAULT_PIPE_KIND

    return (
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">선택 링크</h3>
          <button
            type="button"
            onClick={onDeleteSelection}
            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-white"
          >
            삭제
          </button>
        </div>

        <TextField
          label="화면 이름"
          value={link.name}
          onChange={(value) => onUpdateLink(link.id, { name: value })}
        />
        <TextField
          label="SWMM ID"
          value={link.swmmId}
          onChange={(value) => onUpdateLink(link.id, { swmmId: value })}
        />
        <Definition label="id" value={link.id} />
        <SelectField
          label="링크 종류"
          value={link.type}
          options={LINK_TYPE_OPTIONS}
          onChange={(value) => onUpdateLink(link.id, { type: value as EditorLinkType })}
        />
        <SelectField
          label="관 크기"
          value={link.size}
          options={PIPE_SIZE_OPTIONS}
          onChange={(value) => onUpdateLink(link.id, { size: value as EditorPipeSize })}
        />
        {hasPipeKind && (
          <>
            <SelectField
              label="관 종류"
              value={pipeKind}
              options={PIPE_KIND_OPTIONS}
              optionLabels={PIPE_KIND_LABELS}
              onChange={(value) => onUpdateLinkProps(link.id, { pipeKind: value })}
            />
          </>
        )}
        <SelectField
          label="경로"
          value={link.props.route}
          options={LINK_ROUTE_OPTIONS}
          onChange={(value) => onUpdateLinkProps(link.id, { route: value as EditorLink['props']['route'] })}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="경사"
            value={link.props.slope}
            onChange={(value) => onUpdateLinkProps(link.id, { slope: value })}
          />
          <NumberField
            label="길이"
            value={link.props.length}
            onChange={(value) => onUpdateLinkProps(link.id, { length: value })}
          />
          <NumberField
            label="막힘 정도"
            value={link.props.blockage}
            min={0}
            max={100}
            onChange={(value) => onUpdateLinkProps(link.id, { blockage: Math.min(100, Math.max(0, value)) })}
          />
        </div>
        {link.type === 'relation' ? (
          <>
            <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="text-xs font-black text-blue-500">관계 방향</div>
              <div className="mt-1 text-sm font-black text-slate-800">
                부모에서 자식 방향으로 attach됩니다.
              </div>
            </div>
            <Definition label="부모(from)" value={`${link.from.nodeId} / ${link.from.portId}`} />
            <Definition label="자식(to)" value={`${link.to.nodeId} / ${link.to.portId}`} />
          </>
        ) : (
          <>
            <Definition label="from" value={`${link.from.nodeId} / ${link.from.portId}`} />
            <Definition label="to" value={`${link.to.nodeId} / ${link.to.portId}`} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
      객체나 링크를 선택하면 id, swmmId, type, 연결 상태가 여기에 표시됩니다.
    </div>
  )
}

/** 회전 버튼에 쓰는 시계 방향 아이콘을 렌더링한다. */
function RotateClockwiseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M19 7v5h-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.2 12A6.2 6.2 0 1 0 16 16.7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 문자열 입력 필드를 렌더링한다. */
function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
      />
    </label>
  )
}

/** 숫자 입력 필드를 렌더링한다. */
function NumberField({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: {
  label: string
  value: number | undefined
  min?: number
  max?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={formatNumberInput(value)}
        onChange={(event) => onChange(parseNumberInput(event.target.value, value ?? 0))}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
      />
    </label>
  )
}

/** 공통 select 입력 필드를 렌더링한다. */
function SelectField<T extends string>({
  label,
  value,
  options,
  optionLabels,
  disabled = false,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  optionLabels?: Partial<Record<string, string>>
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? (option in PIPE_SIZE_LABELS ? PIPE_SIZE_LABELS[option as EditorPipeSize] : option)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** 읽기 전용 label/value 행을 렌더링한다. */
function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-1 break-all text-sm font-bold text-slate-700">{value}</div>
    </div>
  )
}

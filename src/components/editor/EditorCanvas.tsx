import {
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
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
  CANVAS_BOTTOM_PADDING,
  CANVAS_RIGHT_PADDING,
  CONNECTOR_PORTS,
  DEFAULT_PIPE_KIND,
  ENABLE_ATTACH_ANCHOR_RESIZE_GUARD,
  ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE,
  ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE,
  ENABLE_PARENT_CHILD_PROPAGATION_RULE,
  ENABLE_REVERSE_PARENT_PROPAGATION_RULE,
  LOWER_SIDE_PORT_BOTTOM_GAP,
  MIN_MANHOLE_HEIGHT,
  MIN_PIPE_SEGMENT_LENGTH,
  MIN_ROAD_WIDTH,
  MIN_TERRAIN_HEIGHT,
  MIN_TERRAIN_WIDTH,
  PIPE_BORDER,
  PIPE_THICKNESS,
  SWMM_ENGINE_URL,
  TERRAIN_KIND_BY_ID,
  type LayoutAddKind,
} from './editorDefinitions'
import {
  clampNumber,
  getNodeCenter,
  getSvgCursor,
  normalizeRect,
} from './editorGeometry'
import { SoilBackground } from '../diagram/SoilBackground'
import { useLayoutIndexes } from '../diagram/useLayoutIndexes'
import { useRafCoalescedCallback } from '../diagram/useRafCoalescedCallback'
import { EditorActionToolbar } from './EditorActionToolbar'
import { LayoutAddHandles, PipeResizeHandles } from './EditorAffordances'
import { EditorContextMenu } from './EditorContextMenu'
import { EditorScenarioToolbar } from './EditorScenarioToolbar'
import { SelectionPanel, SummaryCard } from './EditorSelectionPanel'
import {
  endpointKey,
  getEndpointPoint,
  getEndpointPointWithCounterpart,
  getEndpointPort,
  getEndpointForNode,
  getOtherRelationEndpoint,
  getRelationAncestorNodeIds,
  getRelationIdForEndpointPair,
  getRelationLinkForPort,
  getRelationLinksForNode,
  getRelationSideNodeIds,
  normalizeRelationAttachments,
  shouldUseStraightRoute,
  wouldCreateRelationCycle,
} from './editorRelations'
import {
  isFixedYNode,
  hasFixedYNodeInNodeIds,
  getElbowConnectorRotation,
  getTeeConnectorRotation,
  getPipeSegmentRotation,
  rotateSideClockwise,
  getElbowConnectorPorts,
  getTeeConnectorPorts,
  getTeeBaseSideForPort,
  getNodePort,
  getPortPoint,
  getLowerSideAttachmentCounterpartHalfSpan,
  getHeightForLowerSideAttachmentOffset,
  getAttachedPortPoint,
  isEditorPipeSize,
  normalizePipeKind,
  normalizeFacilityKind,
  normalizeOutfallKind,
  normalizeManholeKind,
  normalizeTerrainKind,
  getNodeOrientation,
  getAttachCandidatePorts,
  normalizeNodeGeometryForPipePreset,
  normalizeNodePorts,
} from './editorNodeHelpers'
import { clearEditorLayout, isEditorLayout } from './layoutStorage'
import { EditableLink } from './EditorLinkRenderer'
import {
  createRenderedPortRelationLookup,
  getAttachResizableEdges,
  getManualResizableEdges,
  getNodeRenderablePorts,
  getRenderedPortPoint,
  getRenderedPortPointFromLookup,
  hasManualResizableEdge,
  type RenderedPortRelationLookup,
} from './editorNodeRenderData'
import {
  createRenderedNodes,
  reorderNodesByZOrder,
  type NodeZOrderAction,
} from './editorRenderOrder'
import { snapNodeToGround } from './editorNodePlacement'
import {
  createCopiedEditorSelection,
  getExpandedRelationGroupNodeIds,
  getMarqueeSelectedNodeIds,
  getOriginNodes,
  getRelationGroupNodeIds,
  getSelectionNodeIds,
  pasteCopiedEditorSelection,
} from './editorSelection'
import { useEditorLayoutState } from './useEditorLayoutState'
import { EditableNodeLayer } from './EditableNodeLayer'
import {
  createSwmmScenario,
  getSwmmScenarios,
  updateSwmmScenario,
  type SwmmScenario,
} from '../../services/swmm/client'
import { InlineInfoPanel } from '../layout/InfoPanelLayout'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import {
  type EditorEndpoint,
  type EditorLayout,
  type EditorLink,
  type EditorNode,
  type EditorNodeType,
  type EditorPort,
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
const EDITOR_ZOOM_STEP = 0.1
const EDITOR_ZOOM_DEFAULT = 0.5

// ---------------------------------------------------------------------------
// relation 포트/attach 좌표 계산 helper
// ---------------------------------------------------------------------------
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
/** 지정한 노드 그룹을 같은 delta만큼 이동하고 지상 고정 규칙을 다시 적용한다. */
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
function createDragDraftPositions(layout: EditorLayout, dragState: DragState, x: number, y: number): Map<string, Point> {
  const rootOrigin = dragState.originNodes[dragState.nodeId]
  if (!rootOrigin) {
    return new Map()
  }

  const dx = x - rootOrigin.x
  const dy = dragState.hasFixedYNode ? 0 : y - rootOrigin.y
  const draftPositions = new Map<string, Point>()

  layout.nodes.forEach((node) => {
    if (!dragState.groupNodeIdSet.has(node.id)) {
      return
    }

    const originNode = dragState.originNodes[node.id]
    if (!originNode) {
      return
    }

    const movedNode = {
      ...node,
      x: originNode.x + dx,
      y: originNode.y + dy,
    }
    const constrainedNode = dragState.hasFixedYNode ? movedNode : snapNodeToGround(movedNode, layout.groundSurfaceY)

    draftPositions.set(node.id, {
      x: constrainedNode.x,
      y: constrainedNode.y,
    })
  })

  return draftPositions
}

/** pointer up 시점에 드래그 preview 좌표를 실제 layout에 한 번만 반영한다. */
function applyDragDraftPositions(layout: EditorLayout, draftPositions: Map<string, Point>): EditorLayout {
  if (draftPositions.size === 0) {
    return layout
  }

  return {
    ...layout,
    nodes: layout.nodes.map((node) => {
      const draftPosition = draftPositions.get(node.id)
      return draftPosition
        ? {
            ...node,
            x: draftPosition.x,
            y: draftPosition.y,
          }
        : node
    }),
  }
}

/** draft 비교용으로 렌더링에 영향을 주는 노드 좌표/크기/포트/props가 같은지 확인한다. */
function haveSameNodeRenderState(first: EditorNode, second: EditorNode) {
  return (
    first === second ||
    (
      first.id === second.id &&
      first.x === second.x &&
      first.y === second.y &&
      first.width === second.width &&
      first.height === second.height &&
      JSON.stringify(first.ports) === JSON.stringify(second.ports) &&
      JSON.stringify(first.props) === JSON.stringify(second.props)
    )
  )
}

/** resize 중 화면 preview에 필요한 변경 노드만 Map으로 추려낸다. */
function createResizeDraftNodes(
  layout: EditorLayout,
  resizeState: ResizeState,
  cursor: Point,
): Map<string, EditorNode> {
  const resizedLayout = resizeLayoutFromState(layout, resizeState, cursor)
  const originalNodesById = new Map(layout.nodes.map((node) => [node.id, node]))
  const draftNodesById = new Map<string, EditorNode>()

  resizedLayout.nodes.forEach((node) => {
    const originalNode = originalNodesById.get(node.id)
    if (!originalNode || !haveSameNodeRenderState(originalNode, node)) {
      draftNodesById.set(node.id, node)
    }
  })

  return draftNodesById
}

/** pointer up 시점에 resize draft 노드들을 실제 layout에 한 번만 반영한다. */
function applyResizeDraftNodes(layout: EditorLayout, draftNodesById: Map<string, EditorNode>): EditorLayout {
  if (draftNodesById.size === 0) {
    return layout
  }

  return {
    ...layout,
    nodes: layout.nodes.map((node) => draftNodesById.get(node.id) ?? node),
  }
}

/** drag/resize draft 때문에 포트 relation lookup을 다시 계산해야 하는 노드 범위를 구한다. */
function getDraftAffectedNodeIds(
  dragDraftPositionsByNodeId: Map<string, Point> | null,
  resizeDraftNodesById: Map<string, EditorNode> | null,
  relationLinksByNodeId: Map<string, EditorLink[]>,
) {
  const affectedNodeIds = new Set<string>()

  const addNodeAndRelationCounterparts = (nodeId: string) => {
    affectedNodeIds.add(nodeId)
    relationLinksByNodeId.get(nodeId)?.forEach((relation) => {
      affectedNodeIds.add(relation.from.nodeId)
      affectedNodeIds.add(relation.to.nodeId)
    })
  }

  dragDraftPositionsByNodeId?.forEach((_position, nodeId) => {
    addNodeAndRelationCounterparts(nodeId)
  })
  resizeDraftNodesById?.forEach((_node, nodeId) => {
    addNodeAndRelationCounterparts(nodeId)
  })

  return affectedNodeIds
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
  childEdgeOverride?: ResizeEdge | null,
): { node: EditorNode; movedEdge: ResizeEdge } {
  const childEdge = childEdgeOverride === undefined
    ? getChildResizeEdgeForLengthChange(layout, originNode, requestedEdge)
    : childEdgeOverride
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
  const childResizeEdge = resizeState.childResizeEdge ?? null
  const childResizeResult = redirectLengthResizeTowardChildEdge(
    layout,
    originNode,
    resizeState.edge,
    requestedResizeNode,
    resizeState.anchorBounds,
    childResizeEdge,
  )
  if (childResizeEdge) {
    return childResizeResult
  }

  const isVertical = getNodeOrientation(originNode) === 'vertical'

  if (
    ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE &&
    isVertical &&
    resizeState.hasFixedYNode &&
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
// 키보드, 파일 다운로드 helper
// ---------------------------------------------------------------------------
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

/** 현재 layout을 서버에 전달해 SWMM INP 텍스트로 변환한 뒤 다운로드한다. */
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


/** 배수도 편집 화면의 상태 연결, 편집 이벤트, SVG 렌더 조립을 담당하는 최상위 컴포넌트다. */
export function EditorCanvas({
  theme = 'light',
  renderHeader,
}: {
  theme?: WorkbenchTheme
  renderHeader?: (controls: {
    isInfoPanelOpen: boolean
    toggleInfoPanel: () => void
  }) => ReactNode
}) {
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  // layout hook은 localStorage 저장, undo/redo history, batch 기록을 한곳에서 관리한다.
  const [layout, setLayout, layoutHistory] = useEditorLayoutState(normalizeEditorLayout)
  const {
    beginLayoutHistoryBatch,
    commitLayoutHistoryBatch,
    undoLayout,
    redoLayout,
    replaceLayout,
    canUndo,
    canRedo,
  } = layoutHistory

  // 선택/attach/좌표 변경/drag/resize는 동시에 겹치면 안 되는 사용자 인터랙션 상태다.
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [pendingPort, setPendingPort] = useState<EditorPortSelection | null>(null)
  const [attachTargetNodeId, setAttachTargetNodeId] = useState<string | null>(null)
  const [coordinateEditState, setCoordinateEditState] = useState<CoordinateEditState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dragDraftPositionsByNodeId, setDragDraftPositionsByNodeId] = useState<Map<string, Point> | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [resizeDraftNodesById, setResizeDraftNodesById] = useState<Map<string, EditorNode> | null>(null)
  const [marqueeSelectionState, setMarqueeSelectionState] = useState<MarqueeSelectionState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isExportingInp, setIsExportingInp] = useState(false)
  const [isEditorInfoPanelOpen, setIsEditorInfoPanelOpen] = useState(false)
  const [editorZoom, setEditorZoom] = useState(EDITOR_ZOOM_DEFAULT)
  const [editorCanvasFitWidth, setEditorCanvasFitWidth] = useState(0)
  const [scenarios, setScenarios] = useState<SwmmScenario[]>([])
  const [selectedScenario, setSelectedScenario] = useState<SwmmScenario | null>(null)
  const [scenarioEditBaseline, setScenarioEditBaseline] = useState<EditorLayout | null>(null)
  const [scenarioCancelBaseline, setScenarioCancelBaseline] = useState<EditorLayout | null>(null)
  const [isScenarioEditMode, setIsScenarioEditMode] = useState(false)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [scenarioDescription, setScenarioDescription] = useState('')
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false)
  const [isSavingScenario, setIsSavingScenario] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)

  // ref는 브라우저 파일 입력, SVG 좌표 변환, 좌표 변경 후속 클릭 억제를 위해 사용한다.
  const copiedSelectionRef = useRef<CopiedEditorSelection | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorCanvasViewportRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const suppressCoordinateEditFollowUpClickUntilRef = useRef(0)
  const nextNodeIndex = layout.nodes.length + 1
  const isScenarioReadOnly = Boolean(selectedScenario && !isScenarioEditMode)
  const { nodesById, linksById, relationLinksByNodeId } = useLayoutIndexes(layout)
  const renderNodesById = useMemo(() => {
    if (
      (!dragDraftPositionsByNodeId || dragDraftPositionsByNodeId.size === 0) &&
      (!resizeDraftNodesById || resizeDraftNodesById.size === 0)
    ) {
      return nodesById
    }

    const draftNodesById = new Map(nodesById)
    resizeDraftNodesById?.forEach((node, nodeId) => {
      draftNodesById.set(nodeId, node)
    })
    dragDraftPositionsByNodeId?.forEach((position, nodeId) => {
      const node = nodesById.get(nodeId)
      if (node) {
        draftNodesById.set(nodeId, {
          ...node,
          x: position.x,
          y: position.y,
        })
      }
    })

    return draftNodesById
  }, [dragDraftPositionsByNodeId, nodesById, resizeDraftNodesById])

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

  const resetEditorInteractionState = useCallback(() => {
    setSelection(null)
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
  }, [])

  const refreshScenarios = useCallback(async () => {
    setIsLoadingScenarios(true)
    setScenarioError(null)
    try {
      const nextScenarios = await getSwmmScenarios(SWMM_ENGINE_URL)
      setScenarios(nextScenarios)
      setSelectedScenario((currentScenario) => {
        if (!currentScenario) {
          return null
        }
        return nextScenarios.find((scenario) => scenario.id === currentScenario.id) ?? currentScenario
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setScenarioError(message)
    } finally {
      setIsLoadingScenarios(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refreshScenarios()
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [refreshScenarios])

  const selectScenario = useCallback((scenarioId: number) => {
    const scenario = scenarios.find((item) => item.id === scenarioId)
    if (!scenario) {
      return
    }

    if (!isEditorLayout(scenario.layoutJson)) {
      window.alert('선택한 시나리오의 배수도 JSON 구조가 올바르지 않습니다.')
      return
    }

    const normalizedLayout = normalizeEditorLayout(scenario.layoutJson)
    replaceLayout(normalizedLayout)
    setSelectedScenario(scenario)
    setScenarioEditBaseline(normalizedLayout)
    setScenarioCancelBaseline(null)
    setScenarioTitle(scenario.title)
    setScenarioDescription(scenario.description)
    setIsScenarioEditMode(false)
    resetEditorInteractionState()
  }, [replaceLayout, resetEditorInteractionState, scenarios])

  const handleScenarioSelect = (scenarioIdValue: string) => {
    const scenarioId = Number(scenarioIdValue)
    if (!scenarioId) {
      setSelectedScenario(null)
      setScenarioEditBaseline(null)
      setScenarioCancelBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
      setIsScenarioEditMode(false)
      resetEditorInteractionState()
      return
    }
    selectScenario(scenarioId)
  }

  const createNewScenario = () => {
    const nextLayout = normalizeEditorLayout(createDefaultEditorLayout())
    setScenarioCancelBaseline(normalizeEditorLayout(layout))
    replaceLayout(nextLayout)
    setSelectedScenario(null)
    setScenarioEditBaseline(nextLayout)
    setScenarioTitle('새 시나리오')
    setScenarioDescription('')
    setIsScenarioEditMode(true)
    resetEditorInteractionState()
  }

  const beginScenarioEdit = () => {
    if (!selectedScenario) {
      return
    }
    setScenarioEditBaseline(normalizeEditorLayout(selectedScenario.layoutJson))
    setScenarioCancelBaseline(null)
    setScenarioTitle(selectedScenario.title)
    setScenarioDescription(selectedScenario.description)
    setIsScenarioEditMode(true)
  }

  const resetScenarioChanges = () => {
    const baseline = scenarioEditBaseline
    if (!baseline) {
      return
    }
    replaceLayout(baseline)
    setScenarioTitle(selectedScenario?.title ?? '새 시나리오')
    setScenarioDescription(selectedScenario?.description ?? '')
    resetEditorInteractionState()
  }

  const cancelScenarioEdit = () => {
    if (selectedScenario) {
      const selectedLayout = normalizeEditorLayout(selectedScenario.layoutJson)
      replaceLayout(selectedLayout)
      setScenarioEditBaseline(selectedLayout)
      setScenarioTitle(selectedScenario.title)
      setScenarioDescription(selectedScenario.description)
    } else if (scenarioCancelBaseline) {
      replaceLayout(scenarioCancelBaseline)
      setScenarioEditBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
    } else {
      setScenarioEditBaseline(null)
      setScenarioTitle('')
      setScenarioDescription('')
    }

    setScenarioCancelBaseline(null)
    setIsScenarioEditMode(false)
    resetEditorInteractionState()
  }

  const saveScenario = async () => {
    if (isSavingScenario) {
      return
    }

    const title = scenarioTitle.trim()
    if (!title) {
      window.alert('시나리오 제목을 입력해주세요.')
      return
    }

    setIsSavingScenario(true)
    setScenarioError(null)
    try {
      const exportLayout = normalizeRelationAttachments(layout)
      const savedScenario = selectedScenario
        ? await updateSwmmScenario(SWMM_ENGINE_URL, selectedScenario.id, {
            title,
            description: scenarioDescription,
            layoutJson: exportLayout,
          })
        : await createSwmmScenario(SWMM_ENGINE_URL, {
            title,
            description: scenarioDescription,
            layoutJson: exportLayout,
          })

      setSelectedScenario(savedScenario)
      setScenarioEditBaseline(normalizeEditorLayout(savedScenario.layoutJson))
      setScenarioCancelBaseline(null)
      setScenarioTitle(savedScenario.title)
      setScenarioDescription(savedScenario.description)
      setIsScenarioEditMode(false)
      setScenarios((currentScenarios) => [
        savedScenario,
        ...currentScenarios.filter((scenario) => scenario.id !== savedScenario.id),
      ])
      await refreshScenarios()
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setScenarioError(message)
      window.alert(`시나리오 저장에 실패했습니다.\n\n${message}`)
    } finally {
      setIsSavingScenario(false)
    }
  }

  // 좌표 변경 완료 직후 port click이 한 번 더 들어오는 브라우저 이벤트 중복을 막는다.
  const suppressCoordinateEditFollowUpClick = useCallback(() => {
    suppressCoordinateEditFollowUpClickUntilRef.current = window.performance.now() + 500
  }, [])

  // 선택 상태에서 오른쪽 패널과 캔버스 렌더링이 공통으로 참조하는 파생 데이터를 계산한다.
  const selectedNode = useMemo(() => {
    if (selection?.kind !== 'node') {
      return null
    }

    return nodesById.get(selection.id) ?? null
  }, [nodesById, selection])

  const selectedLink = useMemo(() => {
    if (selection?.kind !== 'link') {
      return null
    }

    return linksById.get(selection.id) ?? null
  }, [linksById, selection])

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
  const renderedNodes = useMemo(() => createRenderedNodes(layout), [layout])
  const terrainNodes = useMemo(
    () => renderedNodes.filter((node) => node.type === 'terrain'),
    [renderedNodes],
  )
  const drawableNodes = useMemo(
    () => renderedNodes.filter((node) => node.type !== 'terrain'),
    [renderedNodes],
  )
  const baseRenderedPortRelationLookupByNodeId = useMemo(() => {
    const lookupByNodeId = new Map<string, RenderedPortRelationLookup>()

    renderedNodes.forEach((node) => {
      lookupByNodeId.set(
        node.id,
        createRenderedPortRelationLookup(
          node,
          relationLinksByNodeId.get(node.id) ?? [],
          nodesById,
        ),
      )
    })

    return lookupByNodeId
  }, [nodesById, relationLinksByNodeId, renderedNodes])
  const draftAffectedNodeIds = useMemo(
    () => getDraftAffectedNodeIds(
      dragDraftPositionsByNodeId,
      resizeDraftNodesById,
      relationLinksByNodeId,
    ),
    [dragDraftPositionsByNodeId, relationLinksByNodeId, resizeDraftNodesById],
  )
  const renderedPortRelationLookupByNodeId = useMemo(() => {
    if (draftAffectedNodeIds.size === 0) {
      return baseRenderedPortRelationLookupByNodeId
    }

    const lookupByNodeId = new Map(baseRenderedPortRelationLookupByNodeId)

    draftAffectedNodeIds.forEach((nodeId) => {
      const node = renderNodesById.get(nodeId)
      if (!node) {
        return
      }

      lookupByNodeId.set(
        nodeId,
        createRenderedPortRelationLookup(
          node,
          relationLinksByNodeId.get(nodeId) ?? [],
          renderNodesById,
        ),
      )
    })

    return lookupByNodeId
  }, [
    baseRenderedPortRelationLookupByNodeId,
    draftAffectedNodeIds,
    relationLinksByNodeId,
    renderNodesById,
  ])

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

    setLayout((currentLayout) => ({
      ...currentLayout,
      links: currentLayout.links.map((link) => (link.id === linkId ? { ...link, ...updates } : link)),
    }))
  }

  // link props는 relation/pipe link의 확장 메타데이터를 안전하게 병합한다.
  const updateLinkProps = (linkId: string, updates: Partial<EditorLink['props']>) => {
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
  }, [isScenarioReadOnly, selection, setLayout])

  // undo/redo나 pointer 종료 전에 임시 인터랙션 상태를 닫고 history batch를 확정한다.
  const clearTransientEditorState = useCallback(() => {
    setPendingPort(null)
    setAttachTargetNodeId(null)
    setCoordinateEditState(null)
    setContextMenu(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    commitLayoutHistoryBatch()
  }, [commitLayoutHistoryBatch])

  // undo/redo는 drag/resize/attach 같은 임시 상태를 먼저 정리한 뒤 layout history만 이동한다.
  const undoEditorLayout = useCallback(() => {
    if (isScenarioReadOnly) {
      return
    }
    clearTransientEditorState()
    undoLayout()
  }, [clearTransientEditorState, isScenarioReadOnly, undoLayout])

  const redoEditorLayout = useCallback(() => {
    if (isScenarioReadOnly) {
      return
    }
    clearTransientEditorState()
    redoLayout()
  }, [clearTransientEditorState, isScenarioReadOnly, redoLayout])

  const handleLinkSelect = useCallback((linkId: string) => {
    setSelection({ kind: 'link', id: linkId })
  }, [])

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
    if (isScenarioReadOnly) {
      return false
    }

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
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    setSelection(pastedNodeIds.length === 1
      ? { kind: 'node', id: pastedNodeIds[0] }
      : { kind: 'multi', ids: pastedNodeIds })
    return true
  }, [isScenarioReadOnly, layout, setLayout])

  // 전역 키보드 단축키는 입력 필드 편집 중에는 동작하지 않게 제한한다.
  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return
      }

      if (isScenarioReadOnly || isTextEditingTarget(event.target) || !selection) {
        return
      }

      event.preventDefault()
      deleteSelection()
    }

    window.addEventListener('keydown', handleDeleteKey)
    return () => window.removeEventListener('keydown', handleDeleteKey)
  }, [deleteSelection, isScenarioReadOnly, selection])

  // macOS Command와 Windows/Linux Ctrl을 모두 같은 undo/redo modifier로 취급한다.
  useEffect(() => {
    const handleHistoryKey = (event: KeyboardEvent) => {
      const isPrimaryModifier = event.metaKey || event.ctrlKey
      const isUndoRedoKey = event.key.toLowerCase() === 'z'
      if (isScenarioReadOnly || !isPrimaryModifier || !isUndoRedoKey || event.altKey || isTextEditingTarget(event.target)) {
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
  }, [isScenarioReadOnly, redoEditorLayout, undoEditorLayout])

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

    if (isScenarioReadOnly) {
      setContextMenu(null)
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
    if (isScenarioReadOnly) {
      setContextMenu(null)
      return
    }

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

    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: node.id })
      setContextMenu(null)
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
  }, [isScenarioReadOnly])

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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

  const processCanvasPointerMove = useCallback(({
    svg,
    clientX,
    clientY,
  }: {
    svg: SVGSVGElement
    clientX: number
    clientY: number
  }) => {
    if (isScenarioReadOnly) {
      return
    }

    const cursor = getSvgCursor(svg, clientX, clientY)

    if (coordinateEditState) {
      updateCoordinateEditFromClientPoint(clientX, clientY)
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

      setResizeDraftNodesById(createResizeDraftNodes(layout, resizeState, resizeCursor))
      return
    }

    if (!dragState) {
      return
    }

    setDragDraftPositionsByNodeId(
      createDragDraftPositions(layout, dragState, cursor.x - dragState.offsetX, cursor.y - dragState.offsetY),
    )
  }, [
    coordinateEditState,
    dragState,
    isScenarioReadOnly,
    layout,
    marqueeSelectionState,
    resizeState,
    updateCoordinateEditFromClientPoint,
  ])

  const {
    schedule: scheduleCanvasPointerMove,
    cancel: cancelCanvasPointerMove,
  } = useRafCoalescedCallback(processCanvasPointerMove)

  // pointer up/leave에서 좌표 변경, marquee, drag, resize batch를 확정한다.
  const finishPointerInteraction = useCallback(() => {
    cancelCanvasPointerMove()

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
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      commitLayoutHistoryBatch()
      return
    }

    if (dragState && dragDraftPositionsByNodeId) {
      setLayout((currentLayout) => applyDragDraftPositions(currentLayout, dragDraftPositionsByNodeId), {
        recordHistory: false,
      })
    }

    if (resizeState && resizeDraftNodesById) {
      setLayout((currentLayout) => applyResizeDraftNodes(currentLayout, resizeDraftNodesById), {
        recordHistory: false,
      })
    }

    setCoordinateEditState(null)
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeState(null)
    setResizeDraftNodesById(null)
    setMarqueeSelectionState(null)
    commitLayoutHistoryBatch()
  }, [
    cancelCanvasPointerMove,
    commitLayoutHistoryBatch,
    coordinateEditState,
    dragDraftPositionsByNodeId,
    dragState,
    layout,
    marqueeSelectionState,
    resizeDraftNodesById,
    resizeState,
    setLayout,
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
    if (isScenarioReadOnly || (!coordinateEditState && !marqueeSelectionState && !resizeState && !dragState)) {
      return
    }

    scheduleCanvasPointerMove({
      svg: event.currentTarget,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  // attach 모드의 두 번째 선택을 검증하고, snap 후 relation 링크 생성까지 마무리한다.
  const completePendingAttach = (nextPort: EditorPortSelection) => {
    if (isScenarioReadOnly) {
      return false
    }

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
    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: node.id })
      setContextMenu(null)
      return
    }

    const svg = event.currentTarget.ownerSVGElement
    if (!svg) {
      return
    }

    const cursor = getSvgCursor(svg, event.clientX, event.clientY)

    if (coordinateEditState) {
      suppressCoordinateEditFollowUpClick()
      updateCoordinateEditFromClientPoint(event.clientX, event.clientY)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
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
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
      return
    }

    beginLayoutHistoryBatch()
    setDragDraftPositionsByNodeId(null)
    setResizeDraftNodesById(null)

    const groupNodeIds = shouldDragCurrentMultiSelection
      ? selection.ids
      : getRelationGroupNodeIds(layout, node.id)
    const groupNodeIdSet = new Set(groupNodeIds)
    const originNodes = getOriginNodes(layout, groupNodeIds)
    const hasFixedYNode = layout.nodes.some((candidate) => groupNodeIdSet.has(candidate.id) && isFixedYNode(candidate))

    setDragState({
      nodeId: node.id,
      offsetX: cursor.x - node.x,
      offsetY: cursor.y - node.y,
      groupNodeIds,
      groupNodeIdSet,
      originNodes,
      hasFixedYNode,
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
    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: node.id })
      return
    }

    if (pendingPort) {
      setSelection({ kind: 'node', id: node.id })
      setAttachTargetNodeId(node.id)
      setDragState(null)
      setDragDraftPositionsByNodeId(null)
      setResizeState(null)
      setResizeDraftNodesById(null)
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
    const childResizeEdge = node.type === 'pipeSegment'
      ? getChildResizeEdgeForLengthChange(layout, node, edge)
      : null
    const groupNodeIds = node.type === 'pipeSegment' ? getRelationGroupNodeIds(layout, node.id) : [node.id]
    const groupNodeIdSet = new Set(groupNodeIds)
    const hasFixedYNode = layout.nodes.some((candidate) => groupNodeIdSet.has(candidate.id) && isFixedYNode(candidate))
    setSelection({ kind: 'node', id: node.id })
    setDragState(null)
    setDragDraftPositionsByNodeId(null)
    setResizeDraftNodesById(null)
    beginLayoutHistoryBatch()
    setResizeState({
      nodeId: node.id,
      edge,
      originNode: node,
      edgePointerOffset: getResizeEdgePointerOffset(node, edge, cursor),
      anchorBounds: getResizeAnchorBoundsForNode(layout, node),
      childResizeEdge,
      hasFixedYNode,
    })
  }

  // 포트 클릭은 attach 시작/완료만 담당하고, 이미 연결된 포트는 단순 선택으로 처리한다.
  const handlePortClick = (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => {
    event.stopPropagation()
    if (isScenarioReadOnly) {
      setSelection({ kind: 'node', id: nodeId })
      setContextMenu(null)
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioReadOnly) {
      return
    }

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
    if (isScenarioEditMode && scenarioEditBaseline) {
      resetScenarioChanges()
      return
    }

    if (isScenarioReadOnly) {
      return
    }

    clearEditorLayout()
    setSelectedScenario(null)
    setScenarioEditBaseline(null)
    setScenarioTitle('')
    setScenarioDescription('')
    setIsScenarioEditMode(false)
    resetEditorInteractionState()
    replaceLayout(normalizeEditorLayout(createDefaultEditorLayout()))
  }

  // JSON 파일을 불러와 legacy 값을 보정한 뒤 현재 layout으로 적용한다.
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isScenarioReadOnly) {
      event.target.value = ''
      return
    }

    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    const parsedValue: unknown = JSON.parse(text)
    if (isEditorLayout(parsedValue)) {
      const importedLayout = normalizeEditorLayout(parsedValue)
      replaceLayout(importedLayout)
      setSelectedScenario(null)
      setScenarioEditBaseline(importedLayout)
      setScenarioTitle('가져온 시나리오')
      setScenarioDescription('')
      setIsScenarioEditMode(true)
      resetEditorInteractionState()
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

  // 렌더링에서만 쓰는 최종 UI 파생 상태다.
  const hasSelection = Boolean(selectedNode || selectedLink || selection?.kind === 'multi')
  useEffect(() => {
    if (hasSelection) {
      const timerId = window.setTimeout(() => {
        setIsEditorInfoPanelOpen(true)
      }, 0)

      return () => window.clearTimeout(timerId)
    }

    return undefined
  }, [hasSelection])

  const marqueeRect = marqueeSelectionState
    ? normalizeRect(marqueeSelectionState.start, marqueeSelectionState.current)
    : null
  const editorCanvasBaseWidth = editorCanvasFitWidth > 0 ? editorCanvasFitWidth : canvasWidth * EDITOR_ZOOM_DEFAULT
  const editorCanvasRenderedWidth = editorCanvasBaseWidth * (editorZoom / EDITOR_ZOOM_DEFAULT)
  const editorCanvasRenderedHeight = editorCanvasRenderedWidth * (canvasHeight / canvasWidth)

  const updateEditorZoom = (delta: number) => {
    setEditorZoom((current) => Math.max(EDITOR_ZOOM_MIN, current + delta))
  }

  const toggleEditorInfoPanel = useCallback(() => {
    setIsEditorInfoPanelOpen((current) => !current)
  }, [])

  const scenarioToolbar = (
    <EditorScenarioToolbar
      isDark={isDark}
      buttonClassName={themeTokens.button}
      scenarios={scenarios}
      selectedScenario={selectedScenario}
      scenarioError={scenarioError}
      isScenarioEditMode={isScenarioEditMode}
      isLoadingScenarios={isLoadingScenarios}
      isSavingScenario={isSavingScenario}
      scenarioTitle={scenarioTitle}
      scenarioDescription={scenarioDescription}
      onScenarioTitleChange={setScenarioTitle}
      onScenarioDescriptionChange={setScenarioDescription}
      onSaveScenario={saveScenario}
      onResetScenarioChanges={resetScenarioChanges}
      onCancelScenarioEdit={cancelScenarioEdit}
      onScenarioSelect={handleScenarioSelect}
      onRefreshScenarios={refreshScenarios}
      onCreateNewScenario={createNewScenario}
      onBeginScenarioEdit={beginScenarioEdit}
    />
  )
  const renderResizeHandles = useCallback((
    node: EditorNode,
    onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void,
  ) => (
    <PipeResizeHandles node={node} onResizePointerDown={onResizePointerDown} />
  ), [])

  return (
    <>
      <section className="relative flex min-h-screen min-w-0 items-stretch p-4" data-swmm-theme={theme}>
      <InlineInfoPanel
        theme={theme}
        title="편집 정보"
        isOpen={isEditorInfoPanelOpen}
        controls={{
          isInfoPanelOpen: isEditorInfoPanelOpen,
          toggleInfoPanel: toggleEditorInfoPanel,
        }}
      >
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
      </InlineInfoPanel>

      <div className="flex h-[calc(100vh-32px)] min-h-[640px] min-w-0 flex-1 flex-col gap-4">
      {renderHeader ? renderHeader({
        isInfoPanelOpen: isEditorInfoPanelOpen,
        toggleInfoPanel: toggleEditorInfoPanel,
      }) : null}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-sm ${themeTokens.panel}`}>
        <EditorActionToolbar
          isDark={isDark}
          controlBarClassName={themeTokens.controlBar}
          panelMutedClassName={themeTokens.panelMuted}
          buttonClassName={themeTokens.button}
          buttonMutedClassName={themeTokens.buttonMuted}
          editorZoom={editorZoom}
          zoomStep={EDITOR_ZOOM_STEP}
          canUndo={canUndo}
          canRedo={canRedo}
          isScenarioReadOnly={isScenarioReadOnly}
          isScenarioEditMode={isScenarioEditMode}
          isExportingInp={isExportingInp}
          swmmEngineUrl={SWMM_ENGINE_URL}
          fileInputRef={fileInputRef}
          onZoomChange={updateEditorZoom}
          onZoomReset={() => setEditorZoom(EDITOR_ZOOM_DEFAULT)}
          onUndo={undoEditorLayout}
          onRedo={redoEditorLayout}
          onExportJson={() => downloadLayout(layout)}
          onExportInp={handleExportSwmmInp}
          onImport={handleImport}
          onResetLayout={resetLayout}
        />

        {scenarioToolbar}

        <div
          ref={editorCanvasViewportRef}
          className={`relative min-h-0 min-w-0 flex-1 overflow-auto p-6 ${
            isDark ? 'bg-slate-900' : 'bg-sky-50'
          }`}
        >
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
            className={`block max-w-none rounded-md border border-dashed ${
              isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-300 bg-sky-50'
            } ${
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
            <SoilBackground
              minX={baseGroundBounds.left}
              topY={baseGroundBounds.top}
              width={baseGroundWidth}
              height={baseGroundHeight}
              skyHeight={layout.groundSurfaceY}
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

            <EditableNodeLayer
              nodes={terrainNodes}
              renderNodesById={renderNodesById}
              selectedNodeIds={selectedNodeIds}
              renderedPortRelationLookupByNodeId={renderedPortRelationLookupByNodeId}
              connectedPortKeys={connectedPortKeys}
              selectedRelationPortRoles={selectedRelationPortRoles}
              selectedParentPortKeys={selectedParentPortKeys}
              pendingPort={pendingPort}
              attachTargetNodeId={attachTargetNodeId}
              coordinateEditActive={Boolean(coordinateEditState)}
              getRenderablePorts={getNodeRenderablePorts}
              getRenderedPortPoint={getRenderedPortPointFromLookup}
              hasManualResizableEdge={hasManualResizableEdge}
              renderResizeHandles={renderResizeHandles}
              onPointerDown={handleNodePointerDown}
              onPointerEnter={handleNodePointerEnter}
              onNodeContextMenu={handleNodeContextMenu}
              onPortClick={handlePortClick}
              onPortContextMenu={handlePortContextMenu}
              onResizePointerDown={handlePipeResizePointerDown}
            />
            <g>
              {terrainNodes.map((node) => {
                const renderNode = renderNodesById.get(node.id) ?? node

                return (
                  <g key={`${node.id}-layout-add-handles`} transform={`translate(${renderNode.x} ${renderNode.y})`}>
                    <LayoutAddHandles
                      bounds={{ left: 0, top: 0, right: renderNode.width, bottom: renderNode.height }}
                      onPointerDown={(side, event) => handleNodeLayoutAddPointerDown(renderNode, side, event)}
                    />
                  </g>
                )
              })}
              <LayoutAddHandles
                bounds={baseGroundBounds}
                onPointerDown={handleBaseLayoutAddPointerDown}
              />
            </g>

            <g>
              {layout.links.map((link) => (
                <EditableLink
                  key={link.id}
                  link={link}
                  fromNode={renderNodesById.get(link.from.nodeId) ?? null}
                  toNode={renderNodesById.get(link.to.nodeId) ?? null}
                  selected={selection?.kind === 'link' && selection.id === link.id}
                  onSelect={handleLinkSelect}
                />
              ))}
            </g>

            <EditableNodeLayer
              nodes={drawableNodes}
              renderNodesById={renderNodesById}
              selectedNodeIds={selectedNodeIds}
              renderedPortRelationLookupByNodeId={renderedPortRelationLookupByNodeId}
              connectedPortKeys={connectedPortKeys}
              selectedRelationPortRoles={selectedRelationPortRoles}
              selectedParentPortKeys={selectedParentPortKeys}
              pendingPort={pendingPort}
              attachTargetNodeId={attachTargetNodeId}
              coordinateEditActive={Boolean(coordinateEditState)}
              getRenderablePorts={getNodeRenderablePorts}
              getRenderedPortPoint={getRenderedPortPointFromLookup}
              hasManualResizableEdge={hasManualResizableEdge}
              renderResizeHandles={renderResizeHandles}
              onPointerDown={handleNodePointerDown}
              onPointerEnter={handleNodePointerEnter}
              onNodeContextMenu={handleNodeContextMenu}
              onPortClick={handlePortClick}
              onPortContextMenu={handlePortContextMenu}
              onResizePointerDown={handlePipeResizePointerDown}
            />
          </svg>
          </div>
        </div>
      </div>
      </div>
    </section>
    {contextMenu ? (
      <EditorContextMenu
        contextMenu={contextMenu}
        canStartCoordinateEdit={Boolean(
          contextMenu.nodeId && getCoordinateEditableTeeRelationInfo(layout, contextMenu.nodeId),
        )}
        onChangeNodeZOrder={changeContextNodeZOrder}
        onStartTeeCoordinateEdit={startContextTeeCoordinateEdit}
        onAddLayoutNode={addLayoutNode}
        onDetachRelation={detachContextRelation}
        onAddNode={addNode}
        onAddStandalonePipe={addStandalonePipe}
        onClose={() => setContextMenu(null)}
      />
    ) : null}
    </>
  )
}

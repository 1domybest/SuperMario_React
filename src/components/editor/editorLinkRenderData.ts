import {
  RELATION_ARROW_MAX_SIZE,
  RELATION_ARROW_MIN_SIZE,
} from './editorDefinitions'
import { clampNumber, getPointDistance } from './editorGeometry'
import {
  getAttachedPortPoint,
  getNodePort,
  getPortFaceSpan,
  getPortPoint,
} from './editorNodeHelpers'
import type { EditorLayout, EditorLink, EditorNode, EditorEndpoint, EditorPort } from './editorTypes'
import {
  getEndpointPort,
  getLinkEndpointPoint,
  getLinkPath,
} from './editorRelations'
import type { Point } from './editorInternalTypes'

export type EditorLinkRenderItem = {
  link: EditorLink
  path: string
  startX: number
  startY: number
  endX: number
  endY: number
  arrowSize: number | null
}

/** endpoint가 참조하는 포트를 이미 알고 있는 노드 객체 안에서 찾는다. */
function getEndpointPortFromNode(node: EditorNode | null | undefined, endpoint: EditorEndpoint): EditorPort | null {
  return node ? getNodePort(node, endpoint.portId) : null
}

/** endpoint 포트 좌표를 찾고, 포트가 없으면 노드 중심 좌표를 fallback으로 사용한다. */
function getEndpointPointFromNode(node: EditorNode | null | undefined, endpoint: EditorEndpoint): Point | null {
  const port = getEndpointPortFromNode(node, endpoint)
  if (!node || !port) {
    return node
      ? {
          x: node.x + node.width / 2,
          y: node.y + node.height / 2,
        }
      : null
  }

  return getPortPoint(node, port)
}

/** relation endpoint 좌표를 반대편 노드/포트 방향에 맞춰 attach 보정한 값으로 계산한다. */
function getEndpointPointWithCounterpartFromNodes(
  node: EditorNode | null | undefined,
  endpoint: EditorEndpoint,
  counterpartNode: EditorNode | null | undefined,
  counterpartEndpoint: EditorEndpoint,
): Point | null {
  const port = getEndpointPortFromNode(node, endpoint)
  if (!node || !port) {
    return node
      ? {
          x: node.x + node.width / 2,
          y: node.y + node.height / 2,
        }
      : null
  }

  const counterpartPort = getEndpointPortFromNode(counterpartNode, counterpartEndpoint)
  return getAttachedPortPoint(node, port, counterpartNode, counterpartPort)
}

/** 일반 link와 relation link의 endpoint 좌표 계산을 노드 객체 기반으로 통합한다. */
function getLinkEndpointPointFromNodes(
  link: EditorLink,
  endpointName: 'from' | 'to',
  fromNode: EditorNode | null | undefined,
  toNode: EditorNode | null | undefined,
) {
  if (link.type !== 'relation') {
    return getEndpointPointFromNode(endpointName === 'from' ? fromNode : toNode, link[endpointName])
  }

  return endpointName === 'from'
    ? getEndpointPointWithCounterpartFromNodes(fromNode, link.from, toNode, link.to)
    : getEndpointPointWithCounterpartFromNodes(toNode, link.to, fromNode, link.from)
}

/** 계산된 시작/끝 좌표를 직선 또는 꺾은 SVG path로 변환한다. */
function getLinkPathForPointsFromNodes(
  link: EditorLink,
  start: Point,
  end: Point,
  fromNode: EditorNode | null | undefined,
) {
  if (link.props.route === 'straight') {
    return `M${start.x} ${start.y} L${end.x} ${end.y}`
  }

  const startPort = getEndpointPortFromNode(fromNode, link.from)
  const prefersHorizontalStart = startPort?.side === 'left' || startPort?.side === 'right'

  if (prefersHorizontalStart) {
    const midX = start.x + (end.x - start.x) * 0.58
    return `M${start.x} ${start.y} H${midX} V${end.y} H${end.x}`
  }

  const midY = start.y + (end.y - start.y) * 0.58
  return `M${start.x} ${start.y} V${midY} H${end.x} V${end.y}`
}

/** relation 방향 화살표 크기를 child 크기와 거리 기준으로 계산한다. */
function getRelationArrowSize(layout: EditorLayout, link: EditorLink, start: Point, end: Point) {
  const childNode = layout.nodes.find((node) => node.id === link.to.nodeId)
  const childPort = childNode ? getEndpointPort(layout, link.to) : null
  const childSpan = childNode && childPort
    ? getPortFaceSpan(childNode, childPort)
    : childNode
      ? Math.min(childNode.width, childNode.height)
      : RELATION_ARROW_MAX_SIZE
  const distanceSize = getPointDistance(start, end) * 0.16
  const childSize = childSpan * 0.32

  return clampNumber(Math.min(distanceSize, childSize), RELATION_ARROW_MIN_SIZE, RELATION_ARROW_MAX_SIZE)
}

/** 이미 조회된 child 노드를 사용해 relation 방향 화살표 크기를 계산한다. */
function getRelationArrowSizeFromNodes(link: EditorLink, toNode: EditorNode | null | undefined, start: Point, end: Point) {
  const childPort = toNode ? getEndpointPortFromNode(toNode, link.to) : null
  const childSpan = toNode && childPort
    ? getPortFaceSpan(toNode, childPort)
    : toNode
      ? Math.min(toNode.width, toNode.height)
      : RELATION_ARROW_MAX_SIZE
  const distanceSize = getPointDistance(start, end) * 0.16
  const childSize = childSpan * 0.32

  return clampNumber(Math.min(distanceSize, childSize), RELATION_ARROW_MIN_SIZE, RELATION_ARROW_MAX_SIZE)
}

/** 링크 한 개와 endpoint 노드만으로 렌더링에 필요한 값을 계산한다. */
export function createEditorLinkRenderItemFromNodes(
  link: EditorLink,
  fromNode: EditorNode | null | undefined,
  toNode: EditorNode | null | undefined,
): EditorLinkRenderItem | null {
  const start = getLinkEndpointPointFromNodes(link, 'from', fromNode, toNode)
  const end = getLinkEndpointPointFromNodes(link, 'to', fromNode, toNode)
  if (!start || !end) {
    return null
  }

  return {
    link,
    path: getLinkPathForPointsFromNodes(link, start, end, fromNode),
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    arrowSize: link.type === 'relation'
      ? getRelationArrowSizeFromNodes(link, toNode, start, end)
      : null,
  }
}

/** layout 기준으로 링크 렌더링에 필요한 작은 값들만 계산한다. */
export function createEditorLinkRenderItems(layout: EditorLayout): EditorLinkRenderItem[] {
  return layout.links.flatMap((link) => {
    const path = getLinkPath(layout, link)
    const start = getLinkEndpointPoint(layout, link, 'from')
    const end = getLinkEndpointPoint(layout, link, 'to')
    if (!path || !start || !end) {
      return []
    }

    return [{
      link,
      path,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      arrowSize: link.type === 'relation'
        ? getRelationArrowSize(layout, link, start, end)
        : null,
    }]
  })
}

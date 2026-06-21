import type { EditorNode } from './editorTypes'
import type { Point, RectBounds } from './editorInternalTypes'

/** 브라우저 포인터 좌표를 SVG 편집기 좌표계로 변환한다. */
export function getSvgCursor(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const matrix = svg.getScreenCTM()

  if (!matrix) {
    return { x: clientX, y: clientY }
  }

  return point.matrixTransform(matrix.inverse())
}

/** 노드 현재 경계의 중심 좌표를 반환한다. */
export function getNodeCenter(node: EditorNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  }
}

/** 숫자를 포함 범위 min/max 안으로 제한한다. */
export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 편집기 좌표 두 점 사이의 유클리드 거리를 반환한다. */
export function getPointDistance(start: Point, end: Point) {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

/** 노드의 사각 경계를 편집기 좌표로 반환한다. */
export function getNodeRect(node: EditorNode): RectBounds {
  return {
    left: node.x,
    top: node.y,
    right: node.x + node.width,
    bottom: node.y + node.height,
  }
}

/** 드래그 시작/끝 좌표를 left/top/right/bottom 사각 경계로 정규화한다. */
export function normalizeRect(start: Point, current: Point): RectBounds {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y),
  }
}

/** 두 사각형이 겹치거나 맞닿는지 확인한다. */
export function rectsIntersect(a: RectBounds, b: RectBounds) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
}

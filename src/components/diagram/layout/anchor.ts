import type { LayoutNode, LayoutNodeSpec, Point } from './types'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'
export type AnchorReference = 'start' | 'center' | 'end'

export type AnchorAlong =
  | AnchorReference
  | {
      from: AnchorReference
      offset?: number
    }

export interface AnchorBounds extends Point {
  width: number
  height: number
}

export interface AnchorPlacement {
  side: AnchorSide
  along?: AnchorAlong
  inset?: number
}

function normalizeAlong(along: AnchorAlong = 'center') {
  return typeof along === 'string' ? { from: along, offset: 0 } : { offset: 0, ...along }
}

function resolveAxisPosition(start: number, size: number, itemSize: number, along: AnchorAlong) {
  const { from, offset = 0 } = normalizeAlong(along)

  if (from === 'start') {
    return start + offset
  }

  if (from === 'end') {
    return start + size - itemSize - offset
  }

  return start + (size - itemSize) / 2 + offset
}

export function resolveAnchoredNode(
  bounds: AnchorBounds,
  item: LayoutNodeSpec,
  placement: AnchorPlacement,
): LayoutNode {
  const inset = placement.inset ?? 0
  const along = placement.along ?? 'center'

  if (placement.side === 'top') {
    return {
      ...item,
      x: resolveAxisPosition(bounds.x, bounds.width, item.width, along),
      y: bounds.y + inset,
    }
  }

  if (placement.side === 'bottom') {
    return {
      ...item,
      x: resolveAxisPosition(bounds.x, bounds.width, item.width, along),
      y: bounds.y + bounds.height - item.height - inset,
    }
  }

  if (placement.side === 'left') {
    return {
      ...item,
      x: bounds.x + inset,
      y: resolveAxisPosition(bounds.y, bounds.height, item.height, along),
    }
  }

  return {
    ...item,
    x: bounds.x + bounds.width - item.width - inset,
    y: resolveAxisPosition(bounds.y, bounds.height, item.height, along),
  }
}

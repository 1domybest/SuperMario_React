import type { LayoutNode, LayoutNodeSpec } from './types'

export type HStackAlign = 'top' | 'center' | 'bottom'

export interface CreateHStackLayoutOptions {
  x: number
  y: number
  gap: number
  align?: HStackAlign
  items: LayoutNodeSpec[]
}

export function createHStackLayout({
  x,
  y,
  gap,
  align = 'center',
  items,
}: CreateHStackLayoutOptions): LayoutNode[] {
  const maxHeight = Math.max(...items.map((item) => item.height), 0)
  let cursorX = x

  return items.map((item) => {
    const offsetY =
      align === 'top' ? 0 : align === 'bottom' ? maxHeight - item.height : (maxHeight - item.height) / 2
    const node: LayoutNode = {
      ...item,
      x: cursorX,
      y: y + offsetY,
    }

    cursorX += item.width + gap
    return node
  })
}

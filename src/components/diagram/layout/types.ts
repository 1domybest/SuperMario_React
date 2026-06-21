import type { ReactNode } from 'react'

export type Point = {
  x: number
  y: number
}

export type PortMap = Record<string, Point>

export type LayoutNodeSpec = {
  id: string
  name: string
  width: number
  height: number
  ports: PortMap
  render: (node: LayoutNode) => ReactNode
}

export type LayoutNode = LayoutNodeSpec & Point

export function getNodePort(node: LayoutNode, portName: string): Point {
  const port = node.ports[portName]

  if (!port) {
    throw new Error(`Unknown port "${portName}" on node "${node.id}"`)
  }

  return {
    x: node.x + port.x,
    y: node.y + port.y,
  }
}

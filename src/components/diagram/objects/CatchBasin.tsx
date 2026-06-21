/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import type { LayoutNode, LayoutNodeSpec } from '../layout'

export const CATCH_BASIN_WIDTH = 140
export const CATCH_BASIN_HEIGHT = 92

export function createCatchBasinSpec(id: string, name: string): LayoutNodeSpec {
  return {
    id,
    name,
    width: CATCH_BASIN_WIDTH,
    height: CATCH_BASIN_HEIGHT,
    ports: {
      outletLeft: { x: 0, y: CATCH_BASIN_HEIGHT / 2 },
      center: { x: CATCH_BASIN_WIDTH / 2, y: CATCH_BASIN_HEIGHT / 2 },
      outletRight: { x: CATCH_BASIN_WIDTH, y: CATCH_BASIN_HEIGHT / 2 },
      outletBottom: { x: CATCH_BASIN_WIDTH / 2, y: CATCH_BASIN_HEIGHT },
    },
    render: (node) => <CatchBasin node={node} />,
  }
}

export interface CatchBasinProps {
  node: LayoutNode
  outletPort?: string
  outletAngle?: number
  children?: ReactNode
}

export function CatchBasin({ node, outletPort = 'outletRight', outletAngle = 0, children }: CatchBasinProps) {
  const outlet = node.ports[outletPort]

  return (
    <g id={node.id} transform={`translate(${node.x} ${node.y})`} data-object-kind="catch-basin">
      <title>{node.name}</title>
      <rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        rx={8}
        fill="#172033"
        stroke="#0f172a"
        strokeWidth={4}
      />
      <line x1={26} y1={24} x2={114} y2={24} stroke="#334155" strokeWidth={3} />
      <line x1={26} y1={62} x2={114} y2={62} stroke="#334155" strokeWidth={3} />
      <text
        x={node.width / 2}
        y={node.height / 2 + 8}
        textAnchor="middle"
        fontSize={20}
        fontWeight={900}
        fill="#fff"
        paintOrder="stroke"
        stroke="rgba(15, 23, 42, 0.8)"
        strokeWidth={4}
      >
        {node.name}
      </text>
      {children && outlet ? (
        <g transform={`translate(${outlet.x} ${outlet.y}) rotate(${outletAngle})`}>{children}</g>
      ) : null}
    </g>
  )
}

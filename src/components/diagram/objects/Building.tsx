import type { ReactNode } from 'react'

export interface HouseProps {
  id: string
  name: string
  x?: number
  y?: number
  width?: number
  bodyHeight?: number
  roofHeight?: number
  bodyFill?: string
  roofFill?: string
  borderColor?: string
  label?: string
  showLabel?: boolean
  children?: ReactNode
}

export interface ApartmentProps {
  id: string
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
  bodyFill?: string
  borderColor?: string
  label?: string
  showLabel?: boolean
  children?: ReactNode
}

export function House({
  id,
  name,
  x = 0,
  y = 0,
  width = 160,
  bodyHeight = 82,
  roofHeight = 50,
  bodyFill = '#fff4d8',
  roofFill = '#ea6c28',
  borderColor = '#334155',
  label,
  showLabel = true,
  children,
}: HouseProps) {
  const roofY = 0
  const bodyY = roofHeight - 4
  const totalHeight = roofHeight + bodyHeight - 4
  const windowSize = Math.max(18, width * 0.14)

  return (
    <g
      id={id}
      data-object-kind="house"
      data-building-width={width}
      data-building-height={totalHeight}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={`${name} 주거지`}
    >
      <title>{name}</title>
      {showLabel ? (
        <text
          x={width / 2}
          y={-12}
          textAnchor="middle"
          fontSize={18}
          fontWeight={900}
          fill="#172033"
          paintOrder="stroke"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={5}
        >
          {label ?? name}
        </text>
      ) : null}
      <path
        d={`M${width / 2} ${roofY} L${width + 18} ${roofHeight} H-18 Z`}
        fill={roofFill}
        stroke={borderColor}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <rect
        x={0}
        y={bodyY}
        width={width}
        height={bodyHeight}
        rx={12}
        fill={bodyFill}
        stroke={borderColor}
        strokeWidth={3}
      />
      <rect
        x={width * 0.24}
        y={bodyY + bodyHeight * 0.34}
        width={windowSize}
        height={windowSize}
        fill="#bfdbfe"
        stroke="#60a5fa"
        strokeWidth={2}
      />
      <rect
        x={width * 0.62}
        y={bodyY + bodyHeight * 0.34}
        width={windowSize}
        height={windowSize}
        fill="#bfdbfe"
        stroke="#60a5fa"
        strokeWidth={2}
      />
      {children}
    </g>
  )
}

export function Apartment({
  id,
  name,
  x = 0,
  y = 0,
  width = 150,
  height = 150,
  bodyFill = '#d9ecfb',
  borderColor = '#334155',
  label,
  showLabel = true,
  children,
}: ApartmentProps) {
  const windowSize = Math.max(16, width * 0.15)
  const gapX = (width - windowSize * 3) / 4
  const gapY = (height - 40 - windowSize * 3) / 4

  return (
    <g
      id={id}
      data-object-kind="apartment"
      data-building-width={width}
      data-building-height={height}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={`${name} 아파트`}
    >
      <title>{name}</title>
      {showLabel ? (
        <text
          x={width / 2}
          y={-12}
          textAnchor="middle"
          fontSize={18}
          fontWeight={900}
          fill="#172033"
          paintOrder="stroke"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={5}
        >
          {label ?? name}
        </text>
      ) : null}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={10}
        fill={bodyFill}
        stroke={borderColor}
        strokeWidth={3}
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((column) => (
          <rect
            key={`${row}-${column}`}
            x={gapX + column * (windowSize + gapX)}
            y={20 + gapY + row * (windowSize + gapY)}
            width={windowSize}
            height={windowSize}
            fill="#fff7dc"
            stroke="#60a5fa"
            strokeWidth={2}
          />
        )),
      )}
      <rect x={width / 2 - 14} y={height - 28} width={28} height={28} fill="#9a6634" />
      {children}
    </g>
  )
}

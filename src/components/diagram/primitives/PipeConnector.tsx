export interface PipeConnectorProps {
  id: string
  thickness: number
  angle: number
  x?: number
  y?: number
  fixedHeight?: number
  fill?: string
  borderColor?: string
  stripeColor?: string
  label?: string
}

export function PipeConnector({
  id,
  thickness,
  angle,
  x = 0,
  y = 0,
  fixedHeight = 24,
  fill = '#f4c58d',
  borderColor = '#9a5b24',
  stripeColor = '#b97939',
  label = '배관 커넥터',
}: PipeConnectorProps) {
  const safeThickness = Math.max(8, thickness)
  const safeHeight = Math.max(6, fixedHeight)
  const stripeHeight = safeHeight * 0.7
  const stripeTop = -stripeHeight / 2
  const stripeGap = safeThickness / 4

  return (
    <g
      id={id}
      data-connector-thickness={safeThickness}
      data-connector-height={safeHeight}
      data-connector-angle={angle}
      transform={`translate(${x} ${y}) rotate(${angle})`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <rect
        x={-safeThickness / 2}
        y={-safeHeight / 2}
        width={safeThickness}
        height={safeHeight}
        rx={0}
        fill={fill}
        stroke={borderColor}
        strokeWidth={4}
      />
      {[-1, 0, 1].map((offset) => (
        <line
          key={offset}
          x1={offset * stripeGap}
          y1={stripeTop}
          x2={offset * stripeGap}
          y2={stripeTop + stripeHeight}
          stroke={stripeColor}
          strokeWidth={3}
          strokeLinecap="butt"
        />
      ))}
    </g>
  )
}

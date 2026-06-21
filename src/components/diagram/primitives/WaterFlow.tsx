export type FlowDirection = 'forward' | 'reverse'

export interface WaterFlowProps {
  length: number
  thickness: number
  velocity: number
  direction: FlowDirection
  x?: number
  y?: number
  active?: boolean
  color?: string
  reverseColor?: string
}

export function WaterFlow({
  length,
  thickness,
  velocity,
  direction,
  x = 0,
  y = 0,
  active = true,
  color = 'rgba(100, 116, 139, 0.42)',
  reverseColor = 'rgba(185, 28, 28, 0.72)',
}: WaterFlowProps) {
  const safeLength = Math.max(0, length)
  const safeVelocity = Math.max(0, velocity)
  const isMoving = active && safeVelocity > 0 && safeLength > 0
  const dashLength = Math.max(14, thickness * 2.3)
  const dashGap = Math.max(10, thickness * 1.45)
  const dashCycle = dashLength + dashGap
  const duration = Math.max(0.28, 2.8 / Math.max(safeVelocity, 0.1))
  const dashOffsetTo = direction === 'forward' ? -dashCycle : dashCycle

  return (
    <line
      x1={x}
      y1={y}
      x2={x + safeLength}
      y2={y}
      stroke={direction === 'forward' ? color : reverseColor}
      strokeWidth={thickness}
      strokeLinecap="round"
      strokeDasharray={`${dashLength} ${dashGap}`}
      opacity={isMoving ? 1 : 0.34}
    >
      {isMoving ? (
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={String(dashOffsetTo)}
          dur={`${duration}s`}
          repeatCount="indefinite"
        />
      ) : null}
    </line>
  )
}

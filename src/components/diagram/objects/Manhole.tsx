import { WaterFill } from '../primitives'

export interface ManholeProps {
  id: string
  name: string
  x?: number
  y?: number
  width?: number
  shaftHeight?: number
  lidDiameter?: number
  lidInnerRatio?: number
  volume?: number
  lidOpen?: number
  lidOpenAngle?: number
  lidColor?: string
  rimColor?: string
  shaftFill?: string
  borderColor?: string
  waterColor?: string
  warningColor?: string
  fullColor?: string
  showLabel?: boolean
}

function clampRatio(value: number) {
  const ratio = value > 1 ? value / 100 : value

  return Math.min(1, Math.max(0, ratio))
}

export function Manhole({
  id,
  name,
  x = 0,
  y = 0,
  width = 96,
  shaftHeight = 190,
  lidDiameter,
  lidInnerRatio = 0.68,
  volume = 0,
  lidOpen = 0,
  lidOpenAngle = 72,
  lidColor = '#2453d8',
  rimColor = '#2f8df4',
  shaftFill = '#bcc5cc',
  borderColor = '#7b8792',
  waterColor = 'rgba(56, 189, 248, 0.34)',
  warningColor = 'rgba(251, 146, 60, 0.42)',
  fullColor = 'rgba(239, 68, 68, 0.46)',
  showLabel = true,
}: ManholeProps) {
  const openRatio = clampRatio(lidOpen)
  const manholeWidth = lidDiameter ?? width
  const rimRadius = manholeWidth / 2
  const lidRadius = rimRadius * lidInnerRatio
  const coverCenterX = manholeWidth / 2
  const coverCenterY = rimRadius
  const hingeX = coverCenterX - rimRadius
  const hingeY = coverCenterY
  const shaftTop = rimRadius * 1.32
  const innerPadding = Math.max(7, manholeWidth * 0.08)
  const innerX = innerPadding
  const innerY = shaftTop + innerPadding
  const innerWidth = manholeWidth - innerPadding * 2
  const innerHeight = shaftHeight - innerPadding * 2
  const lidRotation = -lidOpenAngle * openRatio
  const totalHeight = shaftTop + shaftHeight
  const rimStrokeWidth = Math.max(4, rimRadius * 0.13)
  const lidStrokeWidth = Math.max(3, lidRadius * 0.14)
  const grilleStrokeWidth = Math.max(3, lidRadius * 0.17)

  return (
    <g
      id={id}
      data-object-kind="manhole"
      data-manhole-width={manholeWidth}
      data-manhole-shaft-height={shaftHeight}
      data-manhole-lid-diameter={rimRadius * 2}
      data-fill-volume={volume}
      data-lid-open={openRatio}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={`${name} 맨홀`}
    >
      <title>{name}</title>
      <rect
        x={0}
        y={shaftTop}
        width={manholeWidth}
        height={shaftHeight}
        rx={10}
        fill={shaftFill}
        stroke={borderColor}
        strokeWidth={5}
      />
      <rect
        x={innerX}
        y={innerY}
        width={innerWidth}
        height={innerHeight}
        rx={4}
        fill="rgba(148, 163, 184, 0.2)"
      />
      <WaterFill
        x={innerX}
        y={innerY}
        width={innerWidth}
        height={innerHeight}
        volume={volume}
        waterColor={waterColor}
        warningColor={warningColor}
        fullColor={fullColor}
      />
      <line
        x1={manholeWidth * 0.28}
        y1={shaftTop + shaftHeight * 0.34}
        x2={manholeWidth * 0.72}
        y2={shaftTop + shaftHeight * 0.34}
        stroke="#94a3ad"
        strokeWidth={4}
      />
      <line
        x1={manholeWidth * 0.28}
        y1={shaftTop + shaftHeight * 0.68}
        x2={manholeWidth * 0.72}
        y2={shaftTop + shaftHeight * 0.68}
        stroke="#94a3ad"
        strokeWidth={4}
      />
      {showLabel ? (
        <text
          x={manholeWidth / 2}
          y={shaftTop + shaftHeight * 0.48}
          textAnchor="middle"
          fontSize={18}
          fontWeight={900}
          fill="#fff"
          paintOrder="stroke"
          stroke="rgba(51, 65, 85, 0.9)"
          strokeWidth={5}
        >
          {name}
        </text>
      ) : null}

      <circle
        cx={coverCenterX}
        cy={coverCenterY}
        r={rimRadius}
        fill="rgba(219, 234, 254, 0.96)"
        stroke={rimColor}
        strokeWidth={rimStrokeWidth}
      />
      <circle cx={hingeX} cy={hingeY} r={4} fill="#64748b" />
      <g transform={`rotate(${lidRotation} ${hingeX} ${hingeY})`}>
        <circle
          cx={coverCenterX}
          cy={coverCenterY}
          r={lidRadius}
          fill={lidColor}
          stroke="#172554"
          strokeWidth={lidStrokeWidth}
        />
        <line
          x1={coverCenterX - lidRadius * 0.55}
          y1={coverCenterY - lidRadius * 0.38}
          x2={coverCenterX + lidRadius * 0.55}
          y2={coverCenterY - lidRadius * 0.38}
          stroke="rgba(219, 234, 254, 0.9)"
          strokeWidth={grilleStrokeWidth}
          strokeLinecap="round"
        />
        <line
          x1={coverCenterX - lidRadius * 0.65}
          y1={coverCenterY}
          x2={coverCenterX + lidRadius * 0.65}
          y2={coverCenterY}
          stroke="rgba(219, 234, 254, 0.9)"
          strokeWidth={grilleStrokeWidth}
          strokeLinecap="round"
        />
        <line
          x1={coverCenterX - lidRadius * 0.55}
          y1={coverCenterY + lidRadius * 0.38}
          x2={coverCenterX + lidRadius * 0.55}
          y2={coverCenterY + lidRadius * 0.38}
          stroke="rgba(219, 234, 254, 0.9)"
          strokeWidth={grilleStrokeWidth}
          strokeLinecap="round"
        />
      </g>

      <rect
        x={0}
        y={totalHeight - 8}
        width={manholeWidth}
        height={8}
        rx={4}
        fill="rgba(100, 116, 139, 0.35)"
      />
    </g>
  )
}

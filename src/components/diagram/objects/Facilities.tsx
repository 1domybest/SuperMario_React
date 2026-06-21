import { PIPE_SIZE_PRESETS, PipeConnector, type PipeSize, WaterFill } from '../primitives'

export interface StormOverflowFacilityProps {
  id: string
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
  volume?: number
  gateOpen?: number
  inletPortSize?: PipeSize
  normalPortSize?: PipeSize
  overflowPortSize?: PipeSize
}

export interface RainPumpStationProps {
  id: string
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
  volume?: number
  active?: boolean
}

export interface WaterReclamationCenterProps {
  id: string
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
  volume?: number
}

function clampRatio(value: number) {
  const ratio = value > 1 ? value / 100 : value

  return Math.min(1, Math.max(0, ratio))
}

function getFacilityConnectorMetrics(size: PipeSize) {
  const preset = PIPE_SIZE_PRESETS[size]
  const pipeOuterThickness = preset.innerThickness + preset.borderThickness * 2

  return {
    longSide: pipeOuterThickness * 1.1,
    shortSide: pipeOuterThickness * 0.3,
  }
}

export function StormOverflowFacility({
  id,
  name,
  x = 0,
  y = 0,
  width = 360,
  height = 160,
  volume = 0,
  gateOpen = 0.25,
  inletPortSize = 'medium',
  normalPortSize = 'medium',
  overflowPortSize = 'large',
}: StormOverflowFacilityProps) {
  const chamberPadding = 18
  const chamberX = chamberPadding
  const chamberY = 32
  const chamberWidth = width - chamberPadding * 2
  const chamberHeight = height - chamberY - 20
  const grateY = 12
  const grateHeight = 22
  const gateRatio = clampRatio(gateOpen)
  const gateLength = chamberHeight * 0.88
  const gateX1 = chamberX + chamberWidth * 0.52
  const gateY1 = chamberY + chamberHeight - 12
  const gateAngle = -56 + gateRatio * 42
  const bottomPortX = chamberX + chamberWidth * 0.36
  const bottomPortY = height
  const inletConnector = getFacilityConnectorMetrics(inletPortSize)
  const normalConnector = getFacilityConnectorMetrics(normalPortSize)
  const overflowConnector = getFacilityConnectorMetrics(overflowPortSize)
  const inletConnectorX = -inletConnector.shortSide / 2
  const normalConnectorY = bottomPortY + normalConnector.shortSide / 2
  const overflowConnectorX = width + overflowConnector.shortSide / 2

  return (
    <g
      id={id}
      data-object-kind="storm-overflow-facility"
      data-fill-volume={volume}
      data-gate-open={gateRatio}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={14}
        fill="#d7dee6"
        stroke="#536171"
        strokeWidth={5}
      />
      <rect
        x={chamberX}
        y={chamberY}
        width={chamberWidth}
        height={chamberHeight}
        rx={6}
        fill="#f8fafc"
        stroke="#aab7c4"
        strokeWidth={3}
      />
      <WaterFill
        x={chamberX + 4}
        y={chamberY + 4}
        width={chamberWidth - 8}
        height={chamberHeight - 8}
        volume={volume}
        waterColor="rgba(125, 211, 252, 0.34)"
      />
      <rect
        x={chamberX + 14}
        y={grateY}
        width={chamberWidth - 28}
        height={grateHeight}
        rx={3}
        fill="#667280"
        stroke="#405062"
        strokeWidth={3}
      />
      {Array.from({ length: 10 }, (_, index) => (
        <line
          key={`${id}-grate-${index}`}
          x1={chamberX + 30 + index * ((chamberWidth - 60) / 9)}
          y1={grateY + 2}
          x2={chamberX + 30 + index * ((chamberWidth - 60) / 9)}
          y2={grateY + grateHeight - 2}
          stroke="#cbd5e1"
          strokeWidth={2}
        />
      ))}
      <text
        x={width / 2}
        y={chamberY + 24}
        textAnchor="middle"
        fontSize={19}
        fontWeight={900}
        fill="#172033"
        paintOrder="stroke"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={5}
      >
        {name}
      </text>
      <text x={chamberX + 46} y={chamberY + chamberHeight - 18} fontSize={13} fontWeight={800} fill="#475569">
        일반 유량
      </text>
      <text x={gateX1 + 76} y={chamberY + chamberHeight * 0.62} fontSize={13} fontWeight={800} fill="#475569">
        폭우 초과분
      </text>
      <text x={gateX1 + 54} y={chamberY + 42} fontSize={12} fontWeight={900} fill="#475569">
        유량조절판
      </text>
      <g transform={`translate(${gateX1} ${gateY1}) rotate(${gateAngle})`}>
        <rect
          x={0}
          y={-7}
          width={gateLength}
          height={14}
          fill="#aeb7c2"
          stroke="#526173"
          strokeWidth={4}
        />
        <line x1={8} y1={0} x2={gateLength - 8} y2={0} stroke="#dbe4ee" strokeWidth={2} />
      </g>
      <PipeConnector
        id={`${id}-inlet-visual`}
        thickness={inletConnector.longSide}
        fixedHeight={inletConnector.shortSide}
        angle={90}
        x={inletConnectorX}
        y={height / 2}
        fill="#e5e7eb"
        borderColor="#536171"
        stripeColor="#cbd5e1"
        label={`${name} 유입 커넥터`}
      />
      <PipeConnector
        id={`${id}-normal-outlet-visual`}
        thickness={normalConnector.longSide}
        fixedHeight={normalConnector.shortSide}
        angle={0}
        x={bottomPortX}
        y={normalConnectorY}
        fill="#e5e7eb"
        borderColor="#536171"
        stripeColor="#cbd5e1"
        label={`${name} 일반 유량 하부 커넥터`}
      />
      <PipeConnector
        id={`${id}-overflow-outlet-visual`}
        thickness={overflowConnector.longSide}
        fixedHeight={overflowConnector.shortSide}
        angle={90}
        x={overflowConnectorX}
        y={height / 2}
        fill="#e5e7eb"
        borderColor="#536171"
        stripeColor="#cbd5e1"
        label={`${name} 월류 커넥터`}
      />
    </g>
  )
}

export function RainPumpStation({
  id,
  name,
  x = 0,
  y = 0,
  width = 330,
  height = 128,
  volume = 0,
  active = true,
}: RainPumpStationProps) {
  const fanRadius = 34
  const fanX = width / 2
  const fanY = height * 0.58
  const bodyPadding = 18

  return (
    <g
      id={id}
      data-object-kind="rain-pump-station"
      data-fill-volume={volume}
      data-active={active}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={14}
        fill="#dbeafe"
        stroke="#2f8df4"
        strokeWidth={5}
      />
      <WaterFill
        x={bodyPadding}
        y={bodyPadding}
        width={width - bodyPadding * 2}
        height={height - bodyPadding * 2}
        volume={volume}
        waterColor="rgba(56, 189, 248, 0.24)"
      />
      <text
        x={width / 2}
        y={32}
        textAnchor="middle"
        fontSize={22}
        fontWeight={900}
        fill="#172033"
        paintOrder="stroke"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={5}
      >
        {name}
      </text>
      <rect x={46} y={height * 0.52} width={90} height={28} rx={8} fill="#f8fafc" stroke="#93c5fd" strokeWidth={3} />
      <rect
        x={width - 136}
        y={height * 0.52}
        width={90}
        height={28}
        rx={8}
        fill="#f8fafc"
        stroke="#93c5fd"
        strokeWidth={3}
      />
      <line x1={136} y1={fanY} x2={fanX - fanRadius} y2={fanY} stroke="#2f8df4" strokeWidth={8} strokeLinecap="round" />
      <line
        x1={fanX + fanRadius}
        y1={fanY}
        x2={width - 136}
        y2={fanY}
        stroke="#2f8df4"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <circle cx={fanX} cy={fanY} r={fanRadius} fill="#bfdbfe" stroke="#2f8df4" strokeWidth={6} />
      <g transform={`translate(${fanX} ${fanY})`}>
        <g>
          {active ? (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur="0.75s"
              repeatCount="indefinite"
            />
          ) : null}
          <path d="M0 -6 L28 -22 L34 -12 L6 4 Z" fill="rgba(255,255,255,0.9)" />
          <path d="M0 6 L-28 22 L-34 12 L-6 -4 Z" fill="rgba(255,255,255,0.9)" />
        </g>
      </g>
      <circle cx={fanX} cy={fanY} r={12} fill="#2453d8" />
    </g>
  )
}

export function WaterReclamationCenter({
  id,
  name,
  x = 0,
  y = 0,
  width = 360,
  height = 128,
  volume = 0,
}: WaterReclamationCenterProps) {
  const blockWidth = 58
  const blockHeight = 28
  const blockGap = 14
  const totalBlocksWidth = blockWidth * 4 + blockGap * 3
  const firstBlockX = (width - totalBlocksWidth) / 2
  const blockY = height * 0.58

  return (
    <g
      id={id}
      data-object-kind="water-reclamation-center"
      data-fill-volume={volume}
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={14}
        fill="#dcfce7"
        stroke="#2fb36d"
        strokeWidth={5}
      />
      <WaterFill
        x={18}
        y={18}
        width={width - 36}
        height={height - 36}
        volume={volume}
        waterColor="rgba(74, 222, 128, 0.18)"
      />
      <text
        x={width / 2}
        y={34}
        textAnchor="middle"
        fontSize={22}
        fontWeight={900}
        fill="#172033"
        paintOrder="stroke"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={5}
      >
        {name}
      </text>
      {Array.from({ length: 4 }, (_, index) => {
        const blockX = firstBlockX + index * (blockWidth + blockGap)

        return (
          <g key={`${id}-treatment-block-${index}`}>
            {index > 0 ? (
              <line
                x1={blockX - blockGap}
                y1={blockY + blockHeight / 2}
                x2={blockX}
                y2={blockY + blockHeight / 2}
                stroke="#2fb36d"
                strokeWidth={6}
                strokeLinecap="round"
              />
            ) : null}
            <rect
              x={blockX}
              y={blockY}
              width={blockWidth}
              height={blockHeight}
              rx={7}
              fill="#f8fafc"
              stroke="#6ee7a5"
              strokeWidth={3}
            />
          </g>
        )
      })}
    </g>
  )
}

/* eslint-disable react-refresh/only-export-components */
import { WaterFill } from './WaterFill'
import { type FlowDirection, WaterFlow } from './WaterFlow'

export type PipeSize = 'small' | 'medium' | 'large'

export const PIPE_SIZE_PRESETS: Record<
  PipeSize,
  {
    innerThickness: number
    borderThickness: number
    labelSize: number
  }
> = {
  small: {
    innerThickness: 34,
    borderThickness: 6,
    labelSize: 16,
  },
  medium: {
    innerThickness: 70,
    borderThickness: 5,
    labelSize: 24,
  },
  large: {
    innerThickness: 98,
    borderThickness: 6,
    labelSize: 30,
  },
}

export interface PipeProps {
  id: string
  swmmId: string
  name: string
  size: PipeSize
  length: number
  angle: number
  x?: number
  y?: number
  color?: string
  borderColor?: string
  centerLineColor?: string
  velocity?: number
  flowDirection?: FlowDirection
  volume?: number
  fillAngle?: number
  showFlow?: boolean
  showFill?: boolean
  showLabel?: boolean
}

export function Pipe({
  id,
  swmmId,
  name,
  size,
  length,
  angle,
  x = 0,
  y = 0,
  color = '#e9f5ff',
  borderColor = '#1e90ff',
  centerLineColor = 'rgba(100, 116, 139, 0.42)',
  velocity = 0,
  flowDirection = 'forward',
  volume = 0,
  fillAngle = angle,
  showFlow = true,
  showFill = true,
  showLabel = true,
}: PipeProps) {
  const preset = PIPE_SIZE_PRESETS[size]
  const normalizedAngle = ((fillAngle % 360) + 360) % 360
  const isVerticalPipe = Math.abs(normalizedAngle - 90) < 1 || Math.abs(normalizedAngle - 270) < 1
  const fillFrom =
    Math.abs(normalizedAngle - 90) < 1 || Math.abs(normalizedAngle) < 1 ? 'end' : 'start'
  const outerThickness = preset.innerThickness + preset.borderThickness * 2
  const outerX = -length / 2
  const yOffset = -outerThickness / 2
  const innerYOffset = -preset.innerThickness / 2
  const innerX = outerX + preset.borderThickness
  const innerWidth = Math.max(0, length - preset.borderThickness * 2)
  const flowX = outerX + preset.borderThickness * 2
  const flowLength = Math.max(0, length - preset.borderThickness * 4)

  return (
    <g
      id={id}
      data-swmm-id={swmmId}
      data-pipe-size={size}
      data-pipe-angle={angle}
      transform={`translate(${x} ${y}) rotate(${angle})`}
      role="img"
      aria-label={`${name} ${swmmId}`}
    >
      <title>{`${name} / ${swmmId}`}</title>
      <rect
        x={outerX}
        y={yOffset}
        width={length}
        height={outerThickness}
        rx={0}
        fill={borderColor}
      />
      <rect
        x={innerX}
        y={innerYOffset}
        width={innerWidth}
        height={preset.innerThickness}
        rx={0}
        fill={color}
      />
      {showFill ? (
        <WaterFill
          x={innerX}
          y={innerYOffset}
          width={innerWidth}
          height={preset.innerThickness}
          volume={volume}
          fillAxis={isVerticalPipe ? 'length' : 'height'}
          fillFrom={fillFrom}
        />
      ) : null}
      {showFlow ? (
        <WaterFlow
          x={flowX}
          y={0}
          length={flowLength}
          thickness={Math.max(5, preset.innerThickness * 0.12)}
          velocity={velocity}
          direction={flowDirection}
          color={centerLineColor}
        />
      ) : null}
      {showLabel && name ? (
        <text
          x={0}
          y={preset.labelSize * 0.35}
          textAnchor="middle"
          fontSize={preset.labelSize}
          fontWeight={900}
          fill="#172033"
          paintOrder="stroke"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={5}
        >
          {name}
        </text>
      ) : null}
    </g>
  )
}

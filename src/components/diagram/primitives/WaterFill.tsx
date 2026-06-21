export interface WaterFillProps {
  width: number
  height: number
  volume: number
  x?: number
  y?: number
  fillAxis?: 'height' | 'length'
  fillFrom?: 'start' | 'end'
  emptyColor?: string
  waterColor?: string
  warningColor?: string
  fullColor?: string
}

function clampRatio(value: number) {
  const ratio = value > 1 ? value / 100 : value
  return Math.min(1, Math.max(0, ratio))
}

export function WaterFill({
  width,
  height,
  volume,
  x = 0,
  y = 0,
  fillAxis = 'height',
  fillFrom = 'end',
  emptyColor = 'transparent',
  waterColor = 'rgba(56, 189, 248, 0.34)',
  warningColor = 'rgba(251, 146, 60, 0.42)',
  fullColor = 'rgba(239, 68, 68, 0.46)',
}: WaterFillProps) {
  const ratio = clampRatio(volume)
  const fillLength = width * ratio
  const fillHeight = height * ratio
  const isLengthFill = fillAxis === 'length'
  const fillX = isLengthFill && fillFrom === 'end' ? x + width - fillLength : x
  const fillY = isLengthFill ? y : fillFrom === 'start' ? y : y + height - fillHeight
  const visibleWidth = isLengthFill ? fillLength : width
  const visibleHeight = isLengthFill ? height : fillHeight
  const fillColor = ratio >= 0.88 ? fullColor : ratio >= 0.68 ? warningColor : waterColor
  const shouldShowWave = ratio > 0.04 && ratio < 0.96 && visibleHeight > 6 && visibleWidth > 6
  const waveY = fillY + Math.min(5, visibleHeight * 0.3)
  const waveX =
    fillFrom === 'end'
      ? fillX + Math.min(5, visibleWidth * 0.3)
      : fillX + visibleWidth - Math.min(5, visibleWidth * 0.3)

  return (
    <g data-fill-ratio={ratio}>
      <rect x={x} y={y} width={width} height={height} fill={emptyColor} />
      {visibleWidth > 0 && visibleHeight > 0 ? (
        <rect x={fillX} y={fillY} width={visibleWidth} height={visibleHeight} fill={fillColor} />
      ) : null}
      {shouldShowWave && !isLengthFill ? (
        <path
          d={`M${x} ${waveY} C${x + width * 0.08} ${waveY - 4} ${x + width * 0.16} ${
            waveY + 4
          } ${x + width * 0.24} ${waveY} S${x + width * 0.4} ${waveY - 4} ${
            x + width * 0.48
          } ${waveY} S${x + width * 0.64} ${waveY + 4} ${x + width * 0.72} ${waveY} S${
            x + width * 0.9
          } ${waveY - 4} ${x + width} ${waveY}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.42)"
          strokeWidth={Math.max(2, height * 0.035)}
          strokeLinecap="round"
        />
      ) : null}
      {shouldShowWave && isLengthFill ? (
        <path
          d={`M${waveX} ${y} C${waveX - 4} ${y + height * 0.08} ${waveX + 4} ${
            y + height * 0.16
          } ${waveX} ${y + height * 0.24} S${waveX - 4} ${y + height * 0.4} ${waveX} ${
            y + height * 0.48
          } S${waveX + 4} ${y + height * 0.64} ${waveX} ${y + height * 0.72} S${
            waveX - 4
          } ${y + height * 0.9} ${waveX} ${y + height}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.42)"
          strokeWidth={Math.max(2, height * 0.035)}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  )
}

interface SoilBackgroundProps {
  minX: number
  topY: number
  width: number
  height: number
  skyY?: number
  skyHeight?: number
  skyFill?: string
  soilFill?: string
  soilStroke?: string
}

const SOIL_WAVE_WIDTH = 260
const SOIL_WAVE_HEIGHT = 44

/** 편집/시뮬레이션 화면이 공유하는 하늘, 토지, 토양 물결 배경을 렌더링한다. */
export function SoilBackground({
  minX,
  topY,
  width,
  height,
  skyY = 0,
  skyHeight,
  skyFill = '#e8f5ff',
  soilFill = '#a86435',
  soilStroke = '#7c4a26',
}: SoilBackgroundProps) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(0, height)
  const columns = Math.ceil(safeWidth / SOIL_WAVE_WIDTH)
  const rows = Math.ceil(safeHeight / SOIL_WAVE_HEIGHT)

  return (
    <>
      {skyHeight !== undefined ? (
        <rect x={minX} y={skyY} width={safeWidth} height={skyHeight} fill={skyFill} />
      ) : null}
      <rect x={minX} y={topY} width={safeWidth} height={safeHeight} fill={soilFill} />
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        const start = minX + column * SOIL_WAVE_WIDTH
        const baseY = topY + 22 + row * SOIL_WAVE_HEIGHT

        return (
          <path
            key={`soil-wave-${index}`}
            d={`M${start} ${baseY} C${start + 36} ${baseY - 14} ${
              start + 76
            } ${baseY + 14} ${start + 116} ${baseY} S${
              start + 204
            } ${baseY - 14} ${start + SOIL_WAVE_WIDTH} ${baseY}`}
            fill="none"
            stroke="rgba(255,255,255,.14)"
            strokeWidth="3"
          />
        )
      })}
      <line x1={minX} y1={topY} x2={minX + safeWidth} y2={topY} stroke={soilStroke} strokeWidth="4" />
    </>
  )
}

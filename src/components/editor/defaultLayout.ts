import type { EditorLayout, EditorNode, EditorNodeType, EditorPort } from './editorTypes'
import defaultDrainageLayout from '../../data/defaultDrainageLayout.json'

export const EDITOR_CANVAS_WIDTH = 2400
export const EDITOR_CANVAS_HEIGHT = 1180
export const EDITOR_GROUND_SURFACE_Y = 330
export const EDITOR_CONNECTOR_SHORT_SIDE = 46
export const EDITOR_CONNECTOR_LONG_SIDE = 86

const STANDARD_PORTS: EditorPort[] = [
  { id: 'top', side: 'top' },
  { id: 'right', side: 'right' },
  { id: 'bottom', side: 'bottom' },
  { id: 'left', side: 'left' },
]

const LOWER_SIDE_PORT_BOTTOM_GAP = 44

export const EDITOR_NODE_PRESETS: Record<EditorNodeType, { name: string; width: number; height: number; yOffset: number }> = {
  apartment: { name: '아파트', width: 150, height: 160, yOffset: 160 },
  house: { name: '주거지', width: 170, height: 130, yOffset: 130 },
  catchBasin: { name: '빗물받이', width: 170, height: 110, yOffset: 110 },
  manhole: { name: '맨홀', width: 90, height: 190, yOffset: 190 },
  facility: { name: '시설', width: 260, height: 130, yOffset: -320 },
  connector: { name: '커넥터', width: EDITOR_CONNECTOR_SHORT_SIDE, height: EDITOR_CONNECTOR_LONG_SIDE, yOffset: -240 },
  elbowConnector: { name: 'ㄱ자 커넥터', width: 140, height: 140, yOffset: -260 },
  teeConnector: { name: 'T자 커넥터', width: 260, height: 196, yOffset: -260 },
  pipeSegment: { name: '파이프', width: 320, height: 80, yOffset: -260 },
  outfall: { name: '방류구', width: 200, height: 130, yOffset: -320 },
  road: { name: '도로', width: 720, height: 120, yOffset: 120 },
  terrain: { name: '땅', width: 560, height: 300, yOffset: -360 },
}

/** 노드 유형별 기본 포트 목록을 만든다. */
export function createEditorPorts(type: EditorNodeType, _width: number, height: number): EditorPort[] {
  if (type === 'road' || type === 'terrain') {
    return []
  }

  if (type === 'elbowConnector') {
    return [
      { id: 'left', side: 'left' },
      { id: 'bottom', side: 'bottom' },
    ]
  }

  if (type === 'teeConnector') {
    return [
      { id: 'top', side: 'top' },
      { id: 'right', side: 'right' },
      { id: 'left', side: 'left' },
      { id: 'center', side: 'center' },
    ]
  }

  if (type === 'apartment' || type === 'house' || type === 'manhole') {
    const sideOffset = Math.max(height / 2, height - LOWER_SIDE_PORT_BOTTOM_GAP)

    return [
      { id: 'top', side: 'top' },
      { id: 'right', side: 'right', offset: sideOffset },
      { id: 'bottom', side: 'bottom' },
      { id: 'left', side: 'left', offset: sideOffset },
    ]
  }

  return STANDARD_PORTS.map((port) => ({ ...port }))
}

/** 파일에 포함된 기본 배수도 JSON을 새 객체로 복제해 반환한다. */
export function createDefaultEditorLayout(): EditorLayout {
  return structuredClone(defaultDrainageLayout) as EditorLayout
}

/** 우클릭 추가 메뉴에서 사용할 새 편집 노드를 기본 크기/위치/props로 생성한다. */
export function createEditorNode(type: EditorNodeType, index: number, groundSurfaceY: number): EditorNode {
  const preset = EDITOR_NODE_PRESETS[type]
  const id = `${type}_${Date.now()}_${index}`

  return {
    id,
    swmmId: id,
    name: `${preset.name} ${index}`,
    type,
    x: 140 + index * 36,
    y: type === 'road'
      ? groundSurfaceY - preset.height
      : type === 'connector' || type === 'elbowConnector' || type === 'teeConnector' || type === 'facility' || type === 'pipeSegment' || type === 'outfall' || type === 'terrain'
      ? groundSurfaceY + Math.abs(preset.yOffset)
      : groundSurfaceY - preset.yOffset,
    width: preset.width,
    height: preset.height,
    ports: createEditorPorts(type, preset.width, preset.height),
    props: type === 'elbowConnector' || type === 'teeConnector'
      ? { size: 'medium', rotation: 0, pipeKind: 'storm' }
      : type === 'connector' || type === 'pipeSegment'
        ? { size: 'medium', pipeKind: 'storm' }
      : type === 'facility'
        ? { facilityKind: 'generic' }
        : type === 'outfall'
          ? { outfallKind: 'generic' }
          : type === 'manhole'
            ? { manholeKind: 'storm' }
            : type === 'terrain'
              ? { terrainKind: 'ground' }
          : {},
  }
}

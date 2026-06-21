import type {
  EditorLink,
  EditorLinkType,
  EditorNodeType,
  EditorPipeSize,
  EditorPort,
} from './editorTypes'

/** 편집 가능한 파이프 크기별 내부 시각 두께다. */
export const PIPE_THICKNESS: Record<EditorPipeSize, number> = {
  small: 34,
  medium: 70,
  large: 98,
}

/** 편집 가능한 파이프 크기별 외곽선 두께다. */
export const PIPE_BORDER: Record<EditorPipeSize, number> = {
  small: 6,
  medium: 5,
  large: 6,
}

/** 파이프 내부 흐름 화살표 사이의 목표 간격이다. */
export const PIPE_FLOW_ARROW_SPACING = 92

/** 단일 파이프 안에 그릴 흐름 화살표 개수의 상한이다. */
export const PIPE_FLOW_ARROW_MAX_COUNT = 12

/** 파이프 캡과 첫/마지막 흐름 화살표 사이에 유지할 여백이다. */
export const PIPE_FLOW_ARROW_EDGE_PADDING = 22

/** 편집기 파이프 크기 선택기에 표시할 한국어 라벨이다. */
export const PIPE_SIZE_LABELS: Record<EditorPipeSize, string> = {
  small: '소',
  medium: '중',
  large: '대',
}

/** 렌더링과 JSON props에서 사용하는 관종 분류다. */
export const PIPE_KIND_DEFINITIONS = [
  { id: 'storm', label: '우수' },
  { id: 'sewer', label: '오수' },
  { id: 'combined', label: '합류수' },
  { id: 'overflow', label: '월류수' },
  { id: 'treated', label: '처리수' },
] as const

export type EditorPipeKind = typeof PIPE_KIND_DEFINITIONS[number]['id']
export type EditorWaterType = EditorPipeKind | 'default'

/** 새로 생성하는 편집 파이프의 기본 관종이다. */
export const DEFAULT_PIPE_KIND: EditorPipeKind = 'storm'

/** 선택기 렌더링에 사용하는 안정적인 관종 ID 목록이다. */
export const PIPE_KIND_OPTIONS: EditorPipeKind[] = PIPE_KIND_DEFINITIONS.map((definition) => definition.id)

/** 저장되는 관종 ID를 키로 갖는 표시 라벨이다. */
export const PIPE_KIND_LABELS: Record<EditorPipeKind, string> = Object.fromEntries(
  PIPE_KIND_DEFINITIONS.map((definition) => [definition.id, definition.label]),
) as Record<EditorPipeKind, string>

/** 저장되는 관종 ID로 전체 관종 정의를 찾는 lookup이다. */
export const PIPE_KIND_BY_ID = Object.fromEntries(
  PIPE_KIND_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<EditorPipeKind, typeof PIPE_KIND_DEFINITIONS[number]>

/** 객체 상세 선택기에 표시할 시설 preset 목록이다. */
export const FACILITY_KIND_DEFINITIONS = [
  {
    id: 'generic',
    label: '일반 시설',
    nodeName: '시설',
    width: 260,
    height: 130,
    fill: '#e2e8f0',
    stroke: '#64748b',
    waterKind: 'default',
  },
  {
    id: 'overflowChamber',
    label: '우수토실-월류시설',
    nodeName: '우수토실-월류시설',
    width: 360,
    height: 170,
    fill: '#d8dde3',
    stroke: '#475467',
    waterKind: 'combined',
  },
  {
    id: 'stormPumpStation',
    label: '빗물펌프장',
    nodeName: '빗물펌프장',
    width: 330,
    height: 140,
    fill: '#dbeafe',
    stroke: '#2f8df4',
    waterKind: 'storm',
  },
  {
    id: 'waterReclamationCenter',
    label: '물재생센터',
    nodeName: '물재생센터',
    width: 330,
    height: 130,
    fill: '#d8f8dd',
    stroke: '#2f9e5b',
    waterKind: 'treated',
  },
] as const

export type EditorFacilityKind = typeof FACILITY_KIND_DEFINITIONS[number]['id']

/** 일반 시설을 만들 때 사용하는 기본 시설 preset이다. */
export const DEFAULT_FACILITY_KIND: EditorFacilityKind = 'generic'

/** 선택기 렌더링에 사용하는 안정적인 시설 preset ID 목록이다. */
export const FACILITY_KIND_OPTIONS: EditorFacilityKind[] = FACILITY_KIND_DEFINITIONS.map((definition) => definition.id)

/** 저장되는 시설 preset ID를 키로 갖는 표시 라벨이다. */
export const FACILITY_KIND_LABELS: Record<EditorFacilityKind, string> = Object.fromEntries(
  FACILITY_KIND_DEFINITIONS.map((definition) => [definition.id, definition.label]),
) as Record<EditorFacilityKind, string>

/** 저장되는 시설 preset ID로 전체 시설 정의를 찾는 lookup이다. */
export const FACILITY_KIND_BY_ID = Object.fromEntries(
  FACILITY_KIND_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<EditorFacilityKind, typeof FACILITY_KIND_DEFINITIONS[number]>

/** 객체 상세 선택기에 표시할 방류구 시각 preset 목록이다. */
export const OUTFALL_KIND_DEFINITIONS = [
  {
    id: 'generic',
    label: '방류구',
    nodeName: '방류구',
    width: 200,
    height: 130,
    fill: '#d8fbfb',
    stroke: '#118c94',
    waterKind: 'default',
  },
  {
    id: 'overflowOutfall',
    label: '월류 방류구',
    nodeName: '월류 방류구',
    width: 220,
    height: 140,
    fill: '#d8fbfb',
    stroke: '#118c94',
    waterKind: 'overflow',
  },
  {
    id: 'pumpOutfall',
    label: '펌프 방류구',
    nodeName: '펌프 방류구',
    width: 220,
    height: 140,
    fill: '#d8fbfb',
    stroke: '#118c94',
    waterKind: 'storm',
  },
  {
    id: 'treatedOutfall',
    label: '처리수 방류구',
    nodeName: '처리수 방류구',
    width: 220,
    height: 140,
    fill: '#d8fbfb',
    stroke: '#118c94',
    waterKind: 'treated',
  },
] as const

export type EditorOutfallKind = typeof OUTFALL_KIND_DEFINITIONS[number]['id']

/** 방류구를 만들 때 사용하는 기본 preset이다. */
export const DEFAULT_OUTFALL_KIND: EditorOutfallKind = 'generic'

/** 선택기 렌더링에 사용하는 안정적인 방류구 preset ID 목록이다. */
export const OUTFALL_KIND_OPTIONS: EditorOutfallKind[] = OUTFALL_KIND_DEFINITIONS.map((definition) => definition.id)

/** 저장되는 방류구 preset ID를 키로 갖는 표시 라벨이다. */
export const OUTFALL_KIND_LABELS: Record<EditorOutfallKind, string> = Object.fromEntries(
  OUTFALL_KIND_DEFINITIONS.map((definition) => [definition.id, definition.label]),
) as Record<EditorOutfallKind, string>

/** 저장되는 방류구 preset ID로 전체 방류구 정의를 찾는 lookup이다. */
export const OUTFALL_KIND_BY_ID = Object.fromEntries(
  OUTFALL_KIND_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<EditorOutfallKind, typeof OUTFALL_KIND_DEFINITIONS[number]>

/** 맨홀 종류 preset이다. 독립 SWMM node class가 아니라 UI 시각 분류다. */
export const MANHOLE_KIND_DEFINITIONS = [
  {
    id: 'storm',
    label: '우수',
    nodeName: '우수 맨홀',
    fill: '#bcc5cc',
    stroke: '#2f8df4',
    waterKind: 'storm',
  },
  {
    id: 'sewer',
    label: '오수',
    nodeName: '오수 맨홀',
    fill: '#c7b299',
    stroke: '#a4672b',
    waterKind: 'sewer',
  },
  {
    id: 'combined',
    label: '합류식',
    nodeName: '합류식 맨홀',
    fill: '#c9c2d6',
    stroke: '#7657d7',
    waterKind: 'combined',
  },
] as const

export type EditorManholeKind = typeof MANHOLE_KIND_DEFINITIONS[number]['id']

/** 맨홀을 만들 때 사용하는 기본 맨홀 종류다. */
export const DEFAULT_MANHOLE_KIND: EditorManholeKind = 'storm'

/** 선택기 렌더링에 사용하는 안정적인 맨홀 종류 ID 목록이다. */
export const MANHOLE_KIND_OPTIONS: EditorManholeKind[] = MANHOLE_KIND_DEFINITIONS.map((definition) => definition.id)

/** 저장되는 맨홀 종류 ID를 키로 갖는 표시 라벨이다. */
export const MANHOLE_KIND_LABELS: Record<EditorManholeKind, string> = Object.fromEntries(
  MANHOLE_KIND_DEFINITIONS.map((definition) => [definition.id, definition.label]),
) as Record<EditorManholeKind, string>

/** 저장되는 맨홀 종류 ID로 전체 맨홀 정의를 찾는 lookup이다. */
export const MANHOLE_KIND_BY_ID = Object.fromEntries(
  MANHOLE_KIND_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<EditorManholeKind, typeof MANHOLE_KIND_DEFINITIONS[number]>

/** 체인형 레이아웃 편집기에서 사용하는 지형 세그먼트 preset이다. */
export const TERRAIN_KIND_DEFINITIONS = [
  {
    id: 'ground',
    label: '땅',
    nodeName: '땅',
    fill: '#a86435',
    stroke: '#7c4a26',
    waveStroke: 'rgba(255,255,255,.14)',
  },
  {
    id: 'river',
    label: '하천',
    nodeName: '하천',
    fill: '#7fcdf2',
    stroke: '#0f75bc',
    waveStroke: 'rgba(255,255,255,.45)',
  },
  {
    id: 'sea',
    label: '바다',
    nodeName: '바다',
    fill: '#60a5fa',
    stroke: '#1d4ed8',
    waveStroke: 'rgba(255,255,255,.38)',
  },
] as const

export type EditorTerrainKind = typeof TERRAIN_KIND_DEFINITIONS[number]['id']
export type LayoutAddKind = EditorTerrainKind

/** 새 레이아웃 세그먼트의 기본 지형 종류다. */
export const DEFAULT_TERRAIN_KIND: EditorTerrainKind = 'ground'

/** 선택기 렌더링에 사용하는 안정적인 지형 종류 ID 목록이다. */
export const TERRAIN_KIND_OPTIONS: EditorTerrainKind[] = TERRAIN_KIND_DEFINITIONS.map((definition) => definition.id)

/** 저장되는 지형 종류 ID를 키로 갖는 표시 라벨이다. */
export const TERRAIN_KIND_LABELS: Record<EditorTerrainKind, string> = Object.fromEntries(
  TERRAIN_KIND_DEFINITIONS.map((definition) => [definition.id, definition.label]),
) as Record<EditorTerrainKind, string>

/** 저장되는 지형 종류 ID로 전체 지형 정의를 찾는 lookup이다. */
export const TERRAIN_KIND_BY_ID = Object.fromEntries(
  TERRAIN_KIND_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<EditorTerrainKind, typeof TERRAIN_KIND_DEFINITIONS[number]>

/** 레이아웃 + 핸들에서 체인으로 추가할 수 있는 지형 종류다. */
export const LAYOUT_ADD_KIND_OPTIONS: LayoutAddKind[] = ['ground', 'river', 'sea']

/** 지형 체인 삽입 메뉴에 표시할 라벨이다. */
export const LAYOUT_ADD_KIND_LABELS: Record<LayoutAddKind, string> = {
  ground: '땅',
  river: '하천',
  sea: '바다',
}

/** 기존 HTML 배수도 관 ID를 단순화된 편집기 관종으로 매핑한다. */
export const LEGACY_PIPE_KIND_TO_KIND: Record<string, EditorPipeKind> = {
  sep_sewer_lateral_apartment_1: 'sewer',
  sep_sewer_lateral_apartment_2: 'sewer',
  sep_storm_lateral_catch_basin_1: 'storm',
  sep_storm_lateral_catch_basin_2: 'storm',
  sep_storm_trunk: 'storm',
  sep_interceptor: 'sewer',
  sep_storm_main_1: 'storm',
  sep_storm_main_2: 'storm',
  sep_storm_main_to_trunk: 'storm',
  sep_sewer_main_1: 'sewer',
  sep_sewer_main_2: 'sewer',
  sep_sewer_main_to_interceptor: 'sewer',
  storm_pump_discharge_pipe: 'storm',
  treatment_effluent_pipe: 'treated',
  comb_sewer_lateral_house_1: 'sewer',
  comb_sewer_lateral_house_2: 'sewer',
  comb_storm_lateral_catch_basin_1: 'storm',
  comb_main_1: 'combined',
  comb_main_2: 'combined',
  overflow_to_interceptor_drop: 'combined',
  overflow_pipe: 'overflow',
  comb_storm_lateral_catch_basin_2: 'storm',
}

/** 관종별 파이프 색상 팔레트다. */
export const PIPE_COLORS: Record<EditorWaterType, { fill: string; stroke: string; center: string; water: string }> = {
  storm: { fill: '#c7e3ff', stroke: '#0f5fc7', center: 'rgba(15, 95, 199, .32)', water: 'rgba(56, 189, 248, .50)' },
  sewer: { fill: '#fff4e3', stroke: '#a4672b', center: 'rgba(164, 103, 43, .34)', water: 'rgba(180, 112, 42, .30)' },
  combined: { fill: '#f5f1ff', stroke: '#7657d7', center: 'rgba(118, 87, 215, .34)', water: 'rgba(139, 92, 246, .28)' },
  overflow: { fill: '#e8d9d7', stroke: '#a54f4f', center: 'rgba(165, 79, 79, .34)', water: 'rgba(239, 68, 68, .26)' },
  treated: { fill: '#d4ded6', stroke: '#51936b', center: 'rgba(81, 147, 107, .34)', water: 'rgba(34, 197, 94, .25)' },
  default: { fill: '#e2e8f0', stroke: '#475467', center: 'rgba(100, 116, 139, .42)', water: 'rgba(125, 211, 252, .42)' },
}

/** 보이는 파이프 두께 대비 커넥터 캡 길이 비율이다. */
export const CONNECTOR_LONG_SIDE_RATIO = 1.1

/** 보이는 파이프 두께 대비 커넥터 캡 폭 비율이다. */
export const CONNECTOR_SHORT_SIDE_RATIO = 0.5

/** 파이프 세그먼트 노드의 최소 시각 길이다. */
export const MIN_PIPE_SEGMENT_LENGTH = 56

/** resize나 전파 후 맨홀 노드가 유지해야 하는 최소 시각 높이다. */
export const MIN_MANHOLE_HEIGHT = 130

/** 도로 노드의 최소 폭이다. */
export const MIN_ROAD_WIDTH = 180

/** 체인 지형 세그먼트의 최소 폭이다. */
export const MIN_TERRAIN_WIDTH = 140

/** 체인 지형 세그먼트의 최소 높이다. */
export const MIN_TERRAIN_HEIGHT = 80

/** 지형 체인 삽입용 + 핸들의 보이는 크기다. */
export const LAYOUT_ADD_HANDLE_SIZE = 28

/** 도로 SVG 렌더러에서 사용하는 차선 점선 간격이다. */
export const ROAD_DASH_SPACING = 90

/** resize border 주변의 보이지 않는 hit 여백이다. */
export const RESIZE_BORDER_HIT_SIZE = 22

/** 일반 편집 노드 오른쪽에 유지할 추가 캔버스 여백이다. */
export const CANVAS_RIGHT_PADDING = 240

/** 일반 편집 노드 아래에 유지할 추가 캔버스 여백이다. */
export const CANVAS_BOTTOM_PADDING = 180

/** 메모리에 유지할 undo history 최대 개수다. */
export const LAYOUT_HISTORY_LIMIT = 80

/** 건물/맨홀이 옆 하단 포트로 attach될 때 사용하는 하단 오프셋이다. */
export const LOWER_SIDE_PORT_BOTTOM_GAP = 44

/** 포트 hit test에 사용하는 반경이다. */
export const PORT_HIT_RADIUS = 9

/** 일반 포트 점의 보이는 반경이다. */
export const PORT_DOT_RADIUS = 7

/** 선택되거나 연결된 포트 점의 halo 반경이다. */
export const PORT_HALO_RADIUS = 11

/** attach 대기 대상 포트 점의 보이는 반경이다. */
export const PENDING_PORT_DOT_RADIUS = 6

/** attach 대기 대상 포트 점의 halo 반경이다. */
export const PENDING_PORT_HALO_RADIUS = 10

/** 시설 계열 노드에 렌더링할 tap 퍼센트 위치다. */
export const FACILITY_TAP_PORT_PERCENTAGES = [25, 50, 75] as const

/** relation attach metadata의 기본 중앙 tap 퍼센트다. */
export const ATTACH_TAP_CENTER_PERCENTAGE = 50

/** 저장되는 tap ratio 값의 하한이다. */
export const ATTACH_TAP_MIN_PERCENTAGE = 0.01

/** 저장되는 tap ratio 값의 상한이다. */
export const ATTACH_TAP_MAX_PERCENTAGE = 99.99

/** 동적 파이프 tap 포트 사이의 목표 간격이다. */
export const PIPE_TAP_TARGET_SPACING = 120

/** 한쪽 면에 만들 동적 파이프 tap 포트 개수의 상한이다. */
export const PIPE_TAP_MAX_PORT_COUNT = 25

/** relation 방향 화살표의 최소 렌더링 크기다. */
export const RELATION_ARROW_MIN_SIZE = 5

/** relation 방향 화살표의 최대 렌더링 크기다. */
export const RELATION_ARROW_MAX_SIZE = 12

/** attach anchor가 resize edge를 제한할 때 사용하는 여백이다. */
export const ATTACH_ANCHOR_RESIZE_MARGIN = 2

/** attach-anchor resize 경계 판정에 사용하는 좌표 오차 허용값이다. */
export const ATTACH_ANCHOR_EDGE_EPSILON = 2

/** 고정 branch 상황에서 resize edge가 parent-side attach anchor를 지나치지 않게 하는 규칙 스위치다. */
export const ENABLE_ATTACH_ANCHOR_RESIZE_GUARD = true

/** 고정 y vertical pipe branch의 top resize를 bottom 기준 resize처럼 보정하는 규칙 스위치다. */
export const ENABLE_FIXED_Y_VERTICAL_TOP_RESIZE_AS_BOTTOM_RULE = true

/** 파이프/맨홀 직접 resize 기본 규칙을 켜는 스위치다. */
export const ENABLE_BASIC_PIPE_MANHOLE_RESIZE_RULE = true

/** attach, drag, resize 이후 표준 parent-to-child 전파를 켜는 스위치다. */
export const ENABLE_PARENT_CHILD_PROPAGATION_RULE = true

/** 다중 parent를 가진 child endpoint의 역방향 보정을 켜는 스위치다. */
export const ENABLE_REVERSE_PARENT_PROPAGATION_RULE = true

/** 편집 패널 제어에서 사용하는 SWMM 엔진 URL이다. */
export const SWMM_ENGINE_URL = import.meta.env.VITE_SWMM_ENGINE_URL ?? 'http://127.0.0.1:8765'

/** attach-anchor resize 보호를 활성화할 수 있는 고정 branch root 타입이다. */
export const ATTACH_ANCHOR_GUARD_FIXED_BRANCH_TYPES = new Set<EditorNodeType>([
  'apartment',
  'house',
  'catchBasin',
])

/** 커스텀 기준선을 가진 fixed-y 노드 타입의 고정 Y 위치다. */
export const FIXED_NODE_Y_BY_TYPE: Partial<Record<EditorNodeType, number>> = {
  catchBasin: 327,
  manhole: 323,
}

/** 편집기 노드 타입별 한국어 표시 라벨이다. */
export const NODE_LABELS: Record<EditorNodeType, string> = {
  apartment: '아파트',
  house: '집',
  catchBasin: '빗물받이',
  manhole: '맨홀',
  facility: '시설',
  connector: '커넥터',
  elbowConnector: 'ㄱ자 커넥터',
  teeConnector: 'T자 커넥터',
  pipeSegment: '파이프',
  outfall: '방류구',
  road: '도로',
  terrain: '레이아웃',
}

/** 좌측/우클릭 메뉴의 노드 생성 항목이다. 세부 종류 선택은 오른쪽 패널에서 한다. */
export const NODE_BUTTONS: EditorNodeType[] = [
  'facility',
  'connector',
]

/** 시설 계열 노드를 생성/선택한 뒤 표시할 세부 종류 선택 옵션이다. */
export const FACILITY_TYPE_OPTIONS: EditorNodeType[] = ['facility', 'catchBasin', 'manhole', 'house', 'apartment', 'outfall', 'road']

/** 커넥터 계열 노드를 생성/선택한 뒤 표시할 세부 종류 선택 옵션이다. */
export const CONNECTOR_TYPE_OPTIONS: EditorNodeType[] = ['connector', 'elbowConnector', 'teeConnector']

/** 편집기 JSON 호환성을 위해 유지하는 링크 타입 옵션이다. */
export const LINK_TYPE_OPTIONS: EditorLinkType[] = ['relation', 'pipe', 'elbowPipe', 'connector', 'pump', 'weir', 'outfall']

/** 파이프 크기 선택 옵션이다. */
export const PIPE_SIZE_OPTIONS: EditorPipeSize[] = ['small', 'medium', 'large']

/** 편집기 JSON 호환성을 위해 유지하는 route 옵션이다. */
export const LINK_ROUTE_OPTIONS: EditorLink['props']['route'][] = ['straight', 'elbow']

/** 일반 커넥터 노드가 사용하는 상하좌우 기본 포트다. */
export const CONNECTOR_PORTS: EditorPort[] = [
  { id: 'top', side: 'top' },
  { id: 'right', side: 'right' },
  { id: 'bottom', side: 'bottom' },
  { id: 'left', side: 'left' },
]

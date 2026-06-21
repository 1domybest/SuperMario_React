import type { EditorLayout } from '../../components/editor/editorTypes'

export interface SwmmEngineControl {
  rainfallRatio: number
  blockagesById: Record<string, number>
  maxRainfallMmPerHour?: number
  speedMultiplier?: number
}

export interface SwmmEngineStatus {
  ok: boolean
  running: boolean
  paused: boolean
  hasSession: boolean
  stepIndex: number
  stepSeconds: number
  modelTime: string | null
  websocketClients: number
  lastError: string | null
  runId?: string | null
  tickLogPath?: string | null
  lastLogError?: string | null
  control: {
    rainfallRatio: number
    rainfallPercent: number
    blockagesById: Record<string, number>
    maxRainfallMmPerHour: number
    speedMultiplier: number
  }
}

export interface SwmmRealtimeSnapshot {
  type: string
  ok: boolean
  sourceOfTruth: 'SWMM'
  runId?: string
  tickLogPath?: string
  source: string
  modelPath: string
  runtimeModelPath: string
  modelTime: string | null
  stepSeconds: number
  stepIndex: number
  control: SwmmEngineStatus['control']
  nodes: Record<string, {
    depthM: number
    headM: number
    invertElevationM: number
    depthRatio: number
    totalInflowCms: number
    floodingCms: number
  }>
  links: Record<string, {
    kind: string
    flowCms: number
    velocityMps: number
    depthM: number
    fullness: number
    capacityCms: number
    capacityRatio: number
    direction: 'forward' | 'reverse'
    targetSetting: number
    currentSetting: number
    blockageRatio: number
  }>
  editorObjects: Record<string, {
    maxDepthRatio?: number
    maxFullness?: number
    maxCapacityRatio?: number
    maxBlockageRatio?: number
    maxFloodingCms?: number
    flowCms?: number
    maxVelocityMps?: number
    totalInflowCms?: number
  }>
  summary: {
    nodeCount: number
    linkCount: number
    rainfallTargetCount: number
    blockageTargetCount: number
    activeBlockageCount: number
  }
}

export interface SwmmRuntimeStartResponse {
  ok: boolean
  running: boolean
  status: SwmmEngineStatus
  report: unknown
  mapping: unknown
  snapshot: SwmmRealtimeSnapshot
}

export function getSwmmWebSocketUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/simulation'
  url.search = ''
  url.hash = ''
  return url.toString()
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { detail?: unknown; message?: string } | T | null
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : undefined
    const message = typeof detail === 'string'
      ? detail
      : payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : `SWMM 엔진 요청이 실패했습니다. (${response.status})`
    throw new Error(message)
  }
  if (!payload) {
    throw new Error('SWMM 엔진 응답이 비어 있습니다.')
  }
  return payload as T
}

export async function getSwmmEngineStatus(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/status`)
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function startSwmmEngine(
  baseUrl: string,
  layout: EditorLayout,
  control: SwmmEngineControl,
): Promise<SwmmRuntimeStartResponse> {
  const response = await fetch(`${baseUrl}/engine/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      layout,
      stepSeconds: 1,
      control,
    }),
  })
  return parseJsonResponse<SwmmRuntimeStartResponse>(response)
}

export async function stopSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/stop`, { method: 'POST' })
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function pauseSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/pause`, { method: 'POST' })
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function resumeSwmmEngine(baseUrl: string): Promise<SwmmEngineStatus> {
  const response = await fetch(`${baseUrl}/engine/resume`, { method: 'POST' })
  return parseJsonResponse<SwmmEngineStatus>(response)
}

export async function resetSwmmEngine(
  baseUrl: string,
  layout: EditorLayout,
  control: SwmmEngineControl,
): Promise<SwmmRuntimeStartResponse> {
  const response = await fetch(`${baseUrl}/engine/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      layout,
      stepSeconds: 1,
      control,
    }),
  })
  return parseJsonResponse<SwmmRuntimeStartResponse>(response)
}

export async function updateSwmmEngineControl(
  baseUrl: string,
  control: SwmmEngineControl,
): Promise<{ ok: boolean; control: SwmmEngineStatus['control']; snapshot: SwmmRealtimeSnapshot }> {
  const response = await fetch(`${baseUrl}/engine/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(control),
  })
  return parseJsonResponse(response)
}

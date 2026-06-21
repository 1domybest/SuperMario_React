import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDefaultEditorLayout } from '../editor/defaultLayout'
import { PIPE_KIND_LABELS, SWMM_ENGINE_URL } from '../editor/editorDefinitions'
import { normalizeRelationAttachments } from '../editor/EditorCanvas'
import { getNodePipeKind } from '../editor/editorNodeHelpers'
import { isEditorLayout, loadEditorLayout, saveEditorLayout } from '../editor/layoutStorage'
import type { EditorLayout } from '../editor/editorTypes'
import {
  getSwmmEngineStatus,
  getSwmmWebSocketUrl,
  pauseSwmmEngine,
  resetSwmmEngine,
  resumeSwmmEngine,
  startSwmmEngine,
  stopSwmmEngine,
  updateSwmmEngineControl,
  type SwmmEngineStatus,
  type SwmmRealtimeSnapshot,
} from '../../services/swmm/client'
import {
  asSwmmRuntimeMapping,
  buildSwmmRuntimeControl,
  clampPercent,
  clampRainfallPercent,
  isRealtimeSnapshot,
  isRecordValue,
  numericControlValue,
  type SwmmRuntimeMapping,
} from '../../services/swmm/editorRuntime'
import { SimulationLayoutPreview } from './SimulationLayoutPreview'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'

interface RuntimeReport {
  ok: boolean
  counts: Record<string, number>
  warnings: string[]
  errors: string[]
  dynamicControls?: {
    rainfallTargets?: string[]
    blockageTargets?: Array<{
      swmmLinkId: string
      sourceEditorId?: string
      sourceEditorName?: string
      pipeKind?: string
    }>
  }
}

type BlockageTarget = NonNullable<NonNullable<RuntimeReport['dynamicControls']>['blockageTargets']>[number]

type SimulationLayoutSource = 'localStorage' | 'default'

interface LoadedSimulationLayout {
  layout: EditorLayout
  source: SimulationLayoutSource
}

const SIMULATION_SPEED_OPTIONS = [1, 2, 3, 4, 10] as const
const MAX_RAINFALL_PERCENT = 100000

const NODE_TYPE_LABELS: Record<string, string> = {
  apartment: '아파트',
  catchBasin: '빗물받이',
  connector: '커넥터',
  elbowConnector: 'ㄱ자 커넥터',
  facility: '시설',
  house: '주거지',
  manhole: '맨홀',
  outfall: '방류구',
  pipeSegment: '관',
  road: '도로',
  teeConnector: 'T자 커넥터',
  terrain: '지형',
}

function loadSavedLayout(): LoadedSimulationLayout {
  const savedLayout = loadEditorLayout()
  if (savedLayout) {
    return {
      layout: savedLayout,
      source: 'localStorage',
    }
  }

  return {
    layout: createDefaultEditorLayout(),
    source: 'default',
  }
}

function formatNumber(value: number | undefined, digits = 3) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return value.toFixed(digits)
}

function formatPrecisePercent(value: number | undefined, digits = 2) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${(value * 100).toFixed(digits)}%`
}

function formatPercentWithDetail(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${Math.round(value * 100)}% (${(value * 100).toFixed(2)}%)`
}

function getNodeTypeLabel(type: string) {
  return NODE_TYPE_LABELS[type] ?? type
}

function runtimeReportFromUnknown(value: unknown): RuntimeReport | null {
  if (!isRecordValue(value) || !isRecordValue(value.counts)) {
    return null
  }
  return {
    ok: Boolean(value.ok),
    counts: Object.fromEntries(
      Object.entries(value.counts).map(([key, entryValue]) => [key, numericControlValue(entryValue)]),
    ),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : [],
    errors: Array.isArray(value.errors) ? value.errors.map(String) : [],
    dynamicControls: isRecordValue(value.dynamicControls)
      ? {
        rainfallTargets: Array.isArray(value.dynamicControls.rainfallTargets)
          ? value.dynamicControls.rainfallTargets.map(String)
          : [],
        blockageTargets: Array.isArray(value.dynamicControls.blockageTargets)
          ? value.dynamicControls.blockageTargets
            .filter(isRecordValue)
            .map((target) => ({
              swmmLinkId: String(target.swmmLinkId ?? ''),
              sourceEditorId: target.sourceEditorId === undefined ? undefined : String(target.sourceEditorId),
              sourceEditorName: target.sourceEditorName === undefined ? undefined : String(target.sourceEditorName),
              pipeKind: target.pipeKind === undefined ? undefined : String(target.pipeKind),
            }))
            .filter((target) => target.swmmLinkId)
          : [],
      }
      : undefined,
  }
}

function mergeEditorBlockagesIntoSwmmBlockages(
  manualBlockagesById: Record<string, number>,
  manualBlockagesByEditorId: Record<string, number>,
  blockageTargets: BlockageTarget[],
) {
  const next: Record<string, number> = { ...manualBlockagesById }

  blockageTargets.forEach((target) => {
    if (!target.sourceEditorId) {
      return
    }
    const editorBlockage = manualBlockagesByEditorId[target.sourceEditorId]
    if (editorBlockage === undefined) {
      return
    }
    const blockage = clampPercent(editorBlockage)
    if (blockage > 0) {
      next[target.swmmLinkId] = blockage
    } else {
      delete next[target.swmmLinkId]
    }
  })

  return next
}

function statusFromSocketPayload(payload: Record<string, unknown>, currentStatus: SwmmEngineStatus | null): SwmmEngineStatus {
  const payloadControl = isRecordValue(payload.control) ? payload.control : null
  const fallbackControl = currentStatus?.control ?? {
    rainfallRatio: 0,
    rainfallPercent: 0,
    blockagesById: {},
    maxRainfallMmPerHour: 100,
    speedMultiplier: 1,
  }

  return {
    ok: true,
    running: Boolean(payload.running),
    paused: Boolean(payload.paused),
    hasSession: Boolean(payload.hasSession),
    stepIndex: numericControlValue(payload.stepIndex),
    stepSeconds: numericControlValue(payload.stepSeconds) || 1,
    modelTime: typeof payload.modelTime === 'string' ? payload.modelTime : null,
    websocketClients: numericControlValue(payload.websocketClients),
    lastError: typeof payload.lastError === 'string' ? payload.lastError : null,
    runId: typeof payload.runId === 'string' ? payload.runId : currentStatus?.runId ?? null,
    tickLogPath: typeof payload.tickLogPath === 'string' ? payload.tickLogPath : currentStatus?.tickLogPath ?? null,
    lastLogError: typeof payload.lastLogError === 'string' ? payload.lastLogError : currentStatus?.lastLogError ?? null,
    control: {
      rainfallRatio: payloadControl ? numericControlValue(payloadControl.rainfallRatio) : fallbackControl.rainfallRatio,
      rainfallPercent: payloadControl ? numericControlValue(payloadControl.rainfallPercent) : fallbackControl.rainfallPercent,
      blockagesById: isRecordValue(payloadControl?.blockagesById)
        ? Object.fromEntries(
          Object.entries(payloadControl.blockagesById).map(([key, value]) => [key, numericControlValue(value)]),
        )
        : fallbackControl.blockagesById,
      maxRainfallMmPerHour: payloadControl
        ? numericControlValue(payloadControl.maxRainfallMmPerHour) || fallbackControl.maxRainfallMmPerHour
        : fallbackControl.maxRainfallMmPerHour,
      speedMultiplier: payloadControl
        ? numericControlValue(payloadControl.speedMultiplier) || fallbackControl.speedMultiplier
        : fallbackControl.speedMultiplier,
    },
  }
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="runtime-stat-cell rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-black uppercase text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-black text-slate-800">{value}</div>
    </div>
  )
}

export function SimulationWorkbench({ theme = 'light' }: { theme?: WorkbenchTheme }) {
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]
  const [loadedLayout, setLoadedLayout] = useState<LoadedSimulationLayout>(() => loadSavedLayout())
  const [status, setStatus] = useState<SwmmEngineStatus | null>(null)
  const [snapshot, setSnapshot] = useState<SwmmRealtimeSnapshot | null>(null)
  const [runtimeMapping, setRuntimeMapping] = useState<SwmmRuntimeMapping | null>(null)
  const [runtimeReport, setRuntimeReport] = useState<RuntimeReport | null>(null)
  const [rainfallPercent, setRainfallPercent] = useState(0)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false)
  const [selectedBlockageId, setSelectedBlockageId] = useState('')
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState('')
  const [manualBlockagesById, setManualBlockagesById] = useState<Record<string, number>>({})
  const [manualBlockagesByEditorId, setManualBlockagesByEditorId] = useState<Record<string, number>>({})
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const autoApplyTimerRef = useRef<number | null>(null)
  const layoutFileInputRef = useRef<HTMLInputElement | null>(null)

  const layout = loadedLayout.layout
  const layoutSource = loadedLayout.source
  const exportLayout = useMemo(() => normalizeRelationAttachments(layout), [layout])
  const blockageTargets = runtimeReport?.dynamicControls?.blockageTargets ?? []
  const selectedPreviewNode = useMemo(
    () => exportLayout.nodes.find((node) => node.id === selectedPreviewNodeId) ?? null,
    [exportLayout.nodes, selectedPreviewNodeId],
  )
  const selectedPreviewState = selectedPreviewNode ? snapshot?.editorObjects[selectedPreviewNode.id] : undefined
  const selectedPreviewTarget = selectedPreviewNode
    ? blockageTargets.find((target) => target.sourceEditorId === selectedPreviewNode.id) ?? null
    : null
  const selectedPreviewBlockageTargets = useMemo(() => {
    if (!selectedPreviewTarget) {
      if (selectedPreviewNode) {
        return []
      }
      return selectedBlockageId
        ? blockageTargets.filter((target) => target.swmmLinkId === selectedBlockageId)
        : []
    }
    return selectedPreviewTarget.sourceEditorId
      ? blockageTargets.filter((target) => target.sourceEditorId === selectedPreviewTarget.sourceEditorId)
      : [selectedPreviewTarget]
  }, [blockageTargets, selectedBlockageId, selectedPreviewTarget])
  const selectedPendingEditorBlockage = selectedPreviewNode
    ? manualBlockagesByEditorId[selectedPreviewNode.id] ?? 0
    : 0
  const selectedPreviewBlockageValue = selectedPreviewBlockageTargets.length > 0
    ? Math.max(...selectedPreviewBlockageTargets.map((target) => (
      manualBlockagesById[target.swmmLinkId]
      ?? (target.sourceEditorId ? manualBlockagesByEditorId[target.sourceEditorId] : undefined)
      ?? 0
    )))
    : selectedPendingEditorBlockage
  const canEditSelectedBlockage = Boolean(selectedPreviewNode || selectedPreviewBlockageTargets.length > 0)
  const selectedPreviewSwmmLinks = useMemo(() => {
    if (!selectedPreviewNode || !runtimeMapping?.swmmLinks) {
      return []
    }
    return Object.entries(runtimeMapping.swmmLinks)
      .filter(([, meta]) => meta.sourceEditorId === selectedPreviewNode.id)
      .map(([swmmId]) => swmmId)
  }, [runtimeMapping?.swmmLinks, selectedPreviewNode])
  const selectedPreviewSwmmNodes = useMemo(() => {
    if (!selectedPreviewNode || !runtimeMapping?.swmmNodes) {
      return []
    }
    return Object.entries(runtimeMapping.swmmNodes)
      .filter(([, meta]) => meta.sourceEditorId === selectedPreviewNode.id)
      .map(([swmmId]) => swmmId)
  }, [runtimeMapping?.swmmNodes, selectedPreviewNode])
  const effectiveBlockagesById = useMemo(
    () => mergeEditorBlockagesIntoSwmmBlockages(manualBlockagesById, manualBlockagesByEditorId, blockageTargets),
    [blockageTargets, manualBlockagesByEditorId, manualBlockagesById],
  )
  const controlPayload = useMemo(() => {
    return buildSwmmRuntimeControl(exportLayout, rainfallPercent, runtimeMapping, effectiveBlockagesById, speedMultiplier)
  }, [effectiveBlockagesById, exportLayout, rainfallPercent, runtimeMapping, speedMultiplier])
  const selectedObjectInfoPanel = (
    <div>
      <h3 className="text-sm font-black">선택 객체 정보</h3>
      {selectedPreviewNode ? (
        <div className="mt-3 space-y-3">
          <div className={`rounded-md px-3 py-2 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedPreviewNode.name}</div>
            <div className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              {getNodeTypeLabel(selectedPreviewNode.type)}
              {selectedPreviewNode.type === 'pipeSegment'
                ? ` / ${PIPE_KIND_LABELS[getNodePipeKind(selectedPreviewNode)]}`
                : ''}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="editor id" value={selectedPreviewNode.id} />
            <StatCell label="swmm id" value={selectedPreviewNode.swmmId || '-'} />
            <StatCell label="관 유량" value={formatNumber(selectedPreviewState?.flowCms)} />
            <StatCell label="유속" value={formatNumber(selectedPreviewState?.maxVelocityMps)} />
            <StatCell label="차오름" value={formatPercentWithDetail(Math.max(
              selectedPreviewState?.maxFullness ?? 0,
              selectedPreviewState?.maxDepthRatio ?? 0,
            ))} />
            <StatCell label="막힘" value={formatPercentWithDetail(selectedPreviewState?.maxBlockageRatio)} />
            <StatCell label="노드 수위" value={formatPrecisePercent(selectedPreviewState?.maxDepthRatio)} />
            <StatCell label="관 만관율" value={formatPrecisePercent(selectedPreviewState?.maxFullness)} />
            <StatCell label="용량" value={formatPrecisePercent(selectedPreviewState?.maxCapacityRatio)} />
            <StatCell label="외부 유입" value={formatNumber(selectedPreviewState?.totalInflowCms, 5)} />
          </div>
          <div className={`rounded-md border px-3 py-2 text-xs font-bold leading-5 ${
            isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-100 bg-slate-50 text-slate-600'
          }`}>
            <div>제어 대상: {selectedPreviewTarget?.swmmLinkId ?? '-'}</div>
            <div>매핑 link: {selectedPreviewSwmmLinks.length ? selectedPreviewSwmmLinks.join(', ') : '-'}</div>
            <div>매핑 node: {selectedPreviewSwmmNodes.length ? selectedPreviewSwmmNodes.join(', ') : '-'}</div>
          </div>
          <div className={`rounded-md border p-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>막힘 제어</div>
              <button
                type="button"
                onClick={applyControl}
                disabled={isApplying || !status?.hasSession || selectedPreviewBlockageTargets.length === 0}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 ${
                  isDark ? 'border-slate-600 bg-black hover:bg-slate-900' : 'border-blue-200 bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isApplying ? '적용 중' : '적용'}
              </button>
            </div>
            <label className="mt-3 block">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                  {selectedPreviewBlockageTargets.length > 1
                    ? `${selectedPreviewBlockageTargets.length}개 SWMM 링크 동시 제어`
                    : selectedPreviewBlockageTargets[0]?.swmmLinkId
                      ?? (selectedPreviewNode ? '엔진 시작 시 매핑 후 적용' : '제어 대상 없음')}
                </span>
                <span className="text-xs font-black text-rose-700">{Math.round(selectedPreviewBlockageValue)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                disabled={!canEditSelectedBlockage}
                value={selectedPreviewBlockageValue}
                onChange={(event) => updateSelectedBlockage(Number(event.target.value))}
                className="mt-2 w-full accent-rose-600 disabled:opacity-50"
              />
              {!status?.hasSession && selectedPreviewNode ? (
                <div className={`mt-2 text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  엔진 시작 전 설정값은 저장해두었다가 시작 직후 SWMM 링크 매핑에 자동 반영됩니다.
                </div>
              ) : null}
            </label>
          </div>
        </div>
      ) : (
        <div className={`mt-3 rounded-md px-3 py-5 text-center text-xs font-bold ${isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
          실험 화면에서 관이나 시설을 클릭하면 정보가 표시됩니다.
        </div>
      )}
    </div>
  )
  const closeSocket = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
    setIsSocketConnected(false)
  }, [])

  const connectSocket = useCallback(() => {
    closeSocket()
    const socket = new WebSocket(getSwmmWebSocketUrl(SWMM_ENGINE_URL))
    socketRef.current = socket
    socket.onopen = () => setIsSocketConnected(true)
    socket.onclose = () => setIsSocketConnected(false)
    socket.onerror = () => setIsSocketConnected(false)
    socket.onmessage = (event) => {
      const payload: unknown = JSON.parse(event.data)
      if (isRealtimeSnapshot(payload)) {
        setSnapshot(payload)
        setStatus((currentStatus) => currentStatus ? {
          ...currentStatus,
          running: payload.type === 'paused' ? false : payload.type === 'control' ? currentStatus.running : true,
          paused: payload.type === 'paused' ? true : payload.type === 'control' ? currentStatus.paused : false,
          hasSession: true,
          stepIndex: payload.stepIndex,
          stepSeconds: payload.stepSeconds,
          modelTime: payload.modelTime,
          control: payload.control,
        } : currentStatus)
      } else if (isRecordValue(payload) && typeof payload.running === 'boolean') {
        setStatus((currentStatus) => statusFromSocketPayload(payload, currentStatus))
      }
    }
  }, [closeSocket])

  useEffect(() => {
    getSwmmEngineStatus(SWMM_ENGINE_URL)
      .then((nextStatus) => {
        setStatus(nextStatus)
        if (nextStatus.hasSession) {
          connectSocket()
        }
      })
      .catch(() => {
        setStatus(null)
      })

    return () => closeSocket()
  }, [closeSocket, connectSocket])

  useEffect(() => {
    if (!selectedBlockageId && blockageTargets.length > 0) {
      setSelectedBlockageId(blockageTargets[0].swmmLinkId)
    }
  }, [blockageTargets, selectedBlockageId])

  useEffect(() => {
    if (!status?.hasSession || !runtimeMapping || isStarting || isStopping) {
      return undefined
    }

    if (autoApplyTimerRef.current !== null) {
      window.clearTimeout(autoApplyTimerRef.current)
    }

    autoApplyTimerRef.current = window.setTimeout(() => {
      updateSwmmEngineControl(SWMM_ENGINE_URL, controlPayload)
        .then((result) => {
          setSnapshot(result.snapshot)
          setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: result.control } : currentStatus)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          setStatus((currentStatus) => currentStatus ? { ...currentStatus, lastError: message } : currentStatus)
        })
    }, 450)

    return () => {
      if (autoApplyTimerRef.current !== null) {
        window.clearTimeout(autoApplyTimerRef.current)
      }
    }
  }, [controlPayload, isStarting, isStopping, runtimeMapping, status?.hasSession])

  const refreshLayout = () => {
    setLoadedLayout(loadSavedLayout())
    setSnapshot(null)
    setRuntimeMapping(null)
    setRuntimeReport(null)
    setSelectedBlockageId('')
    setSelectedPreviewNodeId('')
    setManualBlockagesById({})
    setManualBlockagesByEditorId({})
  }

  const handleImportLayout = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsedValue: unknown = JSON.parse(text)
      if (!isEditorLayout(parsedValue)) {
        window.alert('편집 모드에서 내보낸 drainage-layout JSON 파일이 아닙니다.')
        return
      }

      const importedLayout = normalizeRelationAttachments(parsedValue)
      saveEditorLayout(importedLayout)
      setLoadedLayout({
        layout: importedLayout,
        source: 'localStorage',
      })
      setSnapshot(null)
      setRuntimeMapping(null)
      setRuntimeReport(null)
      setSelectedBlockageId('')
      setSelectedPreviewNodeId('')
      setManualBlockagesById({})
      setManualBlockagesByEditorId({})
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`JSON 불러오기에 실패했습니다.\n\n${message}`)
    } finally {
      event.target.value = ''
    }
  }

  const refreshStatus = async () => {
    try {
      const nextStatus = await getSwmmEngineStatus(SWMM_ENGINE_URL)
      setStatus(nextStatus)
      if (nextStatus.hasSession && !isSocketConnected) {
        connectSocket()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 상태 확인에 실패했습니다.\n\n${message}`)
    }
  }

  const startEngine = async () => {
    if (isStarting) {
      return
    }

    setIsStarting(true)
    try {
      const initialControl = buildSwmmRuntimeControl(exportLayout, rainfallPercent, null, effectiveBlockagesById, speedMultiplier)
      const result = await startSwmmEngine(SWMM_ENGINE_URL, exportLayout, initialControl)
      const nextMapping = asSwmmRuntimeMapping(result.mapping)
      const nextReport = runtimeReportFromUnknown(result.report)
      setRuntimeMapping(nextMapping)
      setRuntimeReport(nextReport)
      setSnapshot(result.snapshot)
      setStatus(result.status)
      connectSocket()
      if (nextMapping) {
        const nextBlockageTargets = nextReport?.dynamicControls?.blockageTargets ?? []
        const mappedBlockages = mergeEditorBlockagesIntoSwmmBlockages(
          manualBlockagesById,
          manualBlockagesByEditorId,
          nextBlockageTargets,
        )
        const mappedControl = buildSwmmRuntimeControl(exportLayout, rainfallPercent, nextMapping, mappedBlockages, speedMultiplier)
        const controlResult = await updateSwmmEngineControl(SWMM_ENGINE_URL, mappedControl)
        setSnapshot(controlResult.snapshot)
        setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: controlResult.control } : currentStatus)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 시작에 실패했습니다.\n\n${message}`)
    } finally {
      setIsStarting(false)
    }
  }

  const stopEngine = async () => {
    if (isStopping) {
      return
    }

    setIsStopping(true)
    try {
      const nextStatus = await stopSwmmEngine(SWMM_ENGINE_URL)
      setStatus(nextStatus)
      closeSocket()
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 정지에 실패했습니다.\n\n${message}`)
    } finally {
      setIsStopping(false)
    }
  }

  const togglePauseEngine = async () => {
    if (isPausing || !status?.hasSession) {
      return
    }

    setIsPausing(true)
    try {
      const nextStatus = status.paused
        ? await resumeSwmmEngine(SWMM_ENGINE_URL)
        : await pauseSwmmEngine(SWMM_ENGINE_URL)
      setStatus(nextStatus)
      if (nextStatus.hasSession && !isSocketConnected) {
        connectSocket()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 ${status.paused ? '재개' : '일시정지'}에 실패했습니다.\n\n${message}`)
    } finally {
      setIsPausing(false)
    }
  }

  const resetEngine = async () => {
    if (isStarting) {
      return
    }

    setIsStarting(true)
    try {
      const initialControl = buildSwmmRuntimeControl(exportLayout, rainfallPercent, null, effectiveBlockagesById, speedMultiplier)
      const result = await resetSwmmEngine(SWMM_ENGINE_URL, exportLayout, initialControl)
      const nextMapping = asSwmmRuntimeMapping(result.mapping)
      const nextReport = runtimeReportFromUnknown(result.report)
      setRuntimeMapping(nextMapping)
      setRuntimeReport(nextReport)
      setSnapshot(result.snapshot)
      setStatus(result.status)
      connectSocket()
      if (nextMapping) {
        const nextBlockageTargets = nextReport?.dynamicControls?.blockageTargets ?? []
        const mappedBlockages = mergeEditorBlockagesIntoSwmmBlockages(
          manualBlockagesById,
          manualBlockagesByEditorId,
          nextBlockageTargets,
        )
        const mappedControl = buildSwmmRuntimeControl(exportLayout, rainfallPercent, nextMapping, mappedBlockages, speedMultiplier)
        const controlResult = await updateSwmmEngineControl(SWMM_ENGINE_URL, mappedControl)
        setSnapshot(controlResult.snapshot)
        setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: controlResult.control } : currentStatus)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 엔진 초기화에 실패했습니다.\n\n${message}`)
    } finally {
      setIsStarting(false)
    }
  }

  async function applyControl() {
    if (isApplying) {
      return
    }

    setIsApplying(true)
    try {
      const result = await updateSwmmEngineControl(SWMM_ENGINE_URL, controlPayload)
      setSnapshot(result.snapshot)
      setStatus((currentStatus) => currentStatus ? { ...currentStatus, control: result.control } : currentStatus)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      window.alert(`SWMM 제어값 적용에 실패했습니다.\n\n${message}`)
    } finally {
      setIsApplying(false)
    }
  }

  function updateSelectedBlockage(value: number) {
    const blockage = clampPercent(value)
    if (selectedPreviewNode) {
      setManualBlockagesByEditorId((current) => {
        const next = { ...current }
        if (blockage > 0) {
          next[selectedPreviewNode.id] = blockage
        } else {
          delete next[selectedPreviewNode.id]
        }
        return next
      })
    }

    const linkedTargetIds = selectedPreviewBlockageTargets.length > 0
      ? selectedPreviewBlockageTargets.map((target) => target.swmmLinkId)
      : (() => {
        if (!selectedBlockageId) {
          return []
        }
        const selectedTarget = blockageTargets.find((target) => target.swmmLinkId === selectedBlockageId)
        return selectedTarget?.sourceEditorId
          ? blockageTargets
            .filter((target) => target.sourceEditorId === selectedTarget.sourceEditorId)
            .map((target) => target.swmmLinkId)
          : [selectedBlockageId]
      })()

    if (linkedTargetIds.length === 0) {
      return
    }

    setManualBlockagesById((current) => {
      const next = { ...current }
      linkedTargetIds.forEach((swmmLinkId) => {
        if (blockage > 0) {
          next[swmmLinkId] = blockage
        } else {
          delete next[swmmLinkId]
        }
      })
      return next
    })
  }

  const shellClassName = 'relative min-w-0 p-4'
  const panelClassName = `min-h-[640px] min-w-0 overflow-auto rounded-lg border p-4 shadow-sm ${themeTokens.panel}`
  const infoPanel = (
    <aside className={`flex h-full flex-col overflow-hidden shadow-2xl ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <h2 className="text-base font-black">실행 정보</h2>
        <button
          type="button"
          onClick={() => setIsInfoPanelOpen(false)}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          <StatCell label="layout source" value={layoutSource === 'localStorage' ? 'localStorage' : 'default fallback'} />
          <StatCell label="warnings" value={runtimeReport?.warnings.length ?? 0} />
          <StatCell label="errors" value={runtimeReport?.errors.length ?? 0} />
          <StatCell label="websocket clients" value={status?.websocketClients ?? 0} />
          <StatCell label="speed" value={`${speedMultiplier}x`} />
          <StatCell label="tick log" value={status?.tickLogPath ?? snapshot?.tickLogPath ?? '-'} />
          {status?.lastLogError ? <StatCell label="log error" value={status.lastLogError} /> : null}
        </div>

        {runtimeReport?.warnings.length ? (
          <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
            <div className="text-xs font-black text-amber-700">warning</div>
            <ul className="mt-2 space-y-1">
              {runtimeReport.warnings.slice(0, 6).map((warning) => (
                <li key={warning} className="text-xs font-bold leading-5 text-amber-800">{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={`mt-4 rounded-md border p-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          {selectedObjectInfoPanel}
        </div>

        {status?.lastError ? (
          <div className="mt-4 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
            {status.lastError}
          </div>
        ) : null}

        <div className="mt-4">
          <h3 className="text-sm font-black">제어 Payload</h3>
          <textarea
            readOnly
            value={JSON.stringify(controlPayload, null, 2)}
            className="mt-2 h-56 w-full resize-none rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100"
          />
        </div>
      </div>
    </aside>
  )
  const controlBar = (
    <div className={`sticky top-0 z-30 -mx-4 mb-4 min-w-0 border-b px-4 py-3 shadow-sm backdrop-blur ${themeTokens.controlBar}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startEngine}
          disabled={isStarting || Boolean(status?.hasSession)}
          className="rounded-md border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isStarting ? '시작 중' : '엔진 시작'}
        </button>
        <button
          type="button"
          onClick={togglePauseEngine}
          disabled={isPausing || !status?.hasSession}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            status?.paused
              ? isDark ? 'border-emerald-900 bg-slate-900 text-emerald-200 hover:bg-emerald-950' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : isDark ? 'border-amber-900 bg-slate-900 text-amber-200 hover:bg-amber-950' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {isPausing ? '처리 중' : status?.paused ? '엔진 재개' : '엔진 일시정지'}
        </button>
        <button
          type="button"
          onClick={stopEngine}
          disabled={isStopping || !status?.hasSession}
          className={`rounded-md border px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
            isDark ? 'border-rose-900 bg-slate-900 hover:bg-rose-950' : 'border-rose-200 bg-white'
          }`}
        >
          {isStopping ? '정지 중' : '엔진 정지'}
        </button>
        <button
          type="button"
          onClick={resetEngine}
          disabled={isStarting}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400 ${themeTokens.button}`}
        >
          초기화
        </button>
        <label className={`flex min-w-[180px] flex-[1_1_240px] items-center gap-2 rounded-md border px-3 py-2 ${themeTokens.panelMuted}`}>
          <span className={`shrink-0 text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>강수</span>
          <input
            type="range"
            min={0}
            max={MAX_RAINFALL_PERCENT}
            value={rainfallPercent}
            onChange={(event) => setRainfallPercent(clampRainfallPercent(event.target.value))}
            className="min-w-0 flex-1 accent-blue-600"
          />
          <span className="w-20 shrink-0 text-right text-xs font-black text-blue-700">
            {Math.round(rainfallPercent)}%
          </span>
        </label>
        <div className={`flex items-center gap-1 rounded-md border p-1 ${themeTokens.panelMuted}`}>
          {SIMULATION_SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setSpeedMultiplier(speed)}
              className={`rounded px-2.5 py-1.5 text-xs font-black ${
                speedMultiplier === speed
                  ? isDark ? 'bg-blue-500 text-white' : 'bg-slate-900 text-white'
                  : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
          status?.running
            ? 'bg-emerald-100 text-emerald-700'
            : status?.paused
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
        }`}>
          {status?.running
            ? `tick ${snapshot?.stepIndex ?? status.stepIndex}`
            : status?.paused
              ? `일시정지 tick ${snapshot?.stepIndex ?? status.stepIndex}`
              : '엔진 대기'}
        </span>
      </div>
    </div>
  )

  return (
    <section className={shellClassName} data-swmm-theme={theme}>
      <div className={panelClassName}>
        {controlBar}
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div>
            <h2 className="text-base font-black">실시간 시뮬레이션</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
                status?.running
                  ? 'bg-emerald-100 text-emerald-700'
                  : status?.paused
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-500'
              }`}>
                {status?.running ? 'RUNNING' : status?.paused ? 'PAUSED' : 'STOPPED'}
              </span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isSocketConnected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {isSocketConnected ? 'WS ON' : 'WS OFF'}
              </span>
              <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500 sm:max-w-[260px]">
                {SWMM_ENGINE_URL}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshLayout}
              className={`rounded-md border px-3 py-2 text-xs font-black transition-colors ${
                isDark
                  ? 'border-slate-600 bg-slate-900 text-slate-100 hover:border-blue-400 hover:bg-blue-950 hover:text-blue-100'
                  : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-blue-500 hover:bg-blue-100 hover:text-blue-800'
              }`}
            >
              저장본 새로고침
            </button>
            <button
              type="button"
              onClick={() => layoutFileInputRef.current?.click()}
              className={`rounded-md border px-3 py-2 text-xs font-black transition-colors ${
                isDark
                  ? 'border-blue-700 bg-blue-950 text-blue-100 hover:border-blue-300 hover:bg-blue-800'
                  : 'border-blue-400 bg-blue-100 text-blue-800 hover:border-blue-600 hover:bg-blue-200'
              }`}
            >
              JSON 불러오기
            </button>
            <input
              ref={layoutFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportLayout}
            />
            <button
              type="button"
              onClick={refreshStatus}
              className={`rounded-md border px-3 py-2 text-xs font-black transition-colors ${
                isDark
                  ? 'border-amber-700 bg-amber-950 text-amber-100 hover:border-amber-300 hover:bg-amber-800'
                  : 'border-amber-400 bg-amber-100 text-amber-800 hover:border-amber-600 hover:bg-amber-200'
              }`}
            >
              상태 확인
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCell label="nodes" value={layout.nodes.length} />
          <StatCell label="links" value={layout.links.length} />
          <StatCell label="step" value={snapshot?.stepIndex ?? status?.stepIndex ?? 0} />
          <StatCell label="time" value={snapshot?.modelTime ?? status?.modelTime ?? '-'} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCell label="swmm nodes" value={snapshot?.summary.nodeCount ?? runtimeReport?.counts.junctions ?? '-'} />
          <StatCell label="swmm links" value={snapshot?.summary.linkCount ?? runtimeReport?.counts.conduits ?? '-'} />
          <StatCell label="rain targets" value={snapshot?.summary.rainfallTargetCount ?? runtimeReport?.dynamicControls?.rainfallTargets?.length ?? '-'} />
          <StatCell label="blocked" value={snapshot?.summary.activeBlockageCount ?? 0} />
        </div>

        {layoutSource === 'default' ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
            저장된 편집 설계를 찾지 못해 기본 레이아웃이 표시되고 있습니다. 이전 설계 JSON을 불러오면 실험 화면과
            localStorage 저장본이 그 설계로 복구됩니다.
          </div>
        ) : null}

        <SimulationLayoutPreview
          layout={exportLayout}
          snapshot={snapshot}
          rainfallPercent={rainfallPercent}
          theme={theme}
          isFullscreen={isFullscreen}
          selectedPreviewNodeId={selectedPreviewNodeId}
          selectedBlockageId={selectedBlockageId}
          blockageTargets={blockageTargets}
          fullscreenControlBar={controlBar}
          onToggleFullscreen={() => setIsFullscreen((current) => !current)}
          onSelectPreviewNode={(nodeId) => {
            setSelectedPreviewNodeId(nodeId)
            setIsInfoPanelOpen(true)
          }}
          onSelectBlockageTarget={(swmmLinkId) => {
            setSelectedBlockageId(swmmLinkId)
            setIsInfoPanelOpen(true)
          }}
          animationSpeedMultiplier={speedMultiplier}
        />
      </div>

      <div
        className={`fixed bottom-0 right-0 top-0 z-[100] w-[min(420px,calc(100vw-32px))] transform transition-transform duration-200 ${
          isInfoPanelOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        {infoPanel}
      </div>
    </section>
  )
}

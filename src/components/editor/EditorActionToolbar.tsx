import type { ChangeEvent, RefObject } from 'react'

/** 편집모드 상단의 확대, undo/redo, JSON/INP 입출력 제어 버튼 묶음이다. */
export function EditorActionToolbar({
  isDark,
  controlBarClassName,
  panelMutedClassName,
  buttonClassName,
  buttonMutedClassName,
  editorZoom,
  zoomStep,
  canUndo,
  canRedo,
  isScenarioReadOnly,
  isScenarioEditMode,
  isExportingInp,
  swmmEngineUrl,
  fileInputRef,
  onZoomChange,
  onZoomReset,
  onUndo,
  onRedo,
  onExportJson,
  onExportInp,
  onImport,
  onResetLayout,
}: {
  isDark: boolean
  controlBarClassName: string
  panelMutedClassName: string
  buttonClassName: string
  buttonMutedClassName: string
  editorZoom: number
  zoomStep: number
  canUndo: boolean
  canRedo: boolean
  isScenarioReadOnly: boolean
  isScenarioEditMode: boolean
  isExportingInp: boolean
  swmmEngineUrl: string
  fileInputRef: RefObject<HTMLInputElement | null>
  onZoomChange: (delta: number) => void
  onZoomReset: () => void
  onUndo: () => void
  onRedo: () => void
  onExportJson: () => void
  onExportInp: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onResetLayout: () => void
}) {
  return (
    <div className={`sticky top-0 z-40 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shadow-sm backdrop-blur ${controlBarClassName}`}>
      <div>
        <h2 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>편집 모드 v1</h2>
        <p className={`mt-1 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          지상 객체를 드래그하고 포트 두 개를 클릭하면 관계 링크만 생성됩니다.
          객체/파이프 추가는 캔버스 우클릭 메뉴에서 선택하고, 연결 시 선택 포트끼리 자동으로 맞닿습니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className={`flex items-center gap-1 rounded-md border p-1 ${panelMutedClassName}`}>
          <button
            type="button"
            onClick={() => onZoomChange(-zoomStep)}
            className={`rounded px-2.5 py-1.5 text-xs font-black ${buttonClassName}`}
          >
            축소
          </button>
          <span className={`min-w-12 text-center text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {Math.round(editorZoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(zoomStep)}
            className={`rounded px-2.5 py-1.5 text-xs font-black ${buttonClassName}`}
          >
            확대
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className={`rounded px-2.5 py-1.5 text-xs font-black ${buttonMutedClassName}`}
          >
            초기화
          </button>
        </div>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || isScenarioReadOnly}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 ${buttonClassName}`}
          title="Command/Ctrl + Z"
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo || isScenarioReadOnly}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 ${buttonClassName}`}
          title="Command/Ctrl + Shift + Z"
        >
          다시 실행
        </button>
        <button
          type="button"
          onClick={onExportJson}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-blue-900 bg-slate-900 text-blue-200 hover:bg-slate-800' : 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-slate-100'
          }`}
        >
          JSON 내보내기
        </button>
        <button
          type="button"
          onClick={onExportInp}
          disabled={isExportingInp}
          className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-wait disabled:opacity-60 ${
            isDark ? 'border-cyan-900 bg-slate-900 text-cyan-200 hover:bg-slate-800' : 'border-cyan-300 bg-cyan-100 text-cyan-700 hover:bg-slate-100'
          }`}
          title={`SWMM 엔진 서버: ${swmmEngineUrl}`}
        >
          {isExportingInp ? 'INP 생성 중' : 'INP 다운로드'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScenarioReadOnly}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-emerald-900 bg-slate-900 text-emerald-200 hover:bg-slate-800' : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-slate-100'
          }`}
        >
          JSON 불러오기
        </button>
        <button
          type="button"
          onClick={onResetLayout}
          disabled={isScenarioReadOnly}
          className={`rounded-md border px-3 py-2 text-xs font-black ${
            isDark ? 'border-rose-900 bg-slate-900 text-rose-200 hover:bg-slate-800' : 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-slate-100'
          }`}
        >
          {isScenarioEditMode ? '수정 초기화' : '기본 초기화'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImport}
        />
      </div>
    </div>
  )
}

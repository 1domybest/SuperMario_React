import type { SwmmScenario } from '../../services/swmm/dto'

/** 시나리오 선택 UI에 표시할 제목과 버전을 한 줄 label로 만든다. */
function formatScenarioLabel(scenario: SwmmScenario) {
  return `${scenario.title} / v${scenario.version}`
}

/** 편집모드 하단 시나리오 선택, 생성, 수정, 저장 UI를 렌더링한다. */
export function EditorScenarioToolbar({
  isDark,
  buttonClassName,
  scenarios,
  selectedScenario,
  scenarioError,
  isScenarioEditMode,
  isLoadingScenarios,
  isSavingScenario,
  scenarioTitle,
  scenarioDescription,
  onScenarioTitleChange,
  onScenarioDescriptionChange,
  onSaveScenario,
  onResetScenarioChanges,
  onCancelScenarioEdit,
  onScenarioSelect,
  onRefreshScenarios,
  onCreateNewScenario,
  onBeginScenarioEdit,
}: {
  isDark: boolean
  buttonClassName: string
  scenarios: SwmmScenario[]
  selectedScenario: SwmmScenario | null
  scenarioError: string | null
  isScenarioEditMode: boolean
  isLoadingScenarios: boolean
  isSavingScenario: boolean
  scenarioTitle: string
  scenarioDescription: string
  onScenarioTitleChange: (value: string) => void
  onScenarioDescriptionChange: (value: string) => void
  onSaveScenario: () => void
  onResetScenarioChanges: () => void
  onCancelScenarioEdit: () => void
  onScenarioSelect: (scenarioId: string) => void
  onRefreshScenarios: () => void
  onCreateNewScenario: () => void
  onBeginScenarioEdit: () => void
}) {
  const scenarioStatusText = scenarioError
    ? scenarioError
    : isScenarioEditMode
      ? '수정 모드'
      : selectedScenario
        ? formatScenarioLabel(selectedScenario)
        : '시나리오 미선택'

  return (
    <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50/80'}`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>시나리오</span>
          <span className={`max-w-[320px] truncate rounded-full px-2 py-1 text-[11px] font-black ${
            scenarioError
              ? 'bg-rose-100 text-rose-700'
              : isScenarioEditMode
                ? 'bg-amber-100 text-amber-700'
                : selectedScenario
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
          }`}>
            {scenarioStatusText}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {isScenarioEditMode ? (
            <>
              <input
                value={scenarioTitle}
                onChange={(event) => onScenarioTitleChange(event.target.value)}
                placeholder="시나리오 제목"
                className={`h-10 min-w-[180px] flex-[1_1_180px] rounded-md border px-3 text-xs font-bold ${
                  isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <input
                value={scenarioDescription}
                onChange={(event) => onScenarioDescriptionChange(event.target.value)}
                placeholder="설명"
                className={`h-10 min-w-[180px] flex-[1_1_220px] rounded-md border px-3 text-xs font-bold ${
                  isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={onSaveScenario}
                disabled={isSavingScenario}
                className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDark ? 'border-sky-900 bg-slate-950 text-sky-200 hover:bg-slate-800' : 'border-sky-300 bg-sky-100 text-sky-700 hover:bg-white'
                }`}
              >
                {isSavingScenario ? '저장 중' : '저장'}
              </button>
              <button
                type="button"
                onClick={onResetScenarioChanges}
                disabled={isSavingScenario}
                className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDark ? 'border-rose-900 bg-slate-950 text-rose-200 hover:bg-slate-800' : 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-white'
                }`}
              >
                초기화
              </button>
              <button
                type="button"
                onClick={onCancelScenarioEdit}
                disabled={isSavingScenario}
                className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <select
                value={selectedScenario?.id ?? ''}
                onChange={(event) => onScenarioSelect(event.target.value)}
                disabled={isLoadingScenarios || isSavingScenario}
                className={`h-10 w-[280px] max-w-full flex-none rounded-md border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                <option value="">
                  {isLoadingScenarios ? '시나리오 불러오는 중' : '시나리오 선택'}
                </option>
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {formatScenarioLabel(scenario)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onRefreshScenarios}
                disabled={isLoadingScenarios || isSavingScenario}
                className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
              >
                시나리오 새로고침
              </button>
              <button
                type="button"
                onClick={onCreateNewScenario}
                disabled={isSavingScenario}
                className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDark ? 'border-emerald-900 bg-slate-950 text-emerald-200 hover:bg-slate-800' : 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-white'
                }`}
              >
                새 시나리오
              </button>
              {selectedScenario ? (
                <button
                  type="button"
                  onClick={onBeginScenarioEdit}
                  disabled={isSavingScenario}
                  className={`rounded-md border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDark ? 'border-blue-900 bg-slate-950 text-blue-200 hover:bg-slate-800' : 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-white'
                  }`}
                >
                  수정
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

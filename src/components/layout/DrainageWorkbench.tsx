import { EditorCanvas } from '../editor'
import { SimulationWorkbench } from '../simulation/SimulationWorkbench'
import { WORKBENCH_THEME_TOKENS, type WorkbenchTheme } from '../theme/workbenchTheme'
import { useState } from 'react'

type WorkbenchMode = 'simulation' | 'editor'

const VIEW_CONFIG: Record<
  WorkbenchMode,
  {
    label: string
    description: string
  }
> = {
  simulation: {
    label: '시뮬레이션',
    description: '편집 모드의 저장된 설계를 SWMM 엔진으로 실행하고 1초 tick 결과를 확인하는 화면입니다.',
  },
  editor: {
    label: '편집 모드',
    description: '드래그와 포트 클릭으로 배수 객체를 배치하고 SWMM형 nodes/links JSON을 만드는 화면입니다.',
  },
}

export function DrainageWorkbench() {
  const [mode, setMode] = useState<WorkbenchMode>('simulation')
  const [theme, setTheme] = useState<WorkbenchTheme>('light')
  const config = VIEW_CONFIG[mode]
  const isDark = theme === 'dark'
  const themeTokens = WORKBENCH_THEME_TOKENS[theme]

  return (
    <main className={`min-h-screen min-w-0 overflow-x-hidden ${themeTokens.app}`}>
      <header className={`flex min-w-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-4 ${themeTokens.header}`}>
        <div className="min-w-0">
          <h1 className="text-xl font-black">도시침수 배수도 React 작업장</h1>
          <p className={`mt-1 text-sm font-semibold ${themeTokens.description}`}>
            {config.description}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            className={`rounded-md border px-3 py-2 text-xs font-black transition ${themeTokens.button}`}
            title={isDark ? '화이트 모드' : '다크 모드'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          {Object.entries(VIEW_CONFIG).map(([viewMode, viewConfig]) => (
            <button
              key={viewMode}
              type="button"
              onClick={() => setMode(viewMode as WorkbenchMode)}
              className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                mode === viewMode
                  ? themeTokens.buttonActive
                  : themeTokens.buttonMuted
              }`}
            >
              {viewConfig.label}
            </button>
          ))}
        </div>
      </header>

      {mode === 'editor' ? (
        <EditorCanvas theme={theme} />
      ) : (
        <SimulationWorkbench theme={theme} />
      )}
    </main>
  )
}

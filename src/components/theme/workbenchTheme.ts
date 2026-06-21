export type WorkbenchTheme = 'light' | 'dark'

export const WORKBENCH_THEME_TOKENS = {
  light: {
    app: 'bg-slate-200 text-slate-900',
    header: 'border-slate-300 bg-slate-100',
    description: 'text-slate-600',
    panel: 'border-slate-300 bg-slate-100 text-slate-900',
    panelMuted: 'border-slate-300 bg-slate-200/70',
    controlBar: 'border-slate-300 bg-slate-100/95',
    button: 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200',
    buttonActive: 'border-slate-900 bg-slate-900 text-white',
    buttonMuted: 'border-slate-300 bg-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-100',
  },
  dark: {
    app: 'bg-slate-950 text-slate-100',
    header: 'border-slate-800 bg-slate-950',
    description: 'text-slate-400',
    panel: 'border-slate-800 bg-slate-950 text-slate-100',
    panelMuted: 'border-slate-800 bg-slate-900',
    controlBar: 'border-slate-800 bg-slate-950/95',
    button: 'border-slate-600 bg-slate-900 text-white hover:bg-slate-800',
    buttonActive: 'border-slate-500 bg-black text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)]',
    buttonMuted: 'border-slate-700 bg-slate-950 text-slate-100 hover:border-slate-500 hover:bg-slate-900',
  },
} as const

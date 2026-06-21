import type { EditorLayout } from './editorTypes'

export const EDITOR_LAYOUT_STORAGE_KEY = 'swmm-react-editor-layout-v1'

export function isEditorLayout(value: unknown): value is EditorLayout {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<EditorLayout>
  return candidate.version === 1 && Array.isArray(candidate.nodes) && Array.isArray(candidate.links)
}

export function loadEditorLayout(): EditorLayout | null {
  const rawValue = window.localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue)
    return isEditorLayout(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function saveEditorLayout(layout: EditorLayout) {
  window.localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
}

export function clearEditorLayout() {
  window.localStorage.removeItem(EDITOR_LAYOUT_STORAGE_KEY)
}

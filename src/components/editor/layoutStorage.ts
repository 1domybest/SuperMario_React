import type { EditorLayout } from './editorTypes'

export const EDITOR_LAYOUT_STORAGE_KEY = 'swmm-react-editor-layout-v1'

/** localStorage에서 읽은 값이 현재 editor layout 최소 구조를 만족하는지 확인한다. */
export function isEditorLayout(value: unknown): value is EditorLayout {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<EditorLayout>
  return candidate.version === 1 && Array.isArray(candidate.nodes) && Array.isArray(candidate.links)
}

/** localStorage에 저장된 편집 layout을 읽고, 구조가 맞지 않으면 null을 반환한다. */
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

/** 현재 편집 layout을 localStorage에 저장한다. */
export function saveEditorLayout(layout: EditorLayout) {
  window.localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
}

/** localStorage에 저장된 편집 layout을 삭제한다. */
export function clearEditorLayout() {
  window.localStorage.removeItem(EDITOR_LAYOUT_STORAGE_KEY)
}

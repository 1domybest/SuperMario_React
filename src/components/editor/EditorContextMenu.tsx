import {
  LAYOUT_ADD_KIND_LABELS,
  LAYOUT_ADD_KIND_OPTIONS,
  NODE_BUTTONS,
  NODE_LABELS,
  type LayoutAddKind,
} from './editorDefinitions'
import type { ContextMenuState, Point } from './editorInternalTypes'
import type { EditorNodeType } from './editorTypes'

export type ContextNodeZOrderAction = 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack'

/** 캔버스/노드/relation/지형 추가 상황에 맞는 우클릭 편집 메뉴를 렌더링한다. */
export function EditorContextMenu({
  contextMenu,
  canStartCoordinateEdit,
  onChangeNodeZOrder,
  onStartTeeCoordinateEdit,
  onAddLayoutNode,
  onDetachRelation,
  onAddNode,
  onAddStandalonePipe,
  onClose,
}: {
  contextMenu: ContextMenuState
  canStartCoordinateEdit: boolean
  onChangeNodeZOrder: (action: ContextNodeZOrderAction) => void
  onStartTeeCoordinateEdit: () => void
  onAddLayoutNode: (kind: LayoutAddKind, source: NonNullable<ContextMenuState['layoutAdd']>) => void
  onDetachRelation: () => void
  onAddNode: (type: EditorNodeType, point: Point) => void
  onAddStandalonePipe: (point: Point) => void
  onClose: () => void
}) {
  return (
    <div
      data-editor-context-menu="true"
      className="fixed z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="border-b border-slate-100 px-3 py-2 text-xs font-black text-slate-400">
        편집 메뉴
      </div>
      {contextMenu.nodeId ? (
        <>
          <button
            type="button"
            onClick={() => onChangeNodeZOrder('bringToFront')}
            className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            맨 앞으로 보내기
          </button>
          <button
            type="button"
            onClick={() => onChangeNodeZOrder('bringForward')}
            className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            앞으로 보내기
          </button>
          <button
            type="button"
            onClick={() => onChangeNodeZOrder('sendBackward')}
            className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            뒤로 보내기
          </button>
          <button
            type="button"
            onClick={() => onChangeNodeZOrder('sendToBack')}
            className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            맨 뒤로 보내기
          </button>
          {canStartCoordinateEdit ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={onStartTeeCoordinateEdit}
                className="block w-full px-3 py-2 text-left text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                좌표 변경
              </button>
            </>
          ) : null}
        </>
      ) : contextMenu.layoutAdd ? (
        <>
          {LAYOUT_ADD_KIND_OPTIONS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onAddLayoutNode(kind, contextMenu.layoutAdd!)}
              className="block w-full px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              {LAYOUT_ADD_KIND_LABELS[kind]} 추가
            </button>
          ))}
        </>
      ) : contextMenu.relationPort ? (
        <button
          type="button"
          onClick={onDetachRelation}
          className="block w-full px-3 py-2 text-left text-sm font-black text-rose-700 hover:bg-rose-50"
        >
          해체
        </button>
      ) : (
        <>
          {NODE_BUTTONS.map((nodeType) => (
            <button
              key={nodeType}
              type="button"
              onClick={() => {
                onAddNode(nodeType, contextMenu.point)
                onClose()
              }}
              className="block w-full px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {NODE_LABELS[nodeType]} 추가
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onAddStandalonePipe(contextMenu.point)
              onClose()
            }}
            className="block w-full px-3 py-2 text-left text-sm font-bold text-sky-700 hover:bg-sky-50"
          >
            파이프 추가
          </button>
        </>
      )}
    </div>
  )
}

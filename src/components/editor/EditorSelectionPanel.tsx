import {
  CONNECTOR_TYPE_OPTIONS,
  DEFAULT_PIPE_KIND,
  FACILITY_KIND_LABELS,
  FACILITY_KIND_OPTIONS,
  FACILITY_TYPE_OPTIONS,
  FIXED_NODE_Y_BY_TYPE,
  LINK_ROUTE_OPTIONS,
  LINK_TYPE_OPTIONS,
  MANHOLE_KIND_LABELS,
  MANHOLE_KIND_OPTIONS,
  MIN_MANHOLE_HEIGHT,
  MIN_ROAD_WIDTH,
  MIN_TERRAIN_HEIGHT,
  MIN_TERRAIN_WIDTH,
  NODE_LABELS,
  OUTFALL_KIND_LABELS,
  OUTFALL_KIND_OPTIONS,
  PIPE_KIND_LABELS,
  PIPE_KIND_OPTIONS,
  PIPE_SIZE_LABELS,
  PIPE_SIZE_OPTIONS,
  TERRAIN_KIND_LABELS,
  TERRAIN_KIND_OPTIONS,
} from './editorDefinitions'
import { snapNodeToGround } from './editorNodePlacement'
import {
  getLinkPipeKind,
  getNodeFacilityKind,
  getNodeManholeKind,
  getNodeOutfallKind,
  getNodePipeKind,
  getNodePipeSize,
  getNodeTerrainKind,
  normalizeNodePorts,
  resizeNodeForFacilityKind,
  resizeNodeForManholeKind,
  resizeNodeForOutfallKind,
  resizeNodeForPipeSize,
  resizeNodeForTerrainKind,
  resizeNodeForType,
} from './editorNodeHelpers'
import { clampPercent } from '../../services/swmm/editorRuntime'
import {
  SURFACE_NODE_TYPES,
  type EditorLink,
  type EditorLinkType,
  type EditorNode,
  type EditorNodeType,
  type EditorPipeSize,
} from './editorTypes'

/** 편집 정보 drawer의 모델 요약 숫자 카드를 렌더링한다. */
export function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="editor-summary-card rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
    </div>
  )
}

/** 선택된 노드 또는 링크의 속성을 수정하는 편집 패널을 렌더링한다. */
export function SelectionPanel({
  node,
  link,
  connectedLinks,
  groundSurfaceY,
  onUpdateNode,
  onRotateNode,
  onUpdateLink,
  onUpdateLinkProps,
  onDeleteSelection,
}: {
  node: EditorNode | null
  link: EditorLink | null
  connectedLinks: EditorLink[]
  groundSurfaceY: number
  onUpdateNode: (nodeId: string, updates: Partial<EditorNode>) => void
  onRotateNode: (nodeId: string) => void
  onUpdateLink: (linkId: string, updates: Partial<Omit<EditorLink, 'props'>>) => void
  onUpdateLinkProps: (linkId: string, updates: Partial<EditorLink['props']>) => void
  onDeleteSelection: () => void
}) {
  if (node) {
    const isSurfaceNode = SURFACE_NODE_TYPES.has(node.type)
    const fixedY = FIXED_NODE_Y_BY_TYPE[node.type]
    const isYLocked = isSurfaceNode || fixedY !== undefined
    const isPositionLockedPipe = node.type === 'pipeSegment' && connectedLinks.length > 0
    const hasPipeSize = (
      node.type === 'pipeSegment' ||
      node.type === 'connector' ||
      node.type === 'elbowConnector' ||
      node.type === 'teeConnector'
    )
    const hasPipeKind = hasPipeSize
    const hasFacilityType = FACILITY_TYPE_OPTIONS.includes(node.type)
    const hasFacilityKind = node.type === 'facility'
    const hasOutfallKind = node.type === 'outfall'
    const hasManholeKind = node.type === 'manhole'
    const hasTerrainKind = node.type === 'terrain'
    const hasConnectorType = CONNECTOR_TYPE_OPTIONS.includes(node.type)
    const hasNodeBlockageControl = (
      node.type === 'pipeSegment' ||
      node.type === 'facility' ||
      node.type === 'manhole' ||
      node.type === 'catchBasin' ||
      node.type === 'outfall'
    )
    const pipeKind = hasPipeKind ? getNodePipeKind(node) : DEFAULT_PIPE_KIND
    const minNodeWidth = node.type === 'road'
      ? MIN_ROAD_WIDTH
      : node.type === 'terrain'
        ? MIN_TERRAIN_WIDTH
        : 20
    const minNodeHeight = node.type === 'manhole'
      ? MIN_MANHOLE_HEIGHT
      : node.type === 'terrain'
        ? MIN_TERRAIN_HEIGHT
        : 20
    const handleNodeTypeChange = (nextType: EditorNodeType) => {
      const updates = resizeNodeForType(node, nextType)
      const nextNode = snapNodeToGround(
        normalizeNodePorts({
          ...node,
          ...updates,
        }),
        groundSurfaceY,
      )

      onUpdateNode(node.id, nextNode)
    }

    return (
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">선택 객체</h3>
          <button
            type="button"
            onClick={onDeleteSelection}
            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-white"
          >
            삭제
          </button>
        </div>

        <TextField
          label="화면 이름"
          value={node.name}
          onChange={(value) => onUpdateNode(node.id, { name: value })}
        />
        <TextField
          label="SWMM ID"
          value={node.swmmId}
          onChange={(value) => onUpdateNode(node.id, { swmmId: value })}
        />
        <Definition label="id" value={node.id} />
        <Definition label="type" value={node.type} />
        {hasFacilityType && (
          <SelectField
            label="객체 종류"
            value={node.type}
            options={FACILITY_TYPE_OPTIONS}
            optionLabels={NODE_LABELS}
            onChange={handleNodeTypeChange}
          />
        )}
        {hasFacilityKind && (
          <SelectField
            label="시설 세부 종류"
            value={getNodeFacilityKind(node)}
            options={FACILITY_KIND_OPTIONS}
            optionLabels={FACILITY_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForFacilityKind(node, value))}
          />
        )}
        {hasOutfallKind && (
          <SelectField
            label="방류구 종류"
            value={getNodeOutfallKind(node)}
            options={OUTFALL_KIND_OPTIONS}
            optionLabels={OUTFALL_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForOutfallKind(node, value))}
          />
        )}
        {hasManholeKind && (
          <SelectField
            label="맨홀 종류"
            value={getNodeManholeKind(node)}
            options={MANHOLE_KIND_OPTIONS}
            optionLabels={MANHOLE_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForManholeKind(node, value))}
          />
        )}
        {hasTerrainKind && (
          <SelectField
            label="레이아웃 종류"
            value={getNodeTerrainKind(node)}
            options={TERRAIN_KIND_OPTIONS}
            optionLabels={TERRAIN_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForTerrainKind(node, value))}
          />
        )}
        {hasConnectorType && (
          <SelectField
            label="커넥터 종류"
            value={node.type}
            options={CONNECTOR_TYPE_OPTIONS}
            optionLabels={NODE_LABELS}
            disabled={connectedLinks.length > 0}
            onChange={handleNodeTypeChange}
          />
        )}
        {hasConnectorType && connectedLinks.length > 0 && (
          <p className="mt-2 rounded-md bg-orange-50 px-2 py-2 text-xs font-bold leading-5 text-orange-700">
            연결된 커넥터는 포트 구성이 바뀌지 않도록 종류 변경이 잠겨 있습니다. 먼저 연결을 끊은 뒤 변경하세요.
          </p>
        )}
        {hasPipeKind && (
          <SelectField
            label="관 종류"
            value={pipeKind}
            options={PIPE_KIND_OPTIONS}
            optionLabels={PIPE_KIND_LABELS}
            onChange={(value) => onUpdateNode(node.id, {
              props: {
                ...node.props,
                pipeKind: value,
              },
            })}
          />
        )}
        {hasPipeSize && (
          <SelectField
            label="굵기"
            value={getNodePipeSize(node)}
            options={PIPE_SIZE_OPTIONS}
            onChange={(value) => onUpdateNode(node.id, resizeNodeForPipeSize(node, value as EditorPipeSize))}
          />
        )}

        {hasNodeBlockageControl && (
          <div className="mt-3">
            <NumberField
              label="막힘 정도"
              value={clampPercent(node.props.blockage)}
              min={0}
              max={100}
              onChange={(value) => onUpdateNode(node.id, {
                props: {
                  ...node.props,
                  blockage: Math.min(100, Math.max(0, value)),
                },
              })}
            />
          </div>
        )}

        {hasPipeSize && (
          <button
            type="button"
            onClick={() => onRotateNode(node.id)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800"
            title="오른쪽으로 90도 회전"
            aria-label={`${NODE_LABELS[node.type]} 오른쪽 90도 회전`}
          >
            <RotateClockwiseIcon />
            오른쪽 90도 회전
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="x"
            value={node.x}
            disabled={isPositionLockedPipe}
            onChange={(value) => onUpdateNode(node.id, { x: value })}
          />
          <NumberField
            label="y"
            value={node.y}
            disabled={isYLocked || isPositionLockedPipe}
            onChange={(value) => onUpdateNode(node.id, { y: value })}
          />
          <NumberField
            label="가로"
            value={node.width}
            onChange={(value) => onUpdateNode(node.id, { width: Math.max(minNodeWidth, value) })}
          />
          <NumberField
            label="세로"
            value={node.height}
            min={minNodeHeight}
            disabled={node.type === 'road'}
            onChange={(value) => onUpdateNode(node.id, { height: Math.max(minNodeHeight, value) })}
          />
        </div>

        {fixedY !== undefined && (
          <p className="mt-2 rounded-md bg-blue-50 px-2 py-2 text-xs font-bold leading-5 text-blue-700">
            {node.type === 'catchBasin' ? '빗물받이' : '맨홀'}은 y={fixedY}px로 고정되고 x만 이동할 수 있습니다.
          </p>
        )}

        {isSurfaceNode && fixedY === undefined && (
          <p className="mt-2 rounded-md bg-blue-50 px-2 py-2 text-xs font-bold leading-5 text-blue-700">
            지상 고정 객체는 y={groundSurfaceY}px 지상선에 자동 스냅됩니다.
          </p>
        )}

        {isPositionLockedPipe && (
          <p className="mt-2 rounded-md bg-orange-50 px-2 py-2 text-xs font-bold leading-5 text-orange-700">
            관계에 연결된 파이프는 캔버스에서 그룹 단위로 이동합니다. 숫자 위치 편집은 잠겨 있고 길이는 가로/세로 값으로 조정하세요.
          </p>
        )}

        <Definition label="ports" value={node.ports.map((port) => port.id).join(', ')} />
        <div className="mt-3 text-xs font-black text-slate-400">연결 링크</div>
        <ul className="mt-2 space-y-1">
          {connectedLinks.length > 0 ? connectedLinks.map((connectedLink) => (
            <li key={connectedLink.id} className="rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
              {connectedLink.name}
            </li>
          )) : (
            <li className="text-xs font-semibold text-slate-400">아직 연결된 링크가 없습니다.</li>
          )}
        </ul>
      </div>
    )
  }

  if (link) {
    const hasPipeKind = link.type !== 'relation'
    const pipeKind = hasPipeKind ? getLinkPipeKind(link) : DEFAULT_PIPE_KIND

    return (
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black">선택 링크</h3>
          <button
            type="button"
            onClick={onDeleteSelection}
            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-white"
          >
            삭제
          </button>
        </div>

        <TextField
          label="화면 이름"
          value={link.name}
          onChange={(value) => onUpdateLink(link.id, { name: value })}
        />
        <TextField
          label="SWMM ID"
          value={link.swmmId}
          onChange={(value) => onUpdateLink(link.id, { swmmId: value })}
        />
        <Definition label="id" value={link.id} />
        <SelectField
          label="링크 종류"
          value={link.type}
          options={LINK_TYPE_OPTIONS}
          onChange={(value) => onUpdateLink(link.id, { type: value as EditorLinkType })}
        />
        <SelectField
          label="관 크기"
          value={link.size}
          options={PIPE_SIZE_OPTIONS}
          onChange={(value) => onUpdateLink(link.id, { size: value as EditorPipeSize })}
        />
        {hasPipeKind && (
          <SelectField
            label="관 종류"
            value={pipeKind}
            options={PIPE_KIND_OPTIONS}
            optionLabels={PIPE_KIND_LABELS}
            onChange={(value) => onUpdateLinkProps(link.id, { pipeKind: value })}
          />
        )}
        <SelectField
          label="경로"
          value={link.props.route}
          options={LINK_ROUTE_OPTIONS}
          onChange={(value) => onUpdateLinkProps(link.id, { route: value as EditorLink['props']['route'] })}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="경사"
            value={link.props.slope}
            onChange={(value) => onUpdateLinkProps(link.id, { slope: value })}
          />
          <NumberField
            label="길이"
            value={link.props.length}
            onChange={(value) => onUpdateLinkProps(link.id, { length: value })}
          />
          <NumberField
            label="막힘 정도"
            value={link.props.blockage}
            min={0}
            max={100}
            onChange={(value) => onUpdateLinkProps(link.id, { blockage: Math.min(100, Math.max(0, value)) })}
          />
        </div>
        {link.type === 'relation' ? (
          <>
            <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="text-xs font-black text-blue-500">관계 방향</div>
              <div className="mt-1 text-sm font-black text-slate-800">
                부모에서 자식 방향으로 attach됩니다.
              </div>
            </div>
            <Definition label="부모(from)" value={`${link.from.nodeId} / ${link.from.portId}`} />
            <Definition label="자식(to)" value={`${link.to.nodeId} / ${link.to.portId}`} />
          </>
        ) : (
          <>
            <Definition label="from" value={`${link.from.nodeId} / ${link.from.portId}`} />
            <Definition label="to" value={`${link.to.nodeId} / ${link.to.portId}`} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
      객체나 링크를 선택하면 id, swmmId, type, 연결 상태가 여기에 표시됩니다.
    </div>
  )
}

function RotateClockwiseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M19 7v5h-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.2 12A6.2 6.2 0 1 0 16 16.7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
      />
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: {
  label: string
  value: number | undefined
  min?: number
  max?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={formatNumberInput(value)}
        onChange={(event) => onChange(parseNumberInput(event.target.value, value ?? 0))}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
      />
    </label>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  optionLabels,
  disabled = false,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  optionLabels?: Partial<Record<string, string>>
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? (option in PIPE_SIZE_LABELS ? PIPE_SIZE_LABELS[option as EditorPipeSize] : option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-1 break-all text-sm font-bold text-slate-700">{value}</div>
    </div>
  )
}

function parseNumberInput(value: string, fallback: number) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function formatNumberInput(value: number | undefined) {
  return value === undefined ? '' : String(value)
}

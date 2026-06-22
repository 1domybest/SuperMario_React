import { memo, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ATTACH_TAP_CENTER_PERCENTAGE,
  PENDING_PORT_DOT_RADIUS,
  PENDING_PORT_HALO_RADIUS,
  PORT_DOT_RADIUS,
  PORT_HALO_RADIUS,
  PORT_HIT_RADIUS,
} from './editorDefinitions'
import { getAttachTapPortInfo, supportsAttachTapPorts } from './editorNodeHelpers'
import { endpointKey } from './editorRelations'
import { NodeBody } from './EditorNodeBody'
import type { Point, RelationPortRole, ResizeEdge } from './editorInternalTypes'
import type { RenderedPortRelationLookup } from './editorNodeRenderData'
import type {
  EditorNode,
  EditorPort,
  EditorPortSelection,
} from './editorTypes'

type EditableNodeProps = {
  node: EditorNode
  selected: boolean
  renderedPortRelationLookup: RenderedPortRelationLookup
  connectedPortKeys: Set<string>
  selectedRelationPortRoles: Map<string, RelationPortRole>
  selectedParentPortKeys: Set<string>
  pendingPort: EditorPortSelection | null
  attachTargetNodeId: string | null
  coordinateEditActive: boolean
  getRenderablePorts: (
    node: EditorNode,
    pendingPort: EditorPortSelection | null,
    includeAttachCandidatePorts: boolean,
    connectedPortKeys: Set<string>,
    selectedRelationPortRoles: Map<string, RelationPortRole>,
  ) => EditorPort[]
  getRenderedPortPoint: (node: EditorNode, port: EditorPort, relationLookup: RenderedPortRelationLookup) => Point
  hasManualResizableEdge: (node: EditorNode) => boolean
  renderResizeHandles: (
    node: EditorNode,
    onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void,
  ) => ReactNode
  onPointerDown: (node: EditorNode, event: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter: (node: EditorNode) => void
  onNodeContextMenu: (node: EditorNode, event: ReactMouseEvent<SVGGElement>) => void
  onPortClick: (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => void
  onPortContextMenu: (nodeId: string, portId: string, event: ReactMouseEvent<SVGElement>) => void
  onResizePointerDown: (node: EditorNode, edge: ResizeEdge, event: ReactPointerEvent<SVGRectElement>) => void
}

/** EditableNode memo 비교에서 노드의 렌더 영향 필드만 비교한다. */
function areNodePropsEqual(first: EditorNode, second: EditorNode) {
  if (
    first.id !== second.id ||
    first.swmmId !== second.swmmId ||
    first.name !== second.name ||
    first.type !== second.type ||
    first.x !== second.x ||
    first.y !== second.y ||
    first.width !== second.width ||
    first.height !== second.height
  ) {
    return false
  }

  if (first.ports.length !== second.ports.length) {
    return false
  }

  for (let index = 0; index < first.ports.length; index += 1) {
    const firstPort = first.ports[index]
    const secondPort = second.ports[index]
    if (
      firstPort.id !== secondPort.id ||
      firstPort.side !== secondPort.side ||
      firstPort.label !== secondPort.label ||
      firstPort.offset !== secondPort.offset
    ) {
      return false
    }
  }

  return JSON.stringify(first.props) === JSON.stringify(second.props)
}

/** relation counterpart 포트 비교 시 필요한 포트 필드만 비교한다. */
function arePortPropsEqual(first: EditorPort | null, second: EditorPort | null) {
  if (first === second) {
    return true
  }

  return Boolean(
    first &&
    second &&
    first.id === second.id &&
    first.side === second.side &&
    first.label === second.label &&
    first.offset === second.offset,
  )
}

/** pending attach 포트가 같은 대상인지 비교한다. */
function isPendingPortEqual(first: EditorPortSelection | null, second: EditorPortSelection | null) {
  if (first === second) {
    return true
  }

  return Boolean(
    first &&
    second &&
    first.nodeId === second.nodeId &&
    first.portId === second.portId,
  )
}

/** 현재 노드가 pending attach 상태와 직접 관련 있는지 확인한다. */
function nodeHasRelevantPendingPort(nodeId: string, pendingPort: EditorPortSelection | null) {
  return pendingPort?.nodeId === nodeId
}

/** 노드 포트를 relation/selection lookup에서 쓰는 문자열 key 목록으로 변환한다. */
function getNodePortKeys(node: EditorNode) {
  return node.ports.map((port) => endpointKey({ nodeId: node.id, portId: port.id }))
}

/** 지정 key 목록에 대해서 두 Set의 포함 여부가 같은지 비교한다. */
function haveSameSetValues(first: Set<string>, second: Set<string>, keys: string[]) {
  for (const key of keys) {
    if (first.has(key) !== second.has(key)) {
      return false
    }
  }

  return true
}

/** 지정 key 목록에 대해서 두 relation role Map의 값이 같은지 비교한다. */
function haveSameRoleValues(
  first: Map<string, RelationPortRole>,
  second: Map<string, RelationPortRole>,
  keys: string[],
) {
  for (const key of keys) {
    if (first.get(key) !== second.get(key)) {
      return false
    }
  }

  return true
}

/** 포트별 relation counterpart lookup이 렌더 관점에서 같은지 비교한다. */
function haveSameRenderedPortRelationLookup(
  first: RenderedPortRelationLookup,
  second: RenderedPortRelationLookup,
) {
  if (first.size !== second.size) {
    return false
  }

  for (const [portId, firstRelation] of first.entries()) {
    const secondRelation = second.get(portId)
    if (!secondRelation) {
      return false
    }

    const firstNode = firstRelation.counterpartNode
    const secondNode = secondRelation.counterpartNode
    const sameCounterpartNode = firstNode === secondNode || (
      firstNode !== null &&
      secondNode !== null &&
      areNodePropsEqual(firstNode, secondNode)
    )

    if (
      !sameCounterpartNode ||
      !arePortPropsEqual(firstRelation.counterpartPort, secondRelation.counterpartPort)
    ) {
      return false
    }
  }

  return true
}

/** EditableNode가 실제로 다시 렌더링되어야 하는지 판단하는 custom memo 비교 함수다. */
function areEditableNodePropsEqual(previous: EditableNodeProps, next: EditableNodeProps) {
  const previousHasRelevantPendingPort = nodeHasRelevantPendingPort(previous.node.id, previous.pendingPort)
  const nextHasRelevantPendingPort = nodeHasRelevantPendingPort(next.node.id, next.pendingPort)

  if (
    previous.selected !== next.selected ||
    previous.attachTargetNodeId === previous.node.id !== (next.attachTargetNodeId === next.node.id) ||
    previous.coordinateEditActive !== next.coordinateEditActive ||
    previousHasRelevantPendingPort !== nextHasRelevantPendingPort
  ) {
    return false
  }

  if (!isPendingPortEqual(previous.pendingPort, next.pendingPort)) {
    if (previousHasRelevantPendingPort || nextHasRelevantPendingPort) {
      return false
    }

    const previousAttachMode = Boolean(previous.pendingPort)
    const nextAttachMode = Boolean(next.pendingPort)
    if (previousAttachMode !== nextAttachMode || previous.selected || next.selected) {
      return false
    }
  }

  if (!areNodePropsEqual(previous.node, next.node)) {
    return false
  }

  const portKeys = getNodePortKeys(next.node)
  return (
    haveSameRenderedPortRelationLookup(previous.renderedPortRelationLookup, next.renderedPortRelationLookup) &&
    haveSameSetValues(previous.connectedPortKeys, next.connectedPortKeys, portKeys) &&
    haveSameSetValues(previous.selectedParentPortKeys, next.selectedParentPortKeys, portKeys) &&
    haveSameRoleValues(previous.selectedRelationPortRoles, next.selectedRelationPortRoles, portKeys)
  )
}

/** 노드 본체, 포트, resize handle을 묶어 렌더링한다. */
export const EditableNode = memo(function EditableNode({
  node,
  selected,
  renderedPortRelationLookup,
  connectedPortKeys,
  selectedRelationPortRoles,
  selectedParentPortKeys,
  pendingPort,
  attachTargetNodeId,
  coordinateEditActive,
  getRenderablePorts,
  getRenderedPortPoint,
  hasManualResizableEdge,
  renderResizeHandles,
  onPointerDown,
  onPointerEnter,
  onNodeContextMenu,
  onPortClick,
  onPortContextMenu,
  onResizePointerDown,
}: EditableNodeProps) {
  const isAttachMode = Boolean(pendingPort)
  const isAttachTarget = pendingPort !== null && attachTargetNodeId === node.id && pendingPort.nodeId !== node.id
  const includeAttachCandidatePorts = isAttachTarget
  const renderablePorts = getRenderablePorts(
    node,
    pendingPort,
    includeAttachCandidatePorts,
    connectedPortKeys,
    selectedRelationPortRoles,
  )
  const showResizeHandles = selected && !isAttachMode

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      className={isAttachMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}
      onPointerDown={(event) => onPointerDown(node, event)}
      onPointerEnter={() => onPointerEnter(node)}
      onContextMenu={(event) => onNodeContextMenu(node, event)}
    >
      <NodeBody node={node} selected={selected} />
      {showResizeHandles && hasManualResizableEdge(node) ? renderResizeHandles(node, onResizePointerDown) : null}
      {renderablePorts.map((port) => {
        const point = getRenderedPortPoint(node, port, renderedPortRelationLookup)
        const portKey = endpointKey({ nodeId: node.id, portId: port.id })
        const isConnected = connectedPortKeys.has(portKey)
        const isSelectedParentPort = selectedParentPortKeys.has(portKey)
        const relationRole = selectedRelationPortRoles.get(portKey)
        const isPending = pendingPort?.nodeId === node.id && pendingPort.portId === port.id
        const tapInfo = supportsAttachTapPorts(node) ? getAttachTapPortInfo(port.id) : null
        const isAttachTap = Boolean(tapInfo)
        const isCenterTap = tapInfo?.percentage === ATTACH_TAP_CENTER_PERCENTAGE
        const shouldShowPort = (
          isPending ||
          Boolean(relationRole) ||
          (!isAttachMode && selected && (!isConnected || isSelectedParentPort)) ||
          isAttachTarget
        )
        const shouldRenderAttachBar = isAttachTarget && !isPending && !relationRole
        const roleColor = relationRole === 'parent' ? '#2563eb' : '#f97316'
        const roleLabel = relationRole === 'parent' ? '부' : '자'
        const portDotRadius = isAttachTap ? 4.5 : PORT_DOT_RADIUS
        const portHitRadius = isAttachTap ? 8 : PORT_HIT_RADIUS
        const idleFill = isCenterTap ? '#fef3c7' : '#f8fafc'
        const idleStroke = isCenterTap ? '#d97706' : '#64748b'

        return (
          <g key={port.id}>
            {isPending ? (
              <>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={PENDING_PORT_HALO_RADIUS}
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="3"
                  opacity="0.55"
                  pointerEvents="none"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={PENDING_PORT_DOT_RADIUS}
                  fill="#f97316"
                  stroke="#9a3412"
                  strokeWidth="2.5"
                  pointerEvents="none"
                />
              </>
            ) : null}
            {shouldShowPort && !isPending ? (
              <>
                {isConnected && !shouldRenderAttachBar && (isSelectedParentPort || Boolean(relationRole)) ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={PORT_HALO_RADIUS}
                    fill={relationRole === 'child' ? 'rgba(249, 115, 22, 0.18)' : 'rgba(59, 130, 246, 0.18)'}
                    stroke={relationRole ? roleColor : '#2563eb'}
                    strokeWidth="3"
                    pointerEvents="none"
                  />
                ) : null}
                {shouldRenderAttachBar ? (
                  <line
                    x1={point.x}
                    y1={point.y - 8}
                    x2={point.x}
                    y2={point.y + 8}
                    stroke={isConnected ? '#2563eb' : '#f97316'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={isConnected ? 0.72 : 1}
                    pointerEvents="none"
                  />
                ) : (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={portDotRadius}
                    fill={relationRole ? roleColor : isSelectedParentPort ? '#60a5fa' : idleFill}
                    stroke={relationRole ? '#ffffff' : isSelectedParentPort ? '#1d4ed8' : idleStroke}
                    strokeWidth={isAttachTap ? 2.2 : 3}
                    pointerEvents="none"
                  />
                )}
                {relationRole ? (
                  <g pointerEvents="none">
                    <circle
                      cx={point.x + 13}
                      cy={point.y - 13}
                      r="8"
                      fill={roleColor}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={point.x + 13}
                      y={point.y - 9.8}
                      textAnchor="middle"
                      className="select-none text-[11px] font-black"
                      fill="#ffffff"
                    >
                      {roleLabel}
                    </text>
                  </g>
                ) : null}
              </>
            ) : null}
            <circle
              cx={point.x}
              cy={point.y}
              r={portHitRadius}
              fill="transparent"
              stroke="transparent"
              strokeWidth="0"
              className="cursor-crosshair"
              onPointerDown={(event) => {
                if (!coordinateEditActive) {
                  event.stopPropagation()
                }
              }}
              onClick={(event) => onPortClick(node.id, port.id, event)}
              onContextMenu={(event) => onPortContextMenu(node.id, port.id, event)}
            />
          </g>
        )
      })}
    </g>
  )
}, areEditableNodePropsEqual)

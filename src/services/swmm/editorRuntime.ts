import type { EditorLayout } from '../../components/editor/editorTypes'
import type { SwmmEngineControl, SwmmRealtimeSnapshot } from './client'

export interface SwmmRuntimeMappingLink {
  sourceEditorId?: string
  sourceEditorType?: string
}

export interface SwmmRuntimeMappingNode {
  sourceEditorId?: string
  sourceEditorType?: string
}

export interface SwmmRuntimeMapping {
  swmmLinks?: Record<string, SwmmRuntimeMappingLink>
  swmmNodes?: Record<string, SwmmRuntimeMappingNode>
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function asSwmmRuntimeMapping(value: unknown): SwmmRuntimeMapping | null {
  if (!isRecordValue(value)) {
    return null
  }

  const swmmLinks = isRecordValue(value.swmmLinks)
    ? Object.fromEntries(
      Object.entries(value.swmmLinks).filter((entry): entry is [string, SwmmRuntimeMappingLink] => isRecordValue(entry[1])),
    )
    : undefined
  const swmmNodes = isRecordValue(value.swmmNodes)
    ? Object.fromEntries(
      Object.entries(value.swmmNodes).filter((entry): entry is [string, SwmmRuntimeMappingNode] => isRecordValue(entry[1])),
    )
    : undefined

  return { swmmLinks, swmmNodes }
}

export function numericControlValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function clampPercent(value: unknown) {
  return Math.max(0, Math.min(100, numericControlValue(value)))
}

export function clampRainfallPercent(value: unknown) {
  return Math.max(0, Math.min(100000, numericControlValue(value)))
}

export function buildSwmmRuntimeControl(
  layout: EditorLayout,
  rainfallPercent: number,
  mapping: SwmmRuntimeMapping | null,
  manualBlockagesById: Record<string, number> = {},
  speedMultiplier = 1,
): SwmmEngineControl {
  const blockagesById: Record<string, number> = {}
  const nodesById = new Map(layout.nodes.map((node) => [node.id, node]))
  const linksById = new Map(layout.links.map((link) => [link.id, link]))

  const setBlockage = (swmmId: string | undefined, value: unknown) => {
    if (!swmmId) {
      return
    }
    const blockage = clampPercent(value)
    if (blockage > 0) {
      blockagesById[swmmId] = blockage
    }
  }

  if (mapping) {
    Object.entries(mapping.swmmLinks ?? {}).forEach(([swmmLinkId, meta]) => {
      const sourceEditorId = meta.sourceEditorId
      if (!sourceEditorId) {
        return
      }
      if (meta.sourceEditorType === 'pipeSegment') {
        setBlockage(swmmLinkId, nodesById.get(sourceEditorId)?.props.blockage)
        return
      }
      setBlockage(swmmLinkId, linksById.get(sourceEditorId)?.props.blockage)
    })

    Object.entries(mapping.swmmNodes ?? {}).forEach(([swmmNodeId, meta]) => {
      if (meta.sourceEditorType === 'pipeSegment') {
        return
      }
      setBlockage(swmmNodeId, nodesById.get(meta.sourceEditorId ?? '')?.props.blockage)
    })
  } else {
    layout.nodes.forEach((node) => setBlockage(node.swmmId, node.props.blockage))
    layout.links.forEach((link) => setBlockage(link.swmmId, link.props.blockage))
  }

  Object.entries(manualBlockagesById).forEach(([swmmId, blockage]) => {
    const clamped = clampPercent(blockage)
    if (clamped > 0) {
      blockagesById[swmmId] = clamped
    } else {
      delete blockagesById[swmmId]
    }
  })

  return {
    rainfallRatio: clampRainfallPercent(rainfallPercent),
    blockagesById,
    speedMultiplier: Math.max(1, Math.min(10, Math.round(numericControlValue(speedMultiplier) || 1))),
  }
}

export function isRealtimeSnapshot(value: unknown): value is SwmmRealtimeSnapshot {
  return isRecordValue(value) && isRecordValue(value.nodes) && isRecordValue(value.links)
}

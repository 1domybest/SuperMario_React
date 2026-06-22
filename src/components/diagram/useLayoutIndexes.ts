import { useMemo } from 'react'
import type { EditorLayout, EditorLink, EditorNode } from '../editor/editorTypes'

export interface LayoutIndexes {
  nodesById: Map<string, EditorNode>
  linksById: Map<string, EditorLink>
  relationLinksByNodeId: Map<string, EditorLink[]>
}

/** layout 배열을 id 기반 Map과 relation lookup으로 변환해 반복 find 비용을 줄인다. */
export function useLayoutIndexes(layout: EditorLayout): LayoutIndexes {
  return useMemo(() => {
    const nodesById = new Map(layout.nodes.map((node) => [node.id, node]))
    const linksById = new Map(layout.links.map((link) => [link.id, link]))
    const relationLinksByNodeId = new Map<string, EditorLink[]>()

    layout.links.forEach((link) => {
      if (link.type !== 'relation') {
        return
      }

      const fromLinks = relationLinksByNodeId.get(link.from.nodeId) ?? []
      fromLinks.push(link)
      relationLinksByNodeId.set(link.from.nodeId, fromLinks)

      const toLinks = relationLinksByNodeId.get(link.to.nodeId) ?? []
      toLinks.push(link)
      relationLinksByNodeId.set(link.to.nodeId, toLinks)
    })

    return {
      nodesById,
      linksById,
      relationLinksByNodeId,
    }
  }, [layout])
}

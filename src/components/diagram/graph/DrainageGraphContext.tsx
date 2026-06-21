/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useContext, useState } from 'react'
import type { DrainageGraphSnapshot, DrainageLink, DrainageNode } from './types'

export interface DrainageGraphRegistry {
  beginRender: () => void
  registerNode: (node: DrainageNode) => void
  registerLink: (link: DrainageLink) => void
  getNode: (id: string) => DrainageNode | undefined
  getLink: (id: string) => DrainageLink | undefined
  getSnapshot: () => DrainageGraphSnapshot
}

function createDrainageGraphRegistry(): DrainageGraphRegistry {
  const nodes = new Map<string, DrainageNode>()
  const links = new Map<string, DrainageLink>()

  return {
    beginRender() {
      nodes.clear()
      links.clear()
    },

    registerNode(node) {
      const previousNode = nodes.get(node.id)
      nodes.set(node.id, {
        ...previousNode,
        ...node,
      })
    },

    registerLink(link) {
      links.set(link.id, link)
    },

    getNode(id) {
      return nodes.get(id)
    },

    getLink(id) {
      return links.get(id)
    },

    getSnapshot() {
      return {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values()),
      }
    },
  }
}

const DrainageGraphContext = createContext<DrainageGraphRegistry | null>(null)

export function DrainageGraphProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createDrainageGraphRegistry)

  registry.beginRender()

  return (
    <DrainageGraphContext.Provider value={registry}>
      {children}
    </DrainageGraphContext.Provider>
  )
}

export function useDrainageGraph() {
  const registry = useContext(DrainageGraphContext)

  if (!registry) {
    throw new Error('DrainageGraphProvider 안에서 사용해야 합니다.')
  }

  return registry
}

export function useDrainageGraphSnapshot() {
  return useDrainageGraph().getSnapshot()
}

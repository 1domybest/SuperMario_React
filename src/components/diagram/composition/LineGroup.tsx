import type { PropsWithChildren } from 'react'

export interface LineGroupProps extends PropsWithChildren {
  id: string
  name: string
  x?: number
  y?: number
}

export function LineGroup({ id, name, x = 0, y = 0, children }: LineGroupProps) {
  return (
    <g id={id} data-line-name={name} transform={`translate(${x} ${y})`}>
      <title>{name}</title>
      {children}
    </g>
  )
}

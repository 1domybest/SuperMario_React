import type { PipeSize } from './Pipe'

export type ElbowDirection = 'right-down' | 'left-down' | 'right-up' | 'left-up'

export interface PipeElbowConnectorProps {
  id: string
  pipeSize: PipeSize
  direction: ElbowDirection
}

export function PipeElbowConnector({ id, pipeSize, direction }: PipeElbowConnectorProps) {
  return (
    <g id={id} data-pipe-size={pipeSize} data-elbow-direction={direction}>
      <title>{`${id} ${direction}`}</title>
    </g>
  )
}

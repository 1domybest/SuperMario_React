export type DrainageObjectKind =
  | 'pipe'
  | 'connector'
  | 'catchBasin'
  | 'manhole'
  | 'pumpStation'
  | 'overflowFacility'
  | 'reclamationCenter'
  | 'outfall'

export interface DrainageObjectRef {
  htmlId: string
  swmmId: string
  kind: DrainageObjectKind
  name: string
}

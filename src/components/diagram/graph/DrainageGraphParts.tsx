import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import {
  PIPE_SIZE_PRESETS,
  Pipe as PipePrimitive,
  PipeConnector,
  type FlowDirection,
  type PipeSize,
} from '../primitives'
import {
  Apartment as ApartmentObject,
  type ApartmentProps as ApartmentObjectProps,
  House as HouseObject,
  type HouseProps as HouseObjectProps,
  Manhole as ManholeObject,
  type ManholeProps as ManholeObjectProps,
  RainPumpStation as RainPumpStationObject,
  type RainPumpStationProps as RainPumpStationObjectProps,
  StormOverflowFacility as StormOverflowFacilityObject,
  type StormOverflowFacilityProps as StormOverflowFacilityObjectProps,
  WaterReclamationCenter as WaterReclamationCenterObject,
  type WaterReclamationCenterProps as WaterReclamationCenterObjectProps,
} from '../objects'
import { useDrainageGraph, useDrainageGraphSnapshot } from './DrainageGraphContext'
import type { DrainageLink, DrainageNodeKind, PendingDrainageLink } from './types'
import type { DrainageGraphRegistry } from './DrainageGraphContext'

const CurrentNodeContext = createContext<string | null>(null)
const PendingLinkContext = createContext<PendingDrainageLink | null>(null)
const CurrentPoseContext = createContext<ChainPose>({ x: 0, y: 0, angle: 0 })
const AttachedAnchorContext = createContext<AttachedAnchorRegistry | null>(null)
const AttachedTargetContext = createContext<Point | null>(null)

interface ChainPose {
  x: number
  y: number
  angle: number
}

type ConnectorRefPort = 'center' | 'top' | 'right' | 'bottom' | 'left'
type AnchorSide = 'center' | 'top' | 'right' | 'bottom' | 'left' | 'start' | 'end'
type AnchorOffsetFrom = 'start' | 'center' | 'end'

interface Point {
  x: number
  y: number
}

interface TargetAnchorSpec {
  side?: AnchorSide
  offset?: number
  from?: AnchorOffsetFrom
}

interface NamedSelfAnchorSpec {
  name: string
  side?: AnchorSide
  from?: AnchorOffsetFrom
}

type SelfAnchor = Point | string | NamedSelfAnchorSpec

interface RegisteredAnchor extends Point {
  angle?: number
  outerThickness?: number
  width?: number
  height?: number
}

interface ParentConnectorSnapshot extends RegisteredAnchor {
  id: string
  size: PipeSize
}

const ParentConnectorContext = createContext<ParentConnectorSnapshot | null>(null)

interface AttachedAnchorRegistry {
  origin: Point
  registerAnchor: (name: string, anchor: RegisteredAnchor) => void
}

interface AttachedAnchorRegistrationProps {
  name?: string
  anchor: RegisteredAnchor
}

function AttachedAnchorRegistration({ name, anchor }: AttachedAnchorRegistrationProps) {
  const attachedAnchorRegistry = useContext(AttachedAnchorContext)

  useLayoutEffect(() => {
    if (!name || !attachedAnchorRegistry) {
      return
    }

    attachedAnchorRegistry.registerAnchor(name, {
      x: anchor.x - attachedAnchorRegistry.origin.x,
      y: anchor.y - attachedAnchorRegistry.origin.y,
      angle: anchor.angle,
      outerThickness: anchor.outerThickness,
      width: anchor.width,
      height: anchor.height,
    })
  }, [
    anchor.angle,
    anchor.height,
    anchor.outerThickness,
    anchor.width,
    anchor.x,
    anchor.y,
    attachedAnchorRegistry,
    name,
  ])

  return null
}

function useCurrentNode(componentName: string) {
  const currentNodeId = useContext(CurrentNodeContext)

  if (!currentNodeId) {
    throw new Error(`${componentName}의 상류 노드가 없습니다.`)
  }

  return currentNodeId
}

function completePendingLink(
  graph: DrainageGraphRegistry,
  pendingLink: PendingDrainageLink | null,
  toNodeId: string,
) {
  if (!pendingLink) {
    return
  }

  graph.registerLink({
    ...pendingLink,
    toNodeId,
  })
}

function pointFromAngle(angle: number, distance: number) {
  const radians = (angle * Math.PI) / 180

  return {
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
  }
}

function rotatePoint(point: Point, angle: number) {
  const radians = (angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

function applyLocalPoint(pose: ChainPose, point: Point) {
  const rotatedPoint = rotatePoint(point, pose.angle)

  return {
    x: pose.x + rotatedPoint.x,
    y: pose.y + rotatedPoint.y,
  }
}

function movePose(pose: ChainPose, localAngle: number, distance: number): ChainPose {
  const nextPoint = applyLocalPoint(pose, pointFromAngle(localAngle, distance))

  return {
    ...nextPoint,
    angle: pose.angle + localAngle,
  }
}

function normalizeTargetAnchorSpec(
  targetAnchor: TargetAnchorSpec | undefined,
  attachSide: AnchorSide | undefined,
  attachOffset: number | undefined,
): Required<TargetAnchorSpec> {
  return {
    side: targetAnchor?.side ?? attachSide ?? 'top',
    offset: targetAnchor?.offset ?? attachOffset ?? 0,
    from: targetAnchor?.from ?? 'start',
  }
}

function getSideOffset(angle: number, side: AnchorSide, distance: number) {
  if (side === 'center') {
    return { x: 0, y: 0 }
  }

  const sideAngle =
    side === 'top'
      ? angle - 90
      : side === 'bottom'
        ? angle + 90
        : side === 'left' || side === 'start'
          ? angle + 180
          : angle

  return pointFromAngle(sideAngle, distance)
}

function normalizeCardinalAngle(angle: number) {
  return ((angle % 360) + 360) % 360
}

function sideFromAngle(angle: number): Exclude<AnchorSide, 'center' | 'start' | 'end'> {
  const normalizedAngle = normalizeCardinalAngle(angle)

  if (normalizedAngle >= 45 && normalizedAngle < 135) {
    return 'bottom'
  }

  if (normalizedAngle >= 135 && normalizedAngle < 225) {
    return 'left'
  }

  if (normalizedAngle >= 225 && normalizedAngle < 315) {
    return 'top'
  }

  return 'right'
}

function getRenderedAnchorSideOffset(
  anchor: RegisteredAnchor,
  side: AnchorSide,
  sidePoint: AnchorOffsetFrom,
  attachmentRotation: number,
  targetTangentAngle?: number,
) {
  if (anchor.width === undefined || anchor.height === undefined || side === 'center') {
    return null
  }

  const normalizedSide = side === 'start' ? 'left' : side === 'end' ? 'right' : side
  const renderedSide = sideFromAngle(sideNormalAngle(normalizedSide) + attachmentRotation)
  const halfWidth = halfExtentAlongAngle(attachmentRotation, 0, anchor.width, anchor.height)
  const halfHeight = halfExtentAlongAngle(attachmentRotation, 90, anchor.width, anchor.height)
  const startPoint =
    renderedSide === 'top'
      ? { x: -halfWidth, y: -halfHeight }
      : renderedSide === 'bottom'
        ? { x: -halfWidth, y: halfHeight }
        : renderedSide === 'left'
          ? { x: -halfWidth, y: -halfHeight }
          : { x: halfWidth, y: -halfHeight }
  const endPoint =
    renderedSide === 'top'
      ? { x: halfWidth, y: -halfHeight }
      : renderedSide === 'bottom'
        ? { x: halfWidth, y: halfHeight }
        : renderedSide === 'left'
          ? { x: -halfWidth, y: halfHeight }
          : { x: halfWidth, y: halfHeight }

  if (sidePoint === 'center') {
    return {
      x: (startPoint.x + endPoint.x) / 2,
      y: (startPoint.y + endPoint.y) / 2,
    }
  }

  if (targetTangentAngle !== undefined) {
    const tangent = pointFromAngle(targetTangentAngle, 1)
    const startProjection = startPoint.x * tangent.x + startPoint.y * tangent.y
    const endProjection = endPoint.x * tangent.x + endPoint.y * tangent.y
    const firstPoint = startProjection <= endProjection ? startPoint : endPoint
    const lastPoint = startProjection <= endProjection ? endPoint : startPoint

    return sidePoint === 'start' ? firstPoint : lastPoint
  }

  return sidePoint === 'start' ? startPoint : endPoint
}

function getRegisteredAnchorSideOffset(
  anchor: RegisteredAnchor,
  side: AnchorSide,
  sidePoint: AnchorOffsetFrom = 'center',
  targetTangentAngle?: number,
  targetSide?: AnchorSide,
  attachmentRotation?: number,
) {
  if (side === 'center') {
    return { x: 0, y: 0 }
  }

  if (anchor.width !== undefined && anchor.height !== undefined) {
    const renderedSideOffset =
      attachmentRotation !== undefined
        ? getRenderedAnchorSideOffset(anchor, side, sidePoint, attachmentRotation, targetTangentAngle)
        : null

    if (renderedSideOffset) {
      return renderedSideOffset
    }

    const angle = anchor.angle ?? 0
    const halfWidth = anchor.width / 2
    const halfHeight = anchor.height / 2
    const normalizedSide = side === 'start' ? 'left' : side === 'end' ? 'right' : side
    const localStart =
      normalizedSide === 'top'
        ? { x: -halfWidth, y: -halfHeight }
        : normalizedSide === 'bottom'
          ? { x: -halfWidth, y: halfHeight }
          : normalizedSide === 'left'
            ? { x: -halfWidth, y: -halfHeight }
            : { x: halfWidth, y: -halfHeight }
    const localEnd =
      normalizedSide === 'top'
        ? { x: halfWidth, y: -halfHeight }
        : normalizedSide === 'bottom'
          ? { x: halfWidth, y: halfHeight }
          : normalizedSide === 'left'
            ? { x: -halfWidth, y: halfHeight }
            : { x: halfWidth, y: halfHeight }

    const startPoint = rotatePoint(localStart, angle)
    const endPoint = rotatePoint(localEnd, angle)

    if (sidePoint === 'center') {
      return {
        x: (startPoint.x + endPoint.x) / 2,
        y: (startPoint.y + endPoint.y) / 2,
      }
    }

    if (targetTangentAngle !== undefined) {
      const tangent = pointFromAngle(targetTangentAngle, 1)
      const startProjection = startPoint.x * tangent.x + startPoint.y * tangent.y
      const endProjection = endPoint.x * tangent.x + endPoint.y * tangent.y
      let firstPoint = startProjection <= endProjection ? startPoint : endPoint
      let lastPoint = startProjection <= endProjection ? endPoint : startPoint

      if (targetSide && Math.abs(startProjection - endProjection) < 0.1) {
        const inwardNormal = pointFromAngle(sideNormalAngle(targetSide) + 180, 1)
        const startNormalProjection = startPoint.x * inwardNormal.x + startPoint.y * inwardNormal.y
        const endNormalProjection = endPoint.x * inwardNormal.x + endPoint.y * inwardNormal.y

        firstPoint = startNormalProjection >= endNormalProjection ? startPoint : endPoint
        lastPoint = startNormalProjection >= endNormalProjection ? endPoint : startPoint
      }

      return sidePoint === 'start' ? firstPoint : lastPoint
    }

    return sidePoint === 'start' ? startPoint : endPoint
  }

  return getSideOffset(anchor.angle ?? 0, side, (anchor.outerThickness ?? 0) / 2)
}

function getLinkAnchorPoint(link: DrainageLink, anchor: Required<TargetAnchorSpec>): Point | null {
  if (
    link.startX === undefined ||
    link.startY === undefined ||
    link.endX === undefined ||
    link.endY === undefined ||
    link.absoluteAngle === undefined ||
    link.outerThickness === undefined
  ) {
    return null
  }

  if (anchor.side === 'left' || anchor.side === 'start') {
    return {
      x: link.startX,
      y: link.startY,
    }
  }

  if (anchor.side === 'right' || anchor.side === 'end') {
    return {
      x: link.endX,
      y: link.endY,
    }
  }

  const rawOffset =
    anchor.from === 'end'
      ? link.length - anchor.offset
      : anchor.from === 'center'
        ? link.length / 2 + anchor.offset
        : anchor.offset
  const clampedOffset = Math.max(0, Math.min(rawOffset, link.length))
  const centerPoint = {
    x: link.startX + pointFromAngle(link.absoluteAngle, clampedOffset).x,
    y: link.startY + pointFromAngle(link.absoluteAngle, clampedOffset).y,
  }

  const sideOffset = getSideOffset(link.absoluteAngle, anchor.side, link.outerThickness / 2)

  return {
    x: centerPoint.x + sideOffset.x,
    y: centerPoint.y + sideOffset.y,
  }
}

function resolveSelfAnchor(
  selfAnchor: SelfAnchor,
  localAnchors: Record<string, RegisteredAnchor>,
  targetAnchor?: Required<TargetAnchorSpec>,
  targetTangentAngle?: number,
  attachmentRotation?: number,
): Point | undefined {
  if (typeof selfAnchor === 'string') {
    return localAnchors[selfAnchor]
  }

  if ('name' in selfAnchor) {
    const anchor = localAnchors[selfAnchor.name]

    if (!anchor) {
      return undefined
    }

    const sideOffset = getRegisteredAnchorSideOffset(
      anchor,
      selfAnchor.side ?? 'center',
      selfAnchor.from ?? targetAnchor?.from ?? 'center',
      targetTangentAngle,
      targetAnchor?.side,
      attachmentRotation,
    )

    return {
      x: anchor.x + sideOffset.x,
      y: anchor.y + sideOffset.y,
    }
  }

  return selfAnchor
}

function getSelfAnchorName(selfAnchor: SelfAnchor) {
  if (typeof selfAnchor === 'string') {
    return selfAnchor
  }

  if ('name' in selfAnchor) {
    return selfAnchor.name
  }

  return 'point'
}

function getSelfAnchorSide(selfAnchor: SelfAnchor) {
  if (typeof selfAnchor === 'object' && 'name' in selfAnchor) {
    return selfAnchor.side ?? 'center'
  }

  return 'center'
}

function getSelfAnchorFrom(selfAnchor: SelfAnchor, targetAnchor: Required<TargetAnchorSpec>) {
  if (typeof selfAnchor === 'object' && 'name' in selfAnchor) {
    return selfAnchor.from ?? targetAnchor.from
  }

  return 'center'
}

function sideNormalAngle(side: AnchorSide) {
  if (side === 'top') {
    return -90
  }

  if (side === 'bottom') {
    return 90
  }

  if (side === 'left' || side === 'start') {
    return 180
  }

  if (side === 'right' || side === 'end') {
    return 0
  }

  return 0
}

function getAttachmentRotation(targetSide: AnchorSide, selfAnchor: SelfAnchor) {
  const selfSide = getSelfAnchorSide(selfAnchor)

  if (targetSide === 'center' || selfSide === 'center') {
    return 0
  }

  return sideNormalAngle(targetSide) + 180 - sideNormalAngle(selfSide)
}

function getTargetAnchorTangentAngle(
  link: DrainageLink | null | undefined,
  targetAnchor: Required<TargetAnchorSpec>,
) {
  if (link?.absoluteAngle === undefined) {
    return undefined
  }

  if (targetAnchor.side === 'left' || targetAnchor.side === 'right') {
    return link.absoluteAngle + 90
  }

  return link.absoluteAngle
}

function halfExtentAlongAngle(
  objectAngle: number,
  directionAngle: number,
  width: number,
  height: number,
) {
  const radians = ((objectAngle - directionAngle) * Math.PI) / 180

  return Math.abs(Math.cos(radians)) * (width / 2) + Math.abs(Math.sin(radians)) * (height / 2)
}

function getScreenEdgePoint(
  anchor: RegisteredAnchor,
  side: Exclude<AnchorSide, 'center' | 'start' | 'end'>,
) {
  const width = anchor.width ?? anchor.outerThickness ?? 0
  const height = anchor.height ?? anchor.outerThickness ?? 0
  const angle = anchor.angle ?? 0
  const halfWidth = halfExtentAlongAngle(angle, 0, width, height)
  const halfHeight = halfExtentAlongAngle(angle, 90, width, height)

  if (side === 'top') {
    return { x: anchor.x, y: anchor.y - halfHeight }
  }

  if (side === 'bottom') {
    return { x: anchor.x, y: anchor.y + halfHeight }
  }

  if (side === 'left') {
    return { x: anchor.x - halfWidth, y: anchor.y }
  }

  return { x: anchor.x + halfWidth, y: anchor.y }
}

export interface LineStartProps {
  id: string
  name: string
  kind?: DrainageNodeKind
  x?: number
  y?: number
  children: ReactNode
}

export function LineStart({
  id,
  name,
  kind = 'connector',
  x = 0,
  y = 0,
  children,
}: LineStartProps) {
  const graph = useDrainageGraph()

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind,
    x,
    y,
    angle: 0,
  })

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <CurrentPoseContext.Provider value={{ x, y, angle: 0 }}>
          <g id={`${id}-line-root`} transform={`translate(${x} ${y})`}>
            {children}
          </g>
        </CurrentPoseContext.Provider>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

export interface CatchBasinProps {
  id: string
  name: string
  x: number
  y: number
  width?: number
  height?: number
  surfaceY?: number
  outletSide?: 'left' | 'right' | 'bottom'
  rotation?: number
  children?: ReactNode
}

const CATCH_BASIN_GRATE_HEIGHT = 24
const CATCH_BASIN_GRATE_OVERHANG = 18
const CATCH_BASIN_SURFACE_OFFSET = CATCH_BASIN_GRATE_HEIGHT / 2
const SIDE_OUTLET_LOWER_RATIO = 0.72

type BuildingOutletSide = 'left' | 'right' | 'bottom'

export interface HouseProps
  extends Omit<HouseObjectProps, 'x' | 'y' | 'children'> {
  x?: number
  y?: number
  surfaceY?: number
  outletSide?: BuildingOutletSide
  rotation?: number
  children?: ReactNode
}

export interface ApartmentProps
  extends Omit<ApartmentObjectProps, 'x' | 'y' | 'children'> {
  x?: number
  y?: number
  surfaceY?: number
  outletSide?: BuildingOutletSide
  rotation?: number
  children?: ReactNode
}

export interface ManholeProps
  extends Omit<ManholeObjectProps, 'x' | 'y' | 'width' | 'shaftHeight' | 'lidDiameter'> {
  size?: PipeSize
  width?: number
  shaftHeight?: number
  lidDiameter?: number
  surfaceY?: number
  outletDrop?: number
  outletExtension?: number
  children?: ReactNode
}

export function Manhole({
  id,
  name,
  size = 'medium',
  width,
  shaftHeight,
  lidDiameter,
  surfaceY,
  outletDrop,
  outletExtension,
  children,
  ...manholeProps
}: ManholeProps) {
  const graph = useDrainageGraph()
  const pendingLink = useContext(PendingLinkContext)
  const currentPose = useContext(CurrentPoseContext)
  const parentConnector = useContext(ParentConnectorContext)
  const preset = PIPE_SIZE_PRESETS[size]
  const manholeWidth = lidDiameter ?? width ?? preset.innerThickness
  const rimRadius = manholeWidth / 2
  const shaftTop = rimRadius * 1.32
  const connectorOuterThickness = preset.innerThickness + preset.borderThickness * 2
  const defaultOutletConnectorHalfLength = (connectorOuterThickness * CONNECTOR_LONG_SIDE_RATIO) / 2
  const outletConnectorHalfLength = outletExtension ?? defaultOutletConnectorHalfLength
  const parentBottom = parentConnector ? getScreenEdgePoint(parentConnector, 'bottom') : null
  const parentRight = parentConnector ? getScreenEdgePoint(parentConnector, 'right') : null
  const shaftBottomAbsY = parentBottom?.y ?? currentPose.y + (outletDrop ?? preset.innerThickness * 1.15)
  const manholeTopAbsY =
    surfaceY === undefined ? shaftBottomAbsY - shaftTop - (shaftHeight ?? 160) : surfaceY - rimRadius
  const resolvedShaftHeight = shaftHeight ?? Math.max(48, shaftBottomAbsY - manholeTopAbsY - shaftTop)
  const manholeCenterAbsX = parentRight ? parentRight.x + manholeWidth / 2 : currentPose.x
  const manholeLocalX = manholeCenterAbsX - currentPose.x - manholeWidth / 2
  const manholeLocalY = manholeTopAbsY - currentPose.y
  const childStartAbs = {
    x: manholeCenterAbsX + manholeWidth / 2,
    y: shaftBottomAbsY - outletConnectorHalfLength,
  }
  const childLocal = {
    x: childStartAbs.x - currentPose.x,
    y: childStartAbs.y - currentPose.y,
  }
  const childPose = {
    ...childStartAbs,
    angle: currentPose.angle,
  }

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind: 'manhole',
    x: manholeCenterAbsX,
    y: shaftBottomAbsY,
    angle: currentPose.angle,
    size,
  })
  completePendingLink(graph, pendingLink, id)

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <CurrentPoseContext.Provider value={childPose}>
          <g
            id={`${id}-chain-node`}
            data-node-kind="manhole"
            data-manhole-bottom-x={manholeCenterAbsX}
            data-manhole-bottom-y={shaftBottomAbsY}
            data-manhole-outlet-x={childStartAbs.x}
            data-manhole-outlet-y={childStartAbs.y}
            data-manhole-parent-connector={parentConnector?.id ?? ''}
          >
            <ManholeObject
              id={id}
              name={name}
              x={manholeLocalX}
              y={manholeLocalY}
              width={manholeWidth}
              shaftHeight={resolvedShaftHeight}
              lidDiameter={manholeWidth}
              {...manholeProps}
            />
            <ParentConnectorContext.Provider value={null}>
              <g transform={`translate(${childLocal.x} ${childLocal.y})`}>{children}</g>
            </ParentConnectorContext.Provider>
          </g>
        </CurrentPoseContext.Provider>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

export function CatchBasin({
  id,
  name,
  x,
  y,
  width = 140,
  height = 92,
  surfaceY,
  outletSide = 'right',
  rotation = 0,
  children,
}: CatchBasinProps) {
  const graph = useDrainageGraph()
  const resolvedY = surfaceY === undefined ? y : surfaceY - CATCH_BASIN_SURFACE_OFFSET
  const boxY = CATCH_BASIN_SURFACE_OFFSET
  const grateY = CATCH_BASIN_SURFACE_OFFSET - CATCH_BASIN_GRATE_HEIGHT / 2
  const grateWidth = width + CATCH_BASIN_GRATE_OVERHANG * 2
  const outletY = boxY + height * SIDE_OUTLET_LOWER_RATIO
  const outlet =
    outletSide === 'left'
      ? { x: 0, y: outletY, angle: 180 }
      : outletSide === 'bottom'
        ? { x: width / 2, y: boxY + height, angle: 90 }
        : { x: width, y: outletY, angle: 0 }
  const center = rotatePoint({ x: width / 2, y: boxY + height / 2 }, rotation)
  const rotatedOutlet = rotatePoint({ x: outlet.x, y: outlet.y }, rotation)

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind: 'catch-basin',
    x: x + center.x,
    y: resolvedY + center.y,
    angle: rotation,
  })

  const outletPose = {
    x: x + rotatedOutlet.x,
    y: resolvedY + rotatedOutlet.y,
    angle: rotation + outlet.angle,
  }

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <g
          id={id}
          data-node-kind="catch-basin"
          data-surface-y={surfaceY ?? ''}
          transform={`translate(${x} ${resolvedY}) rotate(${rotation})`}
        >
          <title>{name}</title>
          <rect
            x={0}
            y={boxY}
            width={width}
            height={height}
            rx={8}
            fill="#172033"
            stroke="#0f172a"
            strokeWidth={4}
          />
          <line x1={26} y1={boxY + 24} x2={width - 26} y2={boxY + 24} stroke="#334155" strokeWidth={3} />
          <line
            x1={26}
            y1={boxY + height - 30}
            x2={width - 26}
            y2={boxY + height - 30}
            stroke="#334155"
            strokeWidth={3}
          />
          <text
            x={width / 2}
            y={boxY + height / 2 + 8}
            textAnchor="middle"
            fontSize={20}
            fontWeight={900}
            fill="#fff"
            paintOrder="stroke"
            stroke="rgba(15, 23, 42, 0.8)"
            strokeWidth={4}
          >
            {name}
          </text>
          <rect
            x={-CATCH_BASIN_GRATE_OVERHANG}
            y={grateY}
            width={grateWidth}
            height={CATCH_BASIN_GRATE_HEIGHT}
            rx={4}
            fill="#4b5563"
            stroke="#111827"
            strokeWidth={3}
          />
          {Array.from({ length: 7 }, (_, index) => {
            const stripeX = -CATCH_BASIN_GRATE_OVERHANG + 12 + index * ((grateWidth - 24) / 6)
            return (
              <line
                key={`${id}-grate-${index}`}
                x1={stripeX}
                y1={grateY + 3}
                x2={stripeX}
                y2={grateY + CATCH_BASIN_GRATE_HEIGHT - 3}
                stroke="#cbd5e1"
                strokeWidth={3}
              />
            )
          })}
          <line
            x1={-CATCH_BASIN_GRATE_OVERHANG}
            y1={grateY + CATCH_BASIN_GRATE_HEIGHT / 2}
            x2={width + CATCH_BASIN_GRATE_OVERHANG}
            y2={grateY + CATCH_BASIN_GRATE_HEIGHT / 2}
            stroke="#cbd5e1"
            strokeWidth={3}
          />
          {children ? (
            <CurrentPoseContext.Provider value={outletPose}>
              <g transform={`translate(${outlet.x} ${outlet.y}) rotate(${outlet.angle})`}>
                {children}
              </g>
            </CurrentPoseContext.Provider>
          ) : null}
        </g>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

function getBuildingOutlet(
  width: number,
  height: number,
  outletSide: BuildingOutletSide,
) {
  if (outletSide === 'left') {
    return { x: 0, y: height * SIDE_OUTLET_LOWER_RATIO, angle: 180 }
  }

  if (outletSide === 'bottom') {
    return { x: width / 2, y: height, angle: 90 }
  }

  return { x: width, y: height * SIDE_OUTLET_LOWER_RATIO, angle: 0 }
}

export function House({
  id,
  name,
  x = 0,
  y = 0,
  width = 160,
  bodyHeight = 82,
  roofHeight = 50,
  surfaceY,
  outletSide = 'right',
  rotation = 0,
  children,
  ...houseProps
}: HouseProps) {
  const graph = useDrainageGraph()
  const totalHeight = roofHeight + bodyHeight - 4
  const resolvedY = surfaceY === undefined ? y : surfaceY - totalHeight
  const outlet = getBuildingOutlet(width, totalHeight, outletSide)
  const center = rotatePoint({ x: width / 2, y: totalHeight / 2 }, rotation)
  const rotatedOutlet = rotatePoint({ x: outlet.x, y: outlet.y }, rotation)

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind: 'facility',
    x: x + center.x,
    y: resolvedY + center.y,
    angle: rotation,
  })

  const outletPose = {
    x: x + rotatedOutlet.x,
    y: resolvedY + rotatedOutlet.y,
    angle: rotation + outlet.angle,
  }

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <HouseObject
          {...houseProps}
          id={id}
          name={name}
          x={x}
          y={resolvedY}
          width={width}
          bodyHeight={bodyHeight}
          roofHeight={roofHeight}
        >
          {children ? (
            <CurrentPoseContext.Provider value={outletPose}>
              <g transform={`translate(${outlet.x} ${outlet.y}) rotate(${outlet.angle})`}>
                {children}
              </g>
            </CurrentPoseContext.Provider>
          ) : null}
        </HouseObject>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

export function Apartment({
  id,
  name,
  x = 0,
  y = 0,
  width = 150,
  height = 150,
  surfaceY,
  outletSide = 'right',
  rotation = 0,
  children,
  ...apartmentProps
}: ApartmentProps) {
  const graph = useDrainageGraph()
  const resolvedY = surfaceY === undefined ? y : surfaceY - height
  const outlet = getBuildingOutlet(width, height, outletSide)
  const center = rotatePoint({ x: width / 2, y: height / 2 }, rotation)
  const rotatedOutlet = rotatePoint({ x: outlet.x, y: outlet.y }, rotation)

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind: 'facility',
    x: x + center.x,
    y: resolvedY + center.y,
    angle: rotation,
  })

  const outletPose = {
    x: x + rotatedOutlet.x,
    y: resolvedY + rotatedOutlet.y,
    angle: rotation + outlet.angle,
  }

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <ApartmentObject
          {...apartmentProps}
          id={id}
          name={name}
          x={x}
          y={resolvedY}
          width={width}
          height={height}
        >
          {children ? (
            <CurrentPoseContext.Provider value={outletPose}>
              <g transform={`translate(${outlet.x} ${outlet.y}) rotate(${outlet.angle})`}>
                {children}
              </g>
            </CurrentPoseContext.Provider>
          ) : null}
        </ApartmentObject>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

interface InlineFacilityProps {
  id: string
  name: string
  width: number
  height: number
  renderObject: (x: number, y: number) => ReactNode
  children?: ReactNode
}

type FacilityPortSide = 'top' | 'right' | 'bottom' | 'left'

export interface FacilityPortProps {
  name: string
  side: FacilityPortSide
  size?: PipeSize
  from?: AnchorOffsetFrom
  offset?: number
  startInset?: number
  angle?: number
  children?: ReactNode
}

export function FacilityPort(props: FacilityPortProps) {
  void props

  return null
}

function isFacilityPortElement(child: ReactNode): child is ReactElement<FacilityPortProps> {
  return isValidElement<FacilityPortProps>(child) && child.type === FacilityPort
}

function resolveFacilityPortPoint(
  width: number,
  height: number,
  side: FacilityPortSide,
  from: AnchorOffsetFrom = 'center',
  offset = 0,
) {
  if (side === 'top' || side === 'bottom') {
    const baseX = from === 'start' ? 0 : from === 'end' ? width : width / 2
    return {
      x: baseX + offset,
      y: side === 'top' ? -height / 2 : height / 2,
    }
  }

  const baseY = from === 'start' ? -height / 2 : from === 'end' ? height / 2 : 0
  return {
    x: side === 'left' ? 0 : width,
    y: baseY + offset,
  }
}

function defaultFacilityPortAngle(side: FacilityPortSide) {
  if (side === 'right') return 0
  if (side === 'bottom') return 90
  if (side === 'left') return 180
  return -90
}

function getDefaultFacilityPortStartInset(side: FacilityPortSide, size: PipeSize | undefined) {
  if (!size) {
    return 0
  }

  const shortSide = getConnectorShortSide(size)

  return side === 'left' || side === 'right' || side === 'bottom' || side === 'top'
    ? shortSide
    : 0
}

type PortedFacilityProps = InlineFacilityProps

function PortedFacility({
  id,
  name,
  width,
  height,
  renderObject,
  children,
}: PortedFacilityProps) {
  const graph = useDrainageGraph()
  const pendingLink = useContext(PendingLinkContext)
  const currentPose = useContext(CurrentPoseContext)
  const childrenArray = Children.toArray(children)
  const portChildren = childrenArray.filter(isFacilityPortElement)
  const defaultChildren = childrenArray.filter((child) => !isFacilityPortElement(child))
  const defaultChildPose = {
    x: currentPose.x + width,
    y: currentPose.y,
    angle: currentPose.angle,
  }

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind: 'facility',
    x: currentPose.x + width / 2,
    y: currentPose.y,
    angle: currentPose.angle,
  })
  completePendingLink(graph, pendingLink, id)

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <g
          id={`${id}-facility-chain-node`}
          data-node-kind="facility"
          data-facility-width={width}
          data-facility-height={height}
        >
          {renderObject(0, -height / 2)}
          {defaultChildren.length > 0 ? (
            <CurrentPoseContext.Provider value={defaultChildPose}>
              <g transform={`translate(${width} 0)`}>{defaultChildren}</g>
            </CurrentPoseContext.Provider>
          ) : null}
          {portChildren.map((child) => {
            const {
              name: portName,
              side,
              size,
              from,
              offset,
              startInset,
              angle,
              children: portBody,
            } = child.props
            const localPoint = resolveFacilityPortPoint(width, height, side, from, offset)
            const localAngle = angle ?? defaultFacilityPortAngle(side)
            const portStartInset = startInset ?? getDefaultFacilityPortStartInset(side, size)
            const localStartPoint = {
              x: localPoint.x + pointFromAngle(localAngle, portStartInset).x,
              y: localPoint.y + pointFromAngle(localAngle, portStartInset).y,
            }
            const absolutePoint = applyLocalPoint(currentPose, localStartPoint)
            const portPose = {
              x: absolutePoint.x,
              y: absolutePoint.y,
              angle: currentPose.angle + localAngle,
            }

            return (
              <CurrentPoseContext.Provider key={`${id}-${portName}`} value={portPose}>
                <g
                  data-facility-port={portName}
                  data-facility-port-side={side}
                  data-facility-port-start-inset={portStartInset}
                  transform={`translate(${localStartPoint.x} ${localStartPoint.y}) rotate(${localAngle})`}
                >
                  {portBody}
                </g>
              </CurrentPoseContext.Provider>
            )
          })}
        </g>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

function InlineFacility({
  id,
  name,
  width,
  height,
  renderObject,
  children,
}: InlineFacilityProps) {
  const graph = useDrainageGraph()
  const pendingLink = useContext(PendingLinkContext)
  const currentPose = useContext(CurrentPoseContext)
  const childPose = {
    x: currentPose.x + width,
    y: currentPose.y,
    angle: currentPose.angle,
  }

  graph.registerNode({
    id,
    swmmId: id,
    name,
    kind: 'facility',
    x: currentPose.x + width / 2,
    y: currentPose.y,
    angle: currentPose.angle,
  })
  completePendingLink(graph, pendingLink, id)

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <CurrentPoseContext.Provider value={childPose}>
          <g
            id={`${id}-facility-chain-node`}
            data-node-kind="facility"
            data-facility-width={width}
            data-facility-height={height}
          >
            {renderObject(0, -height / 2)}
            <g transform={`translate(${width} 0)`}>{children}</g>
          </g>
        </CurrentPoseContext.Provider>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

export interface StormOverflowFacilityProps
  extends Omit<StormOverflowFacilityObjectProps, 'x' | 'y' | 'children'> {
  children?: ReactNode
}

export function StormOverflowFacility({
  id,
  name,
  width = 360,
  height = 160,
  children,
  ...facilityProps
}: StormOverflowFacilityProps) {
  return (
    <PortedFacility
      id={id}
      name={name}
      width={width}
      height={height}
      renderObject={(x, y) => (
        <StormOverflowFacilityObject
          {...facilityProps}
          id={id}
          name={name}
          x={x}
          y={y}
          width={width}
          height={height}
        />
      )}
    >
      {children}
    </PortedFacility>
  )
}

export interface RainPumpStationProps
  extends Omit<RainPumpStationObjectProps, 'x' | 'y' | 'children'> {
  children?: ReactNode
}

export function RainPumpStation({
  id,
  name,
  width = 330,
  height = 128,
  children,
  ...stationProps
}: RainPumpStationProps) {
  return (
    <InlineFacility
      id={id}
      name={name}
      width={width}
      height={height}
      renderObject={(x, y) => (
        <RainPumpStationObject
          {...stationProps}
          id={id}
          name={name}
          x={x}
          y={y}
          width={width}
          height={height}
        />
      )}
    >
      {children}
    </InlineFacility>
  )
}

export interface WaterReclamationCenterProps
  extends Omit<WaterReclamationCenterObjectProps, 'x' | 'y' | 'children'> {
  children?: ReactNode
}

export function WaterReclamationCenter({
  id,
  name,
  width = 360,
  height = 128,
  children,
  ...centerProps
}: WaterReclamationCenterProps) {
  return (
    <InlineFacility
      id={id}
      name={name}
      width={width}
      height={height}
      renderObject={(x, y) => (
        <WaterReclamationCenterObject
          {...centerProps}
          id={id}
          name={name}
          x={x}
          y={y}
          width={width}
          height={height}
        />
      )}
    >
      {children}
    </InlineFacility>
  )
}

export interface AttachedCatchBasinSetProps extends Omit<CatchBasinProps, 'x' | 'y' | 'rotation'> {
  attachTo: string
  targetAnchor?: TargetAnchorSpec
  attachSide?: AnchorSide
  attachOffset?: number
  selfAnchor: SelfAnchor
  fallbackX?: number
  fallbackY?: number
}

interface AttachedSetPlacement {
  x: number
  y: number
  rotation: number
  normalizedTargetAnchor: Required<TargetAnchorSpec>
  resolvedTargetAnchor: Point | null
  resolvedSelfAnchor: Point | null
  canSnap: boolean
  anchorRegistry: AttachedAnchorRegistry
}

function useAttachedSetPlacement({
  attachTo,
  targetAnchor,
  attachSide,
  attachOffset,
  selfAnchor,
  fallbackX,
  fallbackY,
  surfaceY,
  fixedSurfaceHeight,
}: {
  attachTo: string
  targetAnchor?: TargetAnchorSpec
  attachSide?: AnchorSide
  attachOffset?: number
  selfAnchor: SelfAnchor
  fallbackX: number
  fallbackY: number
  surfaceY?: number
  fixedSurfaceHeight?: number
}): AttachedSetPlacement {
  const graph = useDrainageGraph()
  const [localAnchors, setLocalAnchors] = useState<Record<string, RegisteredAnchor>>({})
  const targetLink = graph.getLink(attachTo)
  const normalizedTargetAnchor = normalizeTargetAnchorSpec(targetAnchor, attachSide, attachOffset)
  const rotation = getAttachmentRotation(normalizedTargetAnchor.side, selfAnchor)
  const targetTangentAngle = getTargetAnchorTangentAngle(targetLink, normalizedTargetAnchor)
  const resolvedTargetAnchor = targetLink ? getLinkAnchorPoint(targetLink, normalizedTargetAnchor) : null
  const resolvedSelfAnchor = resolveSelfAnchor(
    selfAnchor,
    localAnchors,
    normalizedTargetAnchor,
    targetTangentAngle,
    rotation,
  )
  const canSnap = Boolean(resolvedTargetAnchor && resolvedSelfAnchor)
  const x = canSnap && resolvedTargetAnchor && resolvedSelfAnchor ? resolvedTargetAnchor.x - resolvedSelfAnchor.x : fallbackX
  const snappedY =
    canSnap && resolvedTargetAnchor && resolvedSelfAnchor ? resolvedTargetAnchor.y - resolvedSelfAnchor.y : fallbackY
  const y = surfaceY === undefined || fixedSurfaceHeight === undefined ? snappedY : surfaceY - fixedSurfaceHeight
  const registerAnchor = useCallback((name: string, anchor: RegisteredAnchor) => {
    setLocalAnchors((previousAnchors) => {
      const previousAnchor = previousAnchors[name]

      if (
        previousAnchor &&
        Math.abs(previousAnchor.x - anchor.x) < 0.1 &&
        Math.abs(previousAnchor.y - anchor.y) < 0.1 &&
        Math.abs((previousAnchor.angle ?? 0) - (anchor.angle ?? 0)) < 0.1 &&
        Math.abs((previousAnchor.outerThickness ?? 0) - (anchor.outerThickness ?? 0)) < 0.1 &&
        Math.abs((previousAnchor.width ?? 0) - (anchor.width ?? 0)) < 0.1 &&
        Math.abs((previousAnchor.height ?? 0) - (anchor.height ?? 0)) < 0.1
      ) {
        return previousAnchors
      }

      return {
        ...previousAnchors,
        [name]: anchor,
      }
    })
  }, [])
  const anchorRegistry = useMemo(
    () => ({
      origin: { x, y },
      registerAnchor,
    }),
    [registerAnchor, x, y],
  )

  return {
    x,
    y,
    rotation,
    normalizedTargetAnchor,
    resolvedTargetAnchor,
    resolvedSelfAnchor: resolvedSelfAnchor ?? null,
    canSnap,
    anchorRegistry,
  }
}

function AttachedSetDebugAttributes({
  attachTo,
  normalizedTargetAnchor,
  selfAnchor,
  resolvedSelfAnchor,
  surfaceY,
  rotation,
  canSnap,
}: {
  attachTo: string
  normalizedTargetAnchor: Required<TargetAnchorSpec>
  selfAnchor: SelfAnchor
  resolvedSelfAnchor: Point | null
  surfaceY?: number
  rotation: number
  canSnap: boolean
}) {
  return {
    'data-attach-to': attachTo,
    'data-attach-side': normalizedTargetAnchor.side,
    'data-attach-offset': normalizedTargetAnchor.offset,
    'data-attach-from': normalizedTargetAnchor.from,
    'data-self-anchor': getSelfAnchorName(selfAnchor),
    'data-self-anchor-side': getSelfAnchorSide(selfAnchor),
    'data-self-anchor-from': getSelfAnchorFrom(selfAnchor, normalizedTargetAnchor),
    'data-self-anchor-x': resolvedSelfAnchor?.x ?? '',
    'data-self-anchor-y': resolvedSelfAnchor?.y ?? '',
    'data-surface-y': surfaceY ?? '',
    'data-attachment-rotation': rotation,
    'data-anchor-resolved': canSnap,
  }
}

export function AttachedCatchBasinSet({
  attachTo,
  targetAnchor,
  attachSide,
  attachOffset,
  selfAnchor,
  fallbackX = 0,
  fallbackY = 0,
  surfaceY,
  outletSide = 'right',
  ...catchBasinProps
}: AttachedCatchBasinSetProps) {
  const placement = useAttachedSetPlacement({
    attachTo,
    targetAnchor,
    attachSide,
    attachOffset,
    selfAnchor,
    fallbackX,
    fallbackY,
    surfaceY,
    fixedSurfaceHeight: CATCH_BASIN_SURFACE_OFFSET,
  })

  return (
    <g
      id={`${catchBasinProps.id}-attached-set`}
      {...AttachedSetDebugAttributes({
        attachTo,
        normalizedTargetAnchor: placement.normalizedTargetAnchor,
        selfAnchor,
        resolvedSelfAnchor: placement.resolvedSelfAnchor,
        surfaceY,
        rotation: placement.rotation,
        canSnap: placement.canSnap,
      })}
    >
      <AttachedTargetContext.Provider value={placement.resolvedTargetAnchor}>
        <AttachedAnchorContext.Provider value={placement.anchorRegistry}>
          <CatchBasin
            {...catchBasinProps}
            x={placement.x}
            y={placement.y}
            outletSide={outletSide}
            rotation={placement.rotation}
          />
        </AttachedAnchorContext.Provider>
      </AttachedTargetContext.Provider>
    </g>
  )
}

export interface AttachedHouseSetProps extends Omit<HouseProps, 'x' | 'y' | 'rotation'> {
  attachTo: string
  targetAnchor?: TargetAnchorSpec
  attachSide?: AnchorSide
  attachOffset?: number
  selfAnchor: SelfAnchor
  fallbackX?: number
  fallbackY?: number
}

export function AttachedHouseSet({
  attachTo,
  targetAnchor,
  attachSide,
  attachOffset,
  selfAnchor,
  fallbackX = 0,
  fallbackY = 0,
  surfaceY,
  outletSide = 'right',
  ...houseProps
}: AttachedHouseSetProps) {
  const houseHeight = (houseProps.roofHeight ?? 50) + (houseProps.bodyHeight ?? 82) - 4
  const placement = useAttachedSetPlacement({
    attachTo,
    targetAnchor,
    attachSide,
    attachOffset,
    selfAnchor,
    fallbackX,
    fallbackY,
    surfaceY,
    fixedSurfaceHeight: houseHeight,
  })

  return (
    <g
      id={`${houseProps.id}-attached-set`}
      {...AttachedSetDebugAttributes({
        attachTo,
        normalizedTargetAnchor: placement.normalizedTargetAnchor,
        selfAnchor,
        resolvedSelfAnchor: placement.resolvedSelfAnchor,
        surfaceY,
        rotation: placement.rotation,
        canSnap: placement.canSnap,
      })}
    >
      <AttachedTargetContext.Provider value={placement.resolvedTargetAnchor}>
        <AttachedAnchorContext.Provider value={placement.anchorRegistry}>
          <House
            {...houseProps}
            x={placement.x}
            y={placement.y}
            surfaceY={undefined}
            outletSide={outletSide}
            rotation={placement.rotation}
          />
        </AttachedAnchorContext.Provider>
      </AttachedTargetContext.Provider>
    </g>
  )
}

export interface AttachedApartmentSetProps extends Omit<ApartmentProps, 'x' | 'y' | 'rotation'> {
  attachTo: string
  targetAnchor?: TargetAnchorSpec
  attachSide?: AnchorSide
  attachOffset?: number
  selfAnchor: SelfAnchor
  fallbackX?: number
  fallbackY?: number
}

export function AttachedApartmentSet({
  attachTo,
  targetAnchor,
  attachSide,
  attachOffset,
  selfAnchor,
  fallbackX = 0,
  fallbackY = 0,
  surfaceY,
  outletSide = 'right',
  ...apartmentProps
}: AttachedApartmentSetProps) {
  const apartmentHeight = apartmentProps.height ?? 150
  const placement = useAttachedSetPlacement({
    attachTo,
    targetAnchor,
    attachSide,
    attachOffset,
    selfAnchor,
    fallbackX,
    fallbackY,
    surfaceY,
    fixedSurfaceHeight: apartmentHeight,
  })

  return (
    <g
      id={`${apartmentProps.id}-attached-set`}
      {...AttachedSetDebugAttributes({
        attachTo,
        normalizedTargetAnchor: placement.normalizedTargetAnchor,
        selfAnchor,
        resolvedSelfAnchor: placement.resolvedSelfAnchor,
        surfaceY,
        rotation: placement.rotation,
        canSnap: placement.canSnap,
      })}
    >
      <AttachedTargetContext.Provider value={placement.resolvedTargetAnchor}>
        <AttachedAnchorContext.Provider value={placement.anchorRegistry}>
          <Apartment
            {...apartmentProps}
            x={placement.x}
            y={placement.y}
            surfaceY={undefined}
            outletSide={outletSide}
            rotation={placement.rotation}
          />
        </AttachedAnchorContext.Provider>
      </AttachedTargetContext.Provider>
    </g>
  )
}

export interface AttachToLinkTargetProps {
  attachTo: string
  targetAnchor?: TargetAnchorSpec
  attachSide?: AnchorSide
  attachOffset?: number
  children: ReactNode
}

export function AttachToLinkTarget({
  attachTo,
  targetAnchor,
  attachSide,
  attachOffset,
  children,
}: AttachToLinkTargetProps) {
  const graph = useDrainageGraph()
  const targetLink = graph.getLink(attachTo)
  const normalizedTargetAnchor = normalizeTargetAnchorSpec(targetAnchor, attachSide, attachOffset)
  const resolvedTargetAnchor = targetLink ? getLinkAnchorPoint(targetLink, normalizedTargetAnchor) : null

  return (
    <AttachedTargetContext.Provider value={resolvedTargetAnchor}>
      {children}
    </AttachedTargetContext.Provider>
  )
}

export type ConnectorTurn = 'clockwise' | 'counterclockwise'

const CONNECTOR_LONG_SIDE_RATIO = 1.1
const CONNECTOR_SHORT_SIDE_RATIO = 0.3

function getConnectorShortSide(size: PipeSize) {
  const preset = PIPE_SIZE_PRESETS[size]
  const connectorOuterThickness = preset.innerThickness + preset.borderThickness * 2

  return connectorOuterThickness * CONNECTOR_SHORT_SIDE_RATIO
}

export interface ConnectorProps {
  id: string
  name?: string
  size: PipeSize
  visualOwner?: string
  showVisual?: boolean
  anchorName?: string
  angle?: number
  nextAngle?: number
  turn?: ConnectorTurn
  children?: ReactNode
}

function renderElbowVisual(id: string, size: PipeSize, turn: ConnectorTurn) {
  const preset = PIPE_SIZE_PRESETS[size]
  const pipeSize = preset.innerThickness
  const outerSize = pipeSize + preset.borderThickness * 2
  const connectorLongSide = outerSize * CONNECTOR_LONG_SIDE_RATIO
  const connectorShortSide = outerSize * CONNECTOR_SHORT_SIDE_RATIO
  const radius = pipeSize * 1.2
  const sign = turn === 'clockwise' ? 1 : -1
  const curveStart = radius * 0.42
  const endY = radius * sign
  const path = `M0 0 H${curveStart} Q${radius} 0 ${radius} ${radius * 0.58 * sign} V${endY}`

  return (
    <g id={`${id}-elbow-visual`} data-elbow-turn={turn}>
      <path
        d={path}
        fill="none"
        stroke="#68717d"
        strokeWidth={outerSize}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#f8faf7"
        strokeWidth={pipeSize}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <PipeConnector
        id={`${id}-elbow-inlet-connector`}
        thickness={connectorLongSide}
        fixedHeight={connectorShortSide}
        angle={90}
        x={0}
        y={0}
        fill="#cfd6de"
        borderColor="#68717d"
        stripeColor="#f8fafc"
        label={`${id} ㄱ자 입구 커넥터`}
      />
    </g>
  )
}

export function Connector({
  id,
  name,
  size,
  visualOwner,
  showVisual = true,
  anchorName,
  angle,
  nextAngle = 0,
  turn,
  children,
}: ConnectorProps) {
  const graph = useDrainageGraph()
  const pendingLink = useContext(PendingLinkContext)
  const currentPose = useContext(CurrentPoseContext)
  const preset = PIPE_SIZE_PRESETS[size]
  const pipeSize = preset.innerThickness
  const connectorOuterThickness = pipeSize + preset.borderThickness * 2
  const connectorLongSide = connectorOuterThickness * CONNECTOR_LONG_SIDE_RATIO
  const connectorShortSide = connectorOuterThickness * CONNECTOR_SHORT_SIDE_RATIO

  graph.registerNode({
    id,
    swmmId: id,
    name: name ?? id,
    kind: 'connector',
    visualOwner,
    x: currentPose.x,
    y: currentPose.y,
    angle: currentPose.angle + (angle ?? 0),
    size,
    connectorHeight: connectorShortSide,
  })
  completePendingLink(graph, pendingLink, id)

  if (!showVisual) {
    return (
      <CurrentNodeContext.Provider value={id}>
        <PendingLinkContext.Provider value={null}>
          <CurrentPoseContext.Provider value={currentPose}>
            <g id={id} data-node-kind="connector" data-connector-visual="none">
              <AttachedAnchorRegistration
                name={anchorName}
                anchor={{
                  x: currentPose.x,
                  y: currentPose.y,
                  angle: currentPose.angle + (angle ?? 0),
                  outerThickness: connectorOuterThickness,
                  width: connectorOuterThickness,
                  height: connectorOuterThickness,
                }}
              />
              {children}
            </g>
          </CurrentPoseContext.Provider>
        </PendingLinkContext.Provider>
      </CurrentNodeContext.Provider>
    )
  }

  if (turn) {
    const radius = pipeSize * 1.2
    const sign = turn === 'clockwise' ? 1 : -1
    const nextRotation = turn === 'clockwise' ? 90 : -90
    const baseAngle = angle ?? 0
    const elbowEnd = rotatePoint({ x: radius, y: radius * sign }, baseAngle)
    const childPose = {
      ...applyLocalPoint(currentPose, elbowEnd),
      angle: currentPose.angle + baseAngle + nextRotation,
    }

    return (
      <CurrentNodeContext.Provider value={id}>
        <PendingLinkContext.Provider value={null}>
          <CurrentPoseContext.Provider value={childPose}>
            <g
              id={id}
              data-node-kind="connector"
              data-connector-angle={baseAngle}
              data-connector-turn={turn}
              transform={`rotate(${baseAngle})`}
            >
              <AttachedAnchorRegistration
                name={anchorName}
                anchor={{
                  x: currentPose.x,
                  y: currentPose.y,
                  angle: currentPose.angle + baseAngle,
                  outerThickness: connectorOuterThickness,
                  width: pipeSize * 2.4 + preset.borderThickness * 2,
                  height: pipeSize * 2.4 + preset.borderThickness * 2,
                }}
              />
              {renderElbowVisual(id, size, turn)}
              <g transform={`translate(${radius} ${radius * sign}) rotate(${nextRotation})`}>
                {children}
              </g>
            </g>
          </CurrentPoseContext.Provider>
        </PendingLinkContext.Provider>
      </CurrentNodeContext.Provider>
    )
  }

  const connectorAngle = angle ?? nextAngle
  const connectorHeight = connectorShortSide
  const connectorVisualWidth = connectorLongSide
  const connectorVisualHeight = connectorShortSide
  const connectorHalfExtent = halfExtentAlongAngle(
    connectorAngle,
    nextAngle,
    connectorLongSide,
    connectorHeight,
  )
  const connectorCenter = pointFromAngle(nextAngle, connectorHalfExtent)
  const childOffset = pointFromAngle(nextAngle, connectorHalfExtent * 2)
  const connectorCenterPose = applyLocalPoint(currentPose, connectorCenter)
  const childPose = {
    ...applyLocalPoint(currentPose, childOffset),
    angle: currentPose.angle + nextAngle,
  }
  const connectorSnapshot: ParentConnectorSnapshot = {
    id,
    size,
    x: connectorCenterPose.x,
    y: connectorCenterPose.y,
    angle: currentPose.angle + connectorAngle,
    outerThickness: connectorOuterThickness,
    width: connectorVisualWidth,
    height: connectorVisualHeight,
  }

  graph.registerNode({
    id,
    swmmId: id,
    name: name ?? id,
    kind: 'connector',
    visualOwner,
    x: connectorCenterPose.x,
    y: connectorCenterPose.y,
    angle: currentPose.angle + connectorAngle,
    size,
    connectorHeight,
  })

  return (
    <CurrentNodeContext.Provider value={id}>
      <PendingLinkContext.Provider value={null}>
        <ParentConnectorContext.Provider value={connectorSnapshot}>
          <CurrentPoseContext.Provider value={childPose}>
            <g
              id={id}
              data-node-kind="connector"
              data-connector-angle={connectorAngle}
              data-next-angle={nextAngle}
            >
              <AttachedAnchorRegistration
                name={anchorName}
                anchor={{
                  x: connectorCenterPose.x,
                  y: connectorCenterPose.y,
                  angle: currentPose.angle + connectorAngle,
                  outerThickness: connectorOuterThickness,
                  width: connectorVisualWidth,
                  height: connectorVisualHeight,
                }}
              />
              <g transform={`translate(${childOffset.x} ${childOffset.y}) rotate(${nextAngle})`}>
                {children}
              </g>
              <PipeConnector
                id={`${id}-visual`}
                thickness={connectorLongSide}
                fixedHeight={connectorHeight}
                angle={connectorAngle}
                x={connectorCenter.x}
                y={connectorCenter.y}
                fill="#cfd6de"
                borderColor="#68717d"
                stripeColor="#f8fafc"
                label={name ?? id}
              />
            </g>
          </CurrentPoseContext.Provider>
        </ParentConnectorContext.Provider>
      </PendingLinkContext.Provider>
    </CurrentNodeContext.Provider>
  )
}

export interface ConnectorRefProps {
  id: string
  port?: ConnectorRefPort
  anchorName?: string
}

export function ConnectorRef({ id, port = 'center', anchorName }: ConnectorRefProps) {
  const graph = useDrainageGraph()
  const pendingLink = useContext(PendingLinkContext)
  const currentPose = useContext(CurrentPoseContext)
  const attachedAnchorRegistry = useContext(AttachedAnchorContext)

  useLayoutEffect(() => {
    if (!anchorName || !attachedAnchorRegistry) {
      return
    }

    attachedAnchorRegistry.registerAnchor(anchorName, {
      x: currentPose.x - attachedAnchorRegistry.origin.x,
      y: currentPose.y - attachedAnchorRegistry.origin.y,
      angle: currentPose.angle,
      outerThickness: pendingLink?.outerThickness,
    })
  }, [
    anchorName,
    attachedAnchorRegistry,
    currentPose.angle,
    currentPose.x,
    currentPose.y,
    pendingLink?.outerThickness,
  ])

  void port
  completePendingLink(graph, pendingLink, id)

  return null
}

export interface PipeProps {
  id: string
  name: string
  size: PipeSize
  length: number
  angle?: number
  slope?: number
  color?: string
  borderColor?: string
  centerLineColor?: string
  velocity?: number
  flowDirection?: FlowDirection
  volume?: number
  showLabel?: boolean
  stretchToAttachedTarget?: boolean
  children: ReactNode
}

export function Pipe({
  id,
  name,
  size,
  length,
  angle = 0,
  slope,
  color,
  borderColor,
  centerLineColor,
  velocity = 0,
  flowDirection = 'forward',
  volume = 0,
  showLabel = Boolean(name),
  stretchToAttachedTarget = false,
  children,
}: PipeProps) {
  const currentNodeId = useCurrentNode(id)
  const currentPose = useContext(CurrentPoseContext)
  const attachedTarget = useContext(AttachedTargetContext)
  const preset = PIPE_SIZE_PRESETS[size]
  const absoluteAngle = currentPose.angle + angle
  const axis = pointFromAngle(absoluteAngle, 1)
  const targetDistance = attachedTarget
    ? (attachedTarget.x - currentPose.x) * axis.x + (attachedTarget.y - currentPose.y) * axis.y
    : undefined
  const terminalConnectorInset = getConnectorShortSide(size)
  const stretchedLength =
    stretchToAttachedTarget && targetDistance !== undefined ? targetDistance - terminalConnectorInset : length
  const renderLength = stretchToAttachedTarget ? Math.max(0, stretchedLength) : length
  const childPose = movePose(currentPose, angle, renderLength)
  const pendingLink: PendingDrainageLink = {
    id,
    swmmId: id,
    name,
    kind: 'conduit',
    fromNodeId: currentNodeId,
    size,
    length: renderLength,
    angle,
    slope,
    startX: currentPose.x,
    startY: currentPose.y,
    endX: childPose.x,
    endY: childPose.y,
    absoluteAngle,
    outerThickness: preset.innerThickness + preset.borderThickness * 2,
  }
  const childOffset = pointFromAngle(angle, renderLength)
  const pipeCenter = pointFromAngle(angle, renderLength / 2)

  return (
    <PendingLinkContext.Provider value={pendingLink}>
      <CurrentPoseContext.Provider value={childPose}>
        <g id={`${id}-chain-piece`} data-link-kind="conduit" data-pipe-angle={angle}>
          <PipePrimitive
            id={id}
            swmmId={id}
            name={name}
            size={size}
            length={renderLength}
            angle={angle}
            x={pipeCenter.x}
            y={pipeCenter.y}
            color={color}
            borderColor={borderColor}
            centerLineColor={centerLineColor}
            velocity={velocity}
            flowDirection={flowDirection}
            volume={volume}
            fillAngle={absoluteAngle}
            showLabel={showLabel}
          />
          <g transform={`translate(${childOffset.x} ${childOffset.y}) rotate(${angle})`}>
            {children}
          </g>
        </g>
      </CurrentPoseContext.Provider>
    </PendingLinkContext.Provider>
  )
}

export function GraphSummaryPanel() {
  const snapshot = useDrainageGraphSnapshot()

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-black text-slate-900">노드</h3>
        <div className="mt-2 max-h-48 space-y-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600">
          {snapshot.nodes.map((node) => (
            <div key={node.id}>
              {node.name} <span className="text-slate-400">({node.kind})</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-black text-slate-900">링크</h3>
        <div className="mt-2 max-h-64 space-y-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600">
          {snapshot.links.map((link) => (
            <div key={link.id}>
              {link.name}: {link.fromNodeId} → {link.toNodeId}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

import { LineGroup } from '../composition'
import {
  AttachToLinkTarget,
  AttachedApartmentSet,
  AttachedCatchBasinSet,
  AttachedHouseSet,
  Connector,
  FacilityPort,
  LineStart,
  Manhole,
  Pipe,
  RainPumpStation,
  StormOverflowFacility,
  WaterReclamationCenter,
} from '../graph'

export interface OverallDrainageDiagramLineProps {
  id?: string
  x?: number
  y?: number
}

const MAIN_SLOPE = 0.001154
const DROP_SLOPE = 0.08
const GROUND_SURFACE_Y = 220

const STORM_PIPE = '#dff1ff'
const STORM_EDGE = '#2f8df4'
const SEWER_PIPE = '#fff4df'
const SEWER_EDGE = '#b97939'
const COMBINED_PIPE = '#eee9ff'
const COMBINED_EDGE = '#7c4dff'
const OVERFLOW_PIPE = '#f4dada'
const OVERFLOW_EDGE = '#d43d3d'
const TREATED_PIPE = '#d8f3df'
const TREATED_EDGE = '#2fb36d'
const SMALL_DARK_PIPE = '#54616d'
const SMALL_SEWER_PIPE = '#5a5146'

function SectionLabel({ x, label }: { x: number; label: string }) {
  return (
    <text
      x={x}
      y={58}
      textAnchor="middle"
      fontSize={34}
      fontWeight={900}
      fill="#172033"
      paintOrder="stroke"
      stroke="rgba(255,255,255,0.92)"
      strokeWidth={7}
    >
      {label}
    </text>
  )
}

function River({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <g id="overall-river" transform={`translate(${x} ${y})`} aria-label="하천">
      <rect width={width} height={height} fill="#24c6cc" opacity={0.96} />
      {Array.from({ length: Math.ceil(height / 28) }, (_, row) => (
        <path
          key={`river-wave-${row}`}
          d={`M0 ${18 + row * 28} C18 ${8 + row * 28} 38 ${28 + row * 28} 58 ${18 + row * 28} S98 ${
            8 + row * 28
          } 118 ${18 + row * 28} S158 ${28 + row * 28} 178 ${18 + row * 28} S218 ${8 + row * 28} 238 ${
            18 + row * 28
          } S278 ${28 + row * 28} 300 ${18 + row * 28}`}
          fill="none"
          stroke="rgba(255,255,255,.65)"
          strokeWidth={2}
        />
      ))}
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        fontSize={28}
        fontWeight={900}
        fill="#083344"
        paintOrder="stroke"
        stroke="rgba(255,255,255,.85)"
        strokeWidth={6}
      >
        하천
      </text>
    </g>
  )
}

function OutfallBox({
  id,
  x,
  y,
  label,
}: {
  id: string
  x: number
  y: number
  label: string
}) {
  return (
    <g id={id} transform={`translate(${x} ${y})`} data-object-kind="outfall-box">
      <rect width={150} height={98} rx={14} fill="#d2fbff" stroke="#128c97" strokeWidth={4} />
      <text
        x={55}
        y={45}
        textAnchor="middle"
        fontSize={20}
        fontWeight={900}
        fill="#172033"
        paintOrder="stroke"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={5}
      >
        {label}
      </text>
      <rect x={96} y={18} width={38} height={62} rx={8} fill="#d1d5db" stroke="#68717d" strokeWidth={3} />
      {[0, 1, 2].map((index) => (
        <line
          key={`${id}-bar-${index}`}
          x1={104}
          x2={126}
          y1={34 + index * 15}
          y2={34 + index * 15}
          stroke="#68717d"
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
    </g>
  )
}

function CatchBasinBranch({
  id,
  name,
  attachTo,
  offset,
}: {
  id: string
  name: string
  attachTo: string
  offset: number
}) {
  return (
    <AttachedCatchBasinSet
      id={id}
      name={name}
      attachTo={attachTo}
      targetAnchor={{ side: 'top', from: 'start', offset }}
      selfAnchor={{ name: 'outlet', side: 'bottom' }}
      surfaceY={GROUND_SURFACE_Y}
      fallbackX={offset}
      fallbackY={100}
    >
      <Connector id={`${id}_outlet`} name={`${name} 배출구`} size="small" angle={90}>
        <Pipe
          id={`${id}_lateral_h`}
          name={`${name} 우수연결관 가로`}
          size="small"
          length={92}
          slope={MAIN_SLOPE}
          color={SMALL_DARK_PIPE}
          borderColor="#111827"
          centerLineColor="rgba(148, 163, 184, 0.78)"
          velocity={0.65}
          volume={28}
          showLabel={false}
        >
          <Connector id={`${id}_elbow`} name={`${name} ㄱ자 접합부`} size="small" turn="clockwise">
            <Connector id={`${id}_after_elbow`} name={`${name} 하향 연결 커넥터`} size="small" angle={90}>
              <Pipe
                id={`${id}_lateral_v`}
                name={`${name} 우수연결관 세로`}
                size="small"
                length={95}
                slope={DROP_SLOPE}
                color={SMALL_DARK_PIPE}
                borderColor="#111827"
                centerLineColor="rgba(148, 163, 184, 0.78)"
                velocity={0.65}
                volume={28}
                showLabel={false}
                stretchToAttachedTarget
              >
                <Connector
                  id={`${id}_terminal`}
                  name={`${name} 본관 접합 커넥터`}
                  size="small"
                  angle={90}
                  anchorName="outlet"
                />
              </Pipe>
            </Connector>
          </Connector>
        </Pipe>
      </Connector>
    </AttachedCatchBasinSet>
  )
}

function HouseWasteBranch({
  id,
  name,
  attachTo,
  offset,
  outletSide = 'right',
}: {
  id: string
  name: string
  attachTo: string
  offset: number
  outletSide?: 'left' | 'right'
}) {
  const turn = outletSide === 'right' ? 'clockwise' : 'counterclockwise'

  return (
    <AttachedHouseSet
      id={id}
      name={name}
      label="주거지 생활오수 발생"
      attachTo={attachTo}
      targetAnchor={{ side: 'top', from: 'start', offset }}
      selfAnchor={{ name: 'outlet', side: 'bottom' }}
      surfaceY={GROUND_SURFACE_Y}
      fallbackX={offset}
      fallbackY={110}
      width={150}
      bodyHeight={78}
      roofHeight={48}
      outletSide={outletSide}
    >
      <Connector id={`${id}_outlet`} name={`${name} 오수 배출구`} size="small" angle={90}>
        <Pipe
          id={`${id}_sewer_h`}
          name={`${name} 오수연결관 가로`}
          size="small"
          length={72}
          slope={MAIN_SLOPE}
          color={SMALL_SEWER_PIPE}
          borderColor="#111827"
          centerLineColor="rgba(148, 163, 184, 0.78)"
          velocity={0.42}
          volume={16}
          showLabel={false}
        >
          <Connector id={`${id}_elbow`} name={`${name} 오수 ㄱ자 접합부`} size="small" turn={turn}>
            <Connector id={`${id}_after_elbow`} name={`${name} 오수 하향 커넥터`} size="small" angle={90}>
              <Pipe
                id={`${id}_sewer_v`}
                name={`${name} 오수연결관 세로`}
                size="small"
                length={90}
                slope={DROP_SLOPE}
                color={SMALL_SEWER_PIPE}
                borderColor="#111827"
                centerLineColor="rgba(148, 163, 184, 0.78)"
                velocity={0.42}
                volume={16}
                showLabel={false}
                stretchToAttachedTarget
              >
                <Connector
                  id={`${id}_terminal`}
                  name={`${name} 오수 본관 접합 커넥터`}
                  size="small"
                  angle={90}
                  anchorName="outlet"
                />
              </Pipe>
            </Connector>
          </Connector>
        </Pipe>
      </Connector>
    </AttachedHouseSet>
  )
}

function ApartmentWasteBranch({
  id,
  name,
  attachTo,
  offset,
  outletSide = 'right',
}: {
  id: string
  name: string
  attachTo: string
  offset: number
  outletSide?: 'left' | 'right'
}) {
  const turn = outletSide === 'right' ? 'clockwise' : 'counterclockwise'

  return (
    <AttachedApartmentSet
      id={id}
      name={name}
      label="아파트 생활오수 발생"
      attachTo={attachTo}
      targetAnchor={{ side: 'top', from: 'start', offset }}
      selfAnchor={{ name: 'outlet', side: 'bottom' }}
      surfaceY={GROUND_SURFACE_Y}
      fallbackX={offset}
      fallbackY={95}
      width={142}
      height={154}
      outletSide={outletSide}
    >
      <Connector id={`${id}_outlet`} name={`${name} 오수 배출구`} size="small" angle={90}>
        <Pipe
          id={`${id}_sewer_h`}
          name={`${name} 오수연결관 가로`}
          size="small"
          length={74}
          slope={MAIN_SLOPE}
          color={SMALL_SEWER_PIPE}
          borderColor="#111827"
          centerLineColor="rgba(148, 163, 184, 0.78)"
          velocity={0.46}
          volume={18}
          showLabel={false}
        >
          <Connector id={`${id}_elbow`} name={`${name} 오수 ㄱ자 접합부`} size="small" turn={turn}>
            <Connector id={`${id}_after_elbow`} name={`${name} 오수 하향 커넥터`} size="small" angle={90}>
              <Pipe
                id={`${id}_sewer_v`}
                name={`${name} 오수연결관 세로`}
                size="small"
                length={90}
                slope={DROP_SLOPE}
                color={SMALL_SEWER_PIPE}
                borderColor="#111827"
                centerLineColor="rgba(148, 163, 184, 0.78)"
                velocity={0.46}
                volume={18}
                showLabel={false}
                stretchToAttachedTarget
              >
                <Connector
                  id={`${id}_terminal`}
                  name={`${name} 오수 본관 접합 커넥터`}
                  size="small"
                  angle={90}
                  anchorName="outlet"
                />
              </Pipe>
            </Connector>
          </Connector>
        </Pipe>
      </Connector>
    </AttachedApartmentSet>
  )
}

export function OverallDrainageDiagramLine({
  id = 'overall-drainage-diagram-line',
  x = 0,
  y = 0,
}: OverallDrainageDiagramLineProps) {
  return (
    <LineGroup id={id} name="전체 도시 배수도" x={x} y={y}>
      <rect x={0} y={GROUND_SURFACE_Y} width={4300} height={1350} fill="#a86435" opacity={0.18} />
      <path
        d={`M0 ${GROUND_SURFACE_Y + 30} C52 ${GROUND_SURFACE_Y + 12} 104 ${GROUND_SURFACE_Y + 48} 156 ${
          GROUND_SURFACE_Y + 30
        } S260 ${GROUND_SURFACE_Y + 12} 312 ${GROUND_SURFACE_Y + 30} S416 ${GROUND_SURFACE_Y + 48} 468 ${
          GROUND_SURFACE_Y + 30
        } S572 ${GROUND_SURFACE_Y + 12} 624 ${GROUND_SURFACE_Y + 30} S728 ${GROUND_SURFACE_Y + 48} 780 ${
          GROUND_SURFACE_Y + 30
        } S884 ${GROUND_SURFACE_Y + 12} 936 ${GROUND_SURFACE_Y + 30} S1040 ${GROUND_SURFACE_Y + 48} 1092 ${
          GROUND_SURFACE_Y + 30
        } S1196 ${GROUND_SURFACE_Y + 12} 1248 ${GROUND_SURFACE_Y + 30} S1352 ${GROUND_SURFACE_Y + 48} 1404 ${
          GROUND_SURFACE_Y + 30
        } S1508 ${GROUND_SURFACE_Y + 12} 1560 ${GROUND_SURFACE_Y + 30} S1664 ${GROUND_SURFACE_Y + 48} 1716 ${
          GROUND_SURFACE_Y + 30
        } S1820 ${GROUND_SURFACE_Y + 12} 1872 ${GROUND_SURFACE_Y + 30} S1976 ${GROUND_SURFACE_Y + 48} 2028 ${
          GROUND_SURFACE_Y + 30
        } S2132 ${GROUND_SURFACE_Y + 12} 2184 ${GROUND_SURFACE_Y + 30} S2288 ${GROUND_SURFACE_Y + 48} 2340 ${
          GROUND_SURFACE_Y + 30
        } S2444 ${GROUND_SURFACE_Y + 12} 2496 ${GROUND_SURFACE_Y + 30} S2600 ${GROUND_SURFACE_Y + 48} 2652 ${
          GROUND_SURFACE_Y + 30
        } S2756 ${GROUND_SURFACE_Y + 12} 2808 ${GROUND_SURFACE_Y + 30} S2912 ${GROUND_SURFACE_Y + 48} 2964 ${
          GROUND_SURFACE_Y + 30
        } S3068 ${GROUND_SURFACE_Y + 12} 3120 ${GROUND_SURFACE_Y + 30}`}
        fill="none"
        stroke="rgba(255,255,255,.16)"
        strokeWidth={4}
      />
      <line x1={1650} y1={40} x2={1650} y2={1500} stroke="rgba(51,65,85,.35)" strokeDasharray="8 8" />
      <SectionLabel x={800} label="분류식" />
      <SectionLabel x={2600} label="합류식" />
      <River x={4040} y={20} width={260} height={1480} />

      <LineStart id="sep_storm_main_start" name="분류식 우수본관 시작" x={260} y={560}>
        <Pipe
          id="sep_storm_main_1"
          name="우수 본관 1"
          size="medium"
          length={540}
          slope={MAIN_SLOPE}
          color={STORM_PIPE}
          borderColor={STORM_EDGE}
          velocity={1.1}
          volume={24}
        >
          <Connector id="sep_storm_manhole_in" name="분류식 우수 맨홀 유입" size="medium" angle={90}>
            <Manhole
              id="sep_storm_manhole"
              name="우수 맨홀"
              size="medium"
              surfaceY={GROUND_SURFACE_Y}
              volume={36}
              rimColor={STORM_EDGE}
              lidColor="#2453d8"
            >
              <Connector id="sep_storm_manhole_out" name="분류식 우수 맨홀 유출" size="medium" angle={90}>
                <Pipe
                  id="sep_storm_main_2"
                  name="우수 본관 2"
                  size="medium"
                  length={520}
                  slope={MAIN_SLOPE}
                  color={STORM_PIPE}
                  borderColor={STORM_EDGE}
                  velocity={1.1}
                  volume={24}
                >
                  <Connector id="sep_storm_drop_start" name="우수본관에서 간선관거로 내려가는 접합부" size="medium" angle={90}>
                    <AttachToLinkTarget
                      attachTo="storm_trunk_downstream"
                      targetAnchor={{ side: 'top', from: 'start', offset: 360 }}
                    >
                      <Pipe
                        id="sep_storm_drop_h"
                        name="우수본관에서 우수간선관거로 내려가는 가로 연결관"
                        size="medium"
                        length={90}
                        slope={MAIN_SLOPE}
                        color={STORM_PIPE}
                        borderColor={STORM_EDGE}
                        velocity={1}
                        volume={20}
                        showLabel={false}
                        stretchToAttachedTarget
                      >
                        <Connector id="sep_storm_drop_elbow" name="우수본관 하향 ㄱ자 접합부" size="medium" turn="clockwise">
                          <Connector id="sep_storm_drop_after_elbow" name="우수본관 하향 커넥터" size="medium" angle={90}>
                            <Pipe
                              id="sep_storm_drop_v"
                              name="우수본관에서 우수간선관거로 내려가는 세로 연결관"
                              size="medium"
                              length={260}
                              slope={DROP_SLOPE}
                              color={STORM_PIPE}
                              borderColor={STORM_EDGE}
                              velocity={1}
                              volume={20}
                              showLabel={false}
                              stretchToAttachedTarget
                            >
                              <Connector id="sep_storm_drop_terminal" name="우수간선관거 연결 커넥터" size="medium" angle={90} />
                            </Pipe>
                          </Connector>
                        </Connector>
                      </Pipe>
                    </AttachToLinkTarget>
                  </Connector>
                </Pipe>
              </Connector>
            </Manhole>
          </Connector>
        </Pipe>
      </LineStart>

      <LineStart id="sep_sewer_main_start" name="분류식 오수본관 시작" x={220} y={800}>
        <Pipe
          id="sep_sewer_main_1"
          name="오수 본관 1"
          size="medium"
          length={620}
          slope={MAIN_SLOPE}
          color={SEWER_PIPE}
          borderColor={SEWER_EDGE}
          velocity={0.62}
          volume={16}
        >
          <Connector id="sep_sewer_manhole_in" name="분류식 오수 맨홀 유입" size="medium" angle={90}>
            <Manhole
              id="sep_sewer_manhole"
              name="오수 맨홀"
              size="medium"
              surfaceY={GROUND_SURFACE_Y}
              volume={24}
              rimColor={SEWER_EDGE}
              lidColor="#d97706"
            >
              <Connector id="sep_sewer_manhole_out" name="분류식 오수 맨홀 유출" size="medium" angle={90}>
                <Pipe
                  id="sep_sewer_main_2"
                  name="오수 본관 2"
                  size="medium"
                  length={540}
                  slope={MAIN_SLOPE}
                  color={SEWER_PIPE}
                  borderColor={SEWER_EDGE}
                  velocity={0.62}
                  volume={16}
                >
                  <Connector id="sep_sewer_drop_start" name="오수본관에서 차집관거로 내려가는 접합부" size="medium" angle={90}>
                    <AttachToLinkTarget
                      attachTo="interceptor_main"
                      targetAnchor={{ side: 'top', from: 'start', offset: 1040 }}
                    >
                      <Pipe
                        id="sep_sewer_drop_h"
                        name="오수본관에서 차집관거로 내려가는 가로 연결관"
                        size="medium"
                        length={90}
                        slope={MAIN_SLOPE}
                        color={SEWER_PIPE}
                        borderColor={SEWER_EDGE}
                        velocity={0.55}
                        volume={18}
                        showLabel={false}
                        stretchToAttachedTarget
                      >
                        <Connector id="sep_sewer_drop_elbow" name="오수본관 하향 ㄱ자 접합부" size="medium" turn="clockwise">
                          <Connector id="sep_sewer_drop_after_elbow" name="오수본관 하향 커넥터" size="medium" angle={90}>
                            <Pipe
                              id="sep_sewer_drop_v"
                              name="오수본관에서 차집관거로 내려가는 세로 연결관"
                              size="medium"
                              length={280}
                              slope={DROP_SLOPE}
                              color={SEWER_PIPE}
                              borderColor={SEWER_EDGE}
                              velocity={0.55}
                              volume={18}
                              showLabel={false}
                              stretchToAttachedTarget
                            >
                              <Connector id="sep_sewer_drop_terminal" name="차집관거 연결 커넥터" size="medium" angle={90} />
                            </Pipe>
                          </Connector>
                        </Connector>
                      </Pipe>
                    </AttachToLinkTarget>
                  </Connector>
                </Pipe>
              </Connector>
            </Manhole>
          </Connector>
        </Pipe>
      </LineStart>

      <LineStart id="storm_trunk_start" name="우수간선관거 시작" x={260} y={1100}>
        <Pipe
          id="storm_trunk_upstream"
          name="우수 간선관거"
          size="large"
          length={1380}
          slope={MAIN_SLOPE}
          color={STORM_PIPE}
          borderColor={STORM_EDGE}
          velocity={1.35}
          volume={20}
        >
          <Connector id="storm_trunk_mid_connector" name="우수간선관거 중간 접합부" size="large" angle={90}>
            <Pipe
              id="storm_trunk_downstream"
              name="우수 간선관거 하류"
              size="large"
              length={1180}
              slope={MAIN_SLOPE}
              color={STORM_PIPE}
              borderColor={STORM_EDGE}
              velocity={1.35}
              volume={22}
            >
              <RainPumpStation id="storm_pump_station_overall" name="빗물펌프장" width={390} height={132} volume={24} active>
                <Pipe
                  id="pump_discharge_pipe"
                  name="펌프 토출관"
                  size="large"
                  length={560}
                  slope={MAIN_SLOPE}
                  color="#d6e2e3"
                  borderColor={STORM_EDGE}
                  velocity={1.7}
                  volume={18}
                >
                  <Connector id="pump_outfall_connector" name="펌프 방류구 연결 커넥터" size="large" angle={90} />
                </Pipe>
              </RainPumpStation>
            </Pipe>
          </Connector>
        </Pipe>
      </LineStart>

      <LineStart id="interceptor_start" name="차집관거 시작" x={240} y={1420}>
        <Pipe
          id="interceptor_main"
          name="차집관거"
          size="large"
          length={2450}
          slope={MAIN_SLOPE}
          color="#f5ddb7"
          borderColor={SEWER_EDGE}
          velocity={0.74}
          volume={18}
        >
          <WaterReclamationCenter id="water_reclamation_center_overall" name="물재생센터" width={380} height={132} volume={18}>
            <Pipe
              id="treated_effluent_pipe_overall"
              name="처리수 방류관"
              size="large"
              length={620}
              slope={MAIN_SLOPE}
              color={TREATED_PIPE}
              borderColor={TREATED_EDGE}
              velocity={0.65}
              volume={12}
            >
              <Connector id="treated_outfall_connector" name="처리수 방류구 연결 커넥터" size="large" angle={90} />
            </Pipe>
          </WaterReclamationCenter>
        </Pipe>
      </LineStart>

      <LineStart id="combined_main_start" name="합류식 본관 시작" x={1960} y={655}>
        <Pipe
          id="combined_main_1"
          name="합류식 본관 1"
          size="medium"
          length={720}
          slope={MAIN_SLOPE}
          color={COMBINED_PIPE}
          borderColor={COMBINED_EDGE}
          velocity={0.92}
          volume={28}
        >
          <Connector id="combined_manhole_in" name="합류식 맨홀 유입" size="medium" angle={90}>
            <Manhole
              id="combined_manhole"
              name="합류식 맨홀"
              size="medium"
              surfaceY={GROUND_SURFACE_Y}
              volume={38}
              rimColor={COMBINED_EDGE}
              lidColor="#6d4ce8"
            >
              <Connector id="combined_manhole_out" name="합류식 맨홀 유출" size="medium" angle={90}>
                <Pipe
                  id="combined_main_2"
                  name="합류식 본관 2"
                  size="medium"
                  length={760}
                  slope={MAIN_SLOPE}
                  color={COMBINED_PIPE}
                  borderColor={COMBINED_EDGE}
                  velocity={0.95}
                  volume={34}
                >
                  <StormOverflowFacility
                    id="combined_overflow_facility"
                    name="우수토실-월류시설"
                    width={520}
                    height={168}
                    volume={34}
                    gateOpen={0.35}
                    inletPortSize="medium"
                    normalPortSize="large"
                    overflowPortSize="large"
                  >
                    <FacilityPort name="overflow" side="right" size="large">
                      <Pipe
                        id="overflow_pipe_overall"
                        name="월류관"
                        size="large"
                        length={860}
                        slope={MAIN_SLOPE}
                        color={OVERFLOW_PIPE}
                        borderColor={OVERFLOW_EDGE}
                        velocity={1.15}
                        volume={14}
                      >
                        <Connector id="overflow_outfall_connector_overall" name="월류 방류구 연결 커넥터" size="large" angle={90} />
                      </Pipe>
                    </FacilityPort>
                    <FacilityPort name="normal-flow" side="bottom" from="center" offset={0} size="large">
                      <AttachToLinkTarget
                        attachTo="interceptor_main"
                        targetAnchor={{ side: 'top', from: 'start', offset: 2540 }}
                      >
                        <Pipe
                          id="overflow_to_interceptor_drop_v_overall"
                          name="우수토실 일반 유량에서 내려가는 세로관"
                          size="large"
                          length={420}
                          slope={DROP_SLOPE}
                          color={COMBINED_PIPE}
                          borderColor={COMBINED_EDGE}
                          velocity={0.78}
                          volume={22}
                          showLabel={false}
                          stretchToAttachedTarget
                        >
                          <Connector
                            id="overflow_to_interceptor_elbow_overall"
                            name="우수토실에서 차집관거로 가는 ㄱ자 접합부"
                            size="large"
                            turn="counterclockwise"
                          >
                            <Pipe
                              id="overflow_to_interceptor_h_overall"
                              name="우수토실 일반 유량에서 차집관거로 들어가는 가로관"
                              size="large"
                              length={120}
                              slope={MAIN_SLOPE}
                              color={COMBINED_PIPE}
                              borderColor={COMBINED_EDGE}
                              velocity={0.78}
                              volume={22}
                              showLabel={false}
                              stretchToAttachedTarget
                            >
                              <Connector
                                id="overflow_to_interceptor_terminal_overall"
                                name="차집관거 유입 커넥터"
                                size="large"
                                angle={90}
                              />
                            </Pipe>
                          </Connector>
                        </Pipe>
                      </AttachToLinkTarget>
                    </FacilityPort>
                  </StormOverflowFacility>
                </Pipe>
              </Connector>
            </Manhole>
          </Connector>
        </Pipe>
      </LineStart>

      <ApartmentWasteBranch id="sep_apartment_1" name="분류식 아파트 1" attachTo="sep_sewer_main_1" offset={120} />
      <ApartmentWasteBranch id="sep_apartment_2" name="분류식 아파트 2" attachTo="sep_sewer_main_2" offset={110} outletSide="left" />
      <CatchBasinBranch id="sep_cb_1" name="분류식 빗물받이 1" attachTo="sep_storm_main_1" offset={130} />
      <CatchBasinBranch id="sep_cb_2" name="분류식 빗물받이 2" attachTo="sep_storm_main_2" offset={130} />

      <HouseWasteBranch id="combined_house_1" name="합류식 주거지 1" attachTo="combined_main_1" offset={110} />
      <HouseWasteBranch id="combined_house_2" name="합류식 주거지 2" attachTo="combined_main_1" offset={410} outletSide="left" />
      <CatchBasinBranch id="combined_cb_1" name="합류식 빗물받이 1" attachTo="combined_main_1" offset={650} />
      <CatchBasinBranch id="combined_cb_2" name="합류식 빗물받이 2" attachTo="combined_main_2" offset={250} />

      <OutfallBox id="overflow_outfall_box" x={3920} y={560} label="월류 방류구" />
      <OutfallBox id="pump_outfall_box" x={3920} y={925} label="펌프 방류구" />
      <OutfallBox id="treated_outfall_box" x={3920} y={1190} label="처리수 방류구" />
    </LineGroup>
  )
}

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

export interface SeparatedStormLineProps {
  id?: string
  x?: number
  y?: number
}

const MAIN_SLOPE = 0.001154
const DROP_SLOPE = 0.08
const GROUND_SURFACE_Y = 220

export function SeparatedStormLine({
  id = 'separated-storm-line',
  x = 0,
  y = 0,
}: SeparatedStormLineProps) {
  return (
    <LineGroup id={id} name="분류식 우수라인" x={x} y={y}>
      <text
        x={700}
        y={44}
        textAnchor="middle"
        fontSize={34}
        fontWeight={900}
        fill="#172033"
        paintOrder="stroke"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={6}
      >
        분류식 우수라인
      </text>

      <AttachedHouseSet
        id="separated_house_demo"
        name="주거지"
        label="주거지 생활오수 발생"
        attachTo="storm_main_1_downstream"
        targetAnchor={{ side: 'top', from: 'center', offset: 100 }}
        selfAnchor={{ name: 'outlet', side: 'bottom' }}
        surfaceY={GROUND_SURFACE_Y}
        fallbackX={440}
        fallbackY={90}
        width={150}
        bodyHeight={78}
        roofHeight={48}
        outletSide="left"
      >
        <Connector id="house_demo_outlet" name="주거지 오수 배출구" size="small" angle={90}>
          <Pipe
            id="house_demo_sewer_h"
            name="주거지 오수연결관 가로"
            size="small"
            length={58}
            slope={MAIN_SLOPE}
            color="#5a5146"
            borderColor="#111827"
            centerLineColor="rgba(148, 163, 184, 0.78)"
            velocity={0.45}
            volume={16}
            showLabel={false}
          >
            <Connector id="house_demo_elbow" name="주거지 오수 ㄱ자 접합부" size="small" turn="counterclockwise">
              <Connector id="house_demo_after_elbow" name="주거지 오수 하향 연결 커넥터" size="small" angle={90}>
                <Pipe
                  id="house_demo_sewer_v"
                  name="주거지 오수연결관 세로"
                  size="small"
                  length={70}
                  slope={DROP_SLOPE}
                  color="#5a5146"
                  borderColor="#111827"
                  centerLineColor="rgba(148, 163, 184, 0.78)"
                  velocity={0.45}
                  volume={16}
                  showLabel={false}
                  stretchToAttachedTarget
                >
                  <Connector
                    id="house_demo_terminal"
                    name="주거지 오수 말단 커넥터"
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

      <AttachedApartmentSet
        id="separated_apartment_demo"
        name="아파트"
        label="아파트 생활오수 발생"
        attachTo="storm_trunk_1_upstream"
        targetAnchor={{ side: 'top', from: 'center', offset: 0 }}
        selfAnchor={{ name: 'outlet', side: 'bottom' }}
        surfaceY={GROUND_SURFACE_Y}
        fallbackX={680}
        fallbackY={90}
        width={132}
        height={148}
        outletSide="right"
      >
        <Connector id="apartment_demo_outlet" name="아파트 오수 배출구" size="small" angle={90}>
          <Pipe
            id="apartment_demo_sewer_h"
            name="아파트 오수연결관 가로"
            size="small"
            length={62}
            slope={MAIN_SLOPE}
            color="#5a5146"
            borderColor="#111827"
            centerLineColor="rgba(148, 163, 184, 0.78)"
            velocity={0.5}
            volume={18}
            showLabel={false}
          >
            <Connector id="apartment_demo_elbow" name="아파트 오수 ㄱ자 접합부" size="small" turn="clockwise">
              <Connector id="apartment_demo_after_elbow" name="아파트 오수 하향 연결 커넥터" size="small" angle={90}>
                <Pipe
                  id="apartment_demo_sewer_v"
                  name="아파트 오수연결관 세로"
                  size="small"
                  length={74}
                  slope={DROP_SLOPE}
                  color="#5a5146"
                  borderColor="#111827"
                  centerLineColor="rgba(148, 163, 184, 0.78)"
                  velocity={0.5}
                  volume={18}
                  showLabel={false}
                  stretchToAttachedTarget
                >
                  <Connector
                    id="apartment_demo_terminal"
                    name="아파트 오수 말단 커넥터"
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

      <LineStart id="storm_main_1_start" name="우수본관1 시작 노드" x={220} y={600}>
        <Pipe
          id="storm_main_1_upstream"
          name="우수본관1 상류"
          size="medium"
          length={485}
          slope={MAIN_SLOPE}
          velocity={1.1}
          volume={24}
          angle={0}
        >
          <Connector
            id="storm_main_join_1"
            name="우수본관1 빗물받이 접합부"
            size="medium"
            visualOwner="storm_main_1"
            showVisual={true}
            angle={90}
          >
            <Manhole
              id="storm_manhole_1"
              name="우수 맨홀"
              size="medium"
              surfaceY={GROUND_SURFACE_Y}
              volume={42}
              lidOpen={0}
              shaftFill="#bcc5cc"
              rimColor="#2f8df4"
              lidColor="#2453d8"
            >
              <Connector
                id="storm_main_join_2"
                name="우수본관1 빗물받이 접합부"
                size="medium"
                visualOwner="storm_main_1"
                showVisual={true}
                angle={90}
              >
                <Pipe
                  id="storm_main_1_downstream"
                  name="우수본관1 하류"
                  size="medium"
                  length={300}
                  slope={MAIN_SLOPE}
                  velocity={1.1}
                  volume={24}
                >
                  <Connector
                    id="storm_main_2_drop_start"
                    name="우수본관2 하류 접합부"
                    size="medium"
                    visualOwner="storm_main_2"
                    angle={90}
                  >
                    <AttachToLinkTarget
                      attachTo="storm_trunk_1_downstream"
                      targetAnchor={{ side: 'top', from: 'start', offset: 0 }}
                    >
                      <Pipe
                        id="storm_main_2_drop_h"
                        name="우수본관2에서 우수간선관거로 내려가는 연결관 가로"
                        size="medium"
                        length={80}
                        slope={MAIN_SLOPE}
                        velocity={1}
                        volume={20}
                        showLabel={false}
                      >
                        <Connector
                          id="storm_main_2_drop_elbow"
                          name="우수본관2 하향 ㄱ자 접합부"
                          size="medium"
                          turn="clockwise"
                        >
                          <Connector
                            id="storm_main_2_drop_after_elbow"
                            name="우수본관2 하향 연결 커넥터"
                            size="medium"
                            angle={90}
                          >
                            <Pipe
                              id="storm_main_2_drop_v"
                              name="우수본관2에서 우수간선관거로 내려가는 연결관 세로"
                              size="medium"
                              length={220}
                              slope={DROP_SLOPE}
                              velocity={1}
                              volume={20}
                              showLabel={false}
                              stretchToAttachedTarget
                            >
                              <Connector
                                id="storm_main_2_to_trunk_terminal"
                                name="우수본관2 우수간선관거 하류 접합 커넥터"
                                size="medium"
                                angle={90}
                              />
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

      <LineStart id="storm_trunk_1_start" name="우수간선관거 시작 노드" x={620} y={1890}>
        <Pipe
          id="storm_trunk_1_upstream"
          name="우수간선관거 상류"
          size="large"
          length={430}
          slope={MAIN_SLOPE}
          velocity={1.3}
          volume={20}
        >
          <Connector
            id="storm_trunk_join_1"
            name="우수본관2 유입 접합부"
            size="large"
            visualOwner="storm_trunk_1"
            angle={90}
          >
            <Pipe
              id="storm_trunk_1_downstream"
              name="우수간선관거 하류"
              size="large"
              length={280}
              slope={MAIN_SLOPE}
              velocity={1.3}
              volume={20}
            >
              <RainPumpStation
                id="storm_pump_station"
                name="빗물펌프장"
                width={330}
                height={128}
                volume={28}
                active
              >
                <Pipe
                  id="storm_pump_discharge_pipe"
                  name="펌프 토출관"
                  size="large"
                  length={260}
                  slope={MAIN_SLOPE}
                  velocity={1.7}
                  volume={16}
                  color="#dbeafe"
                  borderColor="#2f8df4"
                >
                  <Connector
                    id="storm_pump_outfall_connector"
                    name="펌프 방류구 연결 커넥터"
                    size="large"
                    visualOwner="storm_pump_outfall"
                    angle={90}
                  />
                </Pipe>
              </RainPumpStation>
            </Pipe>
          </Connector>
        </Pipe>
      </LineStart>

      <LineStart id="combined_overflow_demo_start" name="합류식 본관 데모 시작 노드" x={560} y={1420}>
        <Pipe
          id="combined_main_demo"
          name="합류식 본관 데모"
          size="medium"
          length={260}
          slope={MAIN_SLOPE}
          velocity={0.9}
          volume={34}
          color="#eee9ff"
          borderColor="#7c4dff"
        >
          <StormOverflowFacility
            id="storm_overflow_facility"
            name="우수토실-월류시설"
            width={360}
            height={160}
            volume={38}
            gateOpen={0.18}
            inletPortSize="medium"
            normalPortSize="large"
            overflowPortSize="large"
          >
            <FacilityPort name="overflow" side="right" size="large">
              <Pipe
                id="overflow_discharge_pipe"
                name="월류관"
                size="large"
                length={330}
                slope={MAIN_SLOPE}
                velocity={1.1}
                volume={14}
                color="#f4dada"
                borderColor="#d43d3d"
              >
                <Connector
                  id="overflow_outfall_connector"
                  name="월류 방류구 연결 커넥터"
                  size="large"
                  visualOwner="overflow_outfall"
                  angle={90}
                />
              </Pipe>
            </FacilityPort>
            <FacilityPort name="normal-flow" side="bottom" from="start" offset={135} size="large">
              <AttachToLinkTarget
                attachTo="interceptor_demo_pipe"
                targetAnchor={{ side: 'top', from: 'center', offset: 0 }}
              >
                <Pipe
                  id="overflow_to_interceptor_drop"
                  name="우수토실 일반 유량에서 차집관거로 내려가는 관"
                  size="large"
                  length={460}
                  slope={DROP_SLOPE}
                  velocity={0.8}
                  volume={22}
                  color="#eee9ff"
                  borderColor="#7c4dff"
                  showLabel={false}
                  stretchToAttachedTarget
                >
                  <Connector
                    id="overflow_to_interceptor_terminal"
                    name="우수토실 일반 유량 차집관거 연결 커넥터"
                    size="large"
                    visualOwner="interceptor_demo_pipe"
                    angle={90}
                  />
                </Pipe>
              </AttachToLinkTarget>
            </FacilityPort>
          </StormOverflowFacility>
        </Pipe>
      </LineStart>

      <LineStart id="interceptor_demo_start" name="차집관거 데모 시작 노드" x={220} y={2200}>
        <Pipe
          id="interceptor_demo_pipe"
          name="차집관거"
          size="large"
          length={420}
          slope={MAIN_SLOPE}
          velocity={0.75}
          volume={18}
          color="#fde6c0"
          borderColor="#b97939"
        >
          <WaterReclamationCenter
            id="water_reclamation_center"
            name="물재생센터"
            width={360}
            height={128}
            volume={20}
          >
            <Pipe
              id="treated_effluent_pipe"
              name="처리수 방류관"
              size="large"
              length={300}
              slope={MAIN_SLOPE}
              velocity={0.6}
              volume={12}
              color="#d8f3df"
              borderColor="#2fb36d"
            >
              <Connector
                id="treated_effluent_outfall_connector"
                name="처리수 방류구 연결 커넥터"
                size="large"
                visualOwner="treated_effluent_outfall"
                angle={90}
              />
            </Pipe>
          </WaterReclamationCenter>
        </Pipe>
      </LineStart>

      <AttachedCatchBasinSet
        id="cb1"
        name="빗물받이1"
        attachTo="storm_main_1_upstream"
        targetAnchor={{ side: 'top', from: 'center', offset: 0 }}
        selfAnchor={{ name: 'outlet', side: 'bottom' }}
        surfaceY={GROUND_SURFACE_Y}
        fallbackX={420}
        fallbackY={90}
        outletSide="right"
      >
        <Connector id="cb1_outlet" name="빗물받이1 배출구" size="small" angle={90}>
          <Pipe
            id="cb1_lateral_h"
            name="빗물받이1 우수연결관 가로"
            size="small"
            length={95}
            slope={MAIN_SLOPE}
            color="#54616d"
            borderColor="#111827"
            centerLineColor="rgba(148, 163, 184, 0.78)"
            velocity={0.8}
            volume={30}
            showLabel={false}
            angle={0}
          >
            <Connector id="cb1_elbow" name="빗물받이1 ㄱ자 접합부" size="small" turn="clockwise" angle={0}>
              <Connector
                id="cb1_after_elbow"
                name="빗물받이1 하향 연결 커넥터"
                size="small"
                angle={90}
              >
                <Pipe
                  id="cb1_lateral_v"
                  name="빗물받이1 우수연결관 세로"
                  size="small"
                  length={70}
                  slope={DROP_SLOPE}
                  color="#54616d"
                  borderColor="#111827"
                  centerLineColor="rgba(148, 163, 184, 0.78)"
                  velocity={0.8}
                  volume={30}
                  showLabel={false}
                  stretchToAttachedTarget
                >
                  <Connector
                    id="cb1_main_join_connector"
                    name="빗물받이1 우수본관 접합 커넥터"
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
    </LineGroup>
  )
}

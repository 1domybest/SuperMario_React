# React 배수도 렌더링 구조화 및 UI 성능 최적화 계획

## 목적

편집모드와 시뮬레이션모드는 모두 같은 `EditorLayout` JSON을 화면에 렌더링한다. 차이는 편집모드는 객체 이동, 리사이즈, 포트 연결, 시나리오 저장을 수행하고, 시뮬레이션모드는 서버/SWMM 엔진에서 받은 runtime snapshot을 덧씌운다는 점이다.

현재 목표는 SVG 렌더링 방식을 유지하면서 다음을 달성하는 것이다.

- `EditorCanvas.tsx`에 몰린 렌더링, 편집 이벤트, 패널 UI, 도메인 계산을 단계적으로 분리한다.
- 편집모드와 시뮬레이션모드가 공통 `DiagramScene` 렌더러를 공유하게 만든다.
- 드래그, 리사이즈, WebSocket tick 중 불필요한 React rerender를 줄인다.
- 기능 추가보다 구조 안정화, 가독성, UI 부드러움을 우선한다.

## 현재 상태

### 2026-06-22 안정화 기준

현재 편집모드와 시뮬레이션모드 모두 체감 성능 개선이 확인된 상태다. 따라서 당장 다음 목표는 더 큰 공통 렌더러 이관이 아니라, 지금 동작하는 구조를 안정화하고 회귀 검증 기준을 고정하는 것이다.

- 현재 완료로 보는 범위
  - 편집모드 노드/링크 렌더 컴포넌트 분리
  - 편집모드 드래그/리사이즈 draft 기반 preview와 pointer up commit
  - relation 포트 lookup 재계산 범위 축소
  - 시뮬레이션 runtime badge/overlay memo 경계 분리
  - 시뮬레이션 relation/upstream/node layer memo 경계 분리
  - SVG animation용 반복 배열/경로 계산 memoization
  - `npm run lint`, `npm run build` 통과 기준 유지

- 안정화 중 보류하는 범위
  - `DiagramScene`으로 편집모드와 시뮬레이션모드를 한 번에 합치는 작업
  - `EditorCanvas.tsx`, `SimulationLayoutPreview.tsx`의 대규모 추가 분리
  - Canvas/WebGL 전환

- 다음 작업 기준
  - 먼저 `docs/react-rendering-verification-checklist.md`의 체크리스트로 현재 기능을 수동 검증한다.
  - 기능 회귀가 없으면 이 상태를 기준점으로 삼고, 이후 리팩토링은 작은 단위로만 진행한다.
  - 체감 성능 문제가 다시 보이면 Chrome Performance 기록을 기준으로 병목을 재측정한다.

### 완료된 1차 작업

- `src/components/diagram/SoilBackground.tsx` 추가
  - 편집모드와 시뮬레이션모드의 토지/하늘 배경 렌더링 공통화 시작.
- `src/components/diagram/useLayoutIndexes.ts` 추가
  - `nodesById`, `linksById`, `relationsByNodeId` selector 제공.
- `src/components/diagram/useRafCoalescedCallback.ts` 추가
  - pointer move 이벤트를 `requestAnimationFrame` 단위로 묶는 기반 훅 제공.
- `EditorCanvas.tsx`
  - 선택 노드/링크 조회 일부를 `find` 반복 대신 map selector로 변경.
  - pointer move 처리 일부를 RAF coalescing으로 변경.
  - 토지 배경 렌더링을 `SoilBackground`로 교체.
- `SimulationLayoutPreview.tsx`
  - 토지 배경 렌더링을 `SoilBackground`로 교체.
  - runtime node, relation guide 일부에 `React.memo` 적용.
  - bounds와 정렬된 노드 목록을 `useMemo` 기반으로 정리.
- `SimulationWorkbench.tsx`
  - 선택 노드 조회를 selector 기반으로 변경.
  - 일부 이벤트 핸들러와 파생 배열을 `useCallback`, `useMemo`로 안정화.

### 진행된 2차 작업

- `src/components/editor/editorRelations.ts` 추가
  - relation endpoint 좌표, path 계산, attach metadata 정규화, relation graph 탐색 helper를 `EditorCanvas.tsx`에서 분리.
  - 편집모드와 시뮬레이션이 같은 `normalizeRelationAttachments`를 import하도록 정리.
- `src/components/editor/EditorLinkRenderer.tsx` 추가
  - SVG link/relation 렌더링 컴포넌트를 `EditorCanvas.tsx`에서 분리.
  - `React.memo` 적용을 유지할 수 있도록 link 렌더러를 별도 컴포넌트화.
- `src/components/editor/editorLinkRenderData.ts` 추가
  - link path, endpoint 좌표, relation arrow size 계산을 컴포넌트 파일 밖의 selector 성격 helper로 분리.
  - Fast Refresh 규칙을 지키기 위해 컴포넌트 export와 non-component export를 분리.
- `src/components/editor/EditorPipeNode.tsx` 추가
  - 파이프 세그먼트, 흐름 화살표, 파이프 라벨, 커넥터 캡 렌더링을 `EditorCanvas.tsx`에서 분리.
  - `PipeSegmentNode`, `ConnectorCap`에 `React.memo`를 적용해 변경 없는 파이프 렌더링 범위를 줄이는 기반 마련.
- `src/components/editor/EditorNodeBody.tsx` 추가
  - 지형, 도로, 건물, 맨홀, 커넥터, 시설, 방류구 노드 본체 렌더링을 `EditorCanvas.tsx`에서 분리.
  - `EditorCanvas.tsx`는 노드 본체를 직접 정의하지 않고 `NodeBody`만 import해 사용하도록 축소.
  - `NodeBody`에 `React.memo`를 적용해 다음 공통 `DiagramNode` 분리를 위한 경계를 마련.
- `src/components/editor/EditableNode.tsx` 추가
  - 노드 wrapper, 포트 표시, attach 상태 표시, resize handle 조립을 `EditorCanvas.tsx`에서 분리.
  - 포트 계산과 resize handle 렌더링은 기존 함수를 props로 주입해 동작 변경 없이 경계만 나눔.
  - `EditableNode`에 `React.memo`를 적용해 다음 selector/memo 최적화의 단위 컴포넌트로 사용할 수 있게 정리.
- `src/components/editor/editorNodeRenderData.ts` 추가
  - relation 보정 포트 좌표, 렌더 대상 포트 목록, attach/manual resize edge 계산을 `EditorCanvas.tsx`에서 분리.
  - `EditableNode`에 주입하는 selector 함수들을 별도 파일로 모아 다음 `DiagramNode` 공통화 준비.
- `src/components/editor/EditorAffordances.tsx` 추가
  - 지형/기본 레이아웃 확장용 `LayoutAddHandles`와 수동 리사이즈용 `PipeResizeHandles`를 `EditorCanvas.tsx`에서 분리.
  - 편집 전용 affordance를 별도 컴포넌트로 묶어 향후 `DiagramScene`의 editor-only layer로 옮기기 쉽게 정리.
- `src/components/editor/editorRenderOrder.ts` 추가
  - 노드 레이어 우선순위, 사용자 `zOrder`, relation depth 기반 렌더 정렬을 `EditorCanvas.tsx`에서 분리.
  - 컨텍스트 메뉴의 앞으로/뒤로 보내기 z-order 재배치 로직을 helper로 이동.
- `src/components/editor/editorSelection.ts` 추가
  - relation 그룹 선택 확장, marquee 선택, drag origin 계산, 복사/붙여넣기 스냅샷 생성 로직을 `EditorCanvas.tsx`에서 분리.
  - 복사한 relation 그룹을 새 ID와 이름으로 재생성하는 paste helper를 독립시켜 단축키 처리부를 얇게 정리.
- `src/components/editor/editorNodePlacement.ts` 추가
  - 지상/고정 y 객체의 `snapNodeToGround` 로직을 공통 helper로 이동.
  - `EditorCanvas.tsx`와 `EditorSelectionPanel.tsx`가 동일한 지상 스냅 기준을 공유하도록 정리.
- `src/components/editor/useEditorLayoutState.ts` 추가
  - localStorage 저장, undo/redo, batch history reducer를 `EditorCanvas.tsx`에서 분리.
  - legacy layout 정규화는 `normalizeLayout` 콜백으로 주입해 기존 마이그레이션 동작은 유지.
- 드래그/리사이즈 프레임당 반복 계산 축소
  - `DragState`에 `groupNodeIdSet`, `hasFixedYNode`를 저장해 pointer move 프레임마다 Set 생성과 고정 y 노드 탐색을 반복하지 않도록 정리.
  - `ResizeState`에 `childResizeEdge`, `hasFixedYNode`를 저장해 파이프 resize 중 relation child edge 탐색과 고정 y 탐색을 시작 시점 1회 계산으로 축소.
- `EditableNode` 커스텀 memo 비교 추가
  - 노드 좌표/크기/props, 선택 여부, attach/pending 관련 상태, 해당 노드 포트의 relation 상태가 바뀐 경우에만 rerender되도록 비교 범위를 좁힘.
  - 부모 렌더마다 바뀌는 전체 `layout`, Set/Map 객체 참조, 이벤트 핸들러 참조로 인해 모든 노드가 같이 다시 그려지는 폭을 줄이는 기반 마련.
- 링크 path 계산을 링크별 memo boundary로 이동
  - `EditorCanvas.tsx`에서 매 렌더마다 `createEditorLinkRenderItems(layout)`로 전체 링크 path를 계산하던 구조를 제거.
  - `EditableLink`가 `link`, `fromNode`, `toNode`를 받아 자기 path를 `useMemo`로 계산하도록 변경해, 움직인 노드와 연결된 링크만 path 계산이 다시 일어나도록 범위를 축소.
- `EditableNode`의 전체 layout 의존 제거
  - 노드 렌더러가 `layout` 전체를 props로 받지 않고, 자기 포트에 연결된 relation counterpart lookup만 받도록 변경.
  - 포트 좌표 보정은 `createRenderedPortRelationLookup`, `getRenderedPortPointFromLookup` 경유로 처리해 노드 memo 비교 경계를 더 명확히 정리.
  - counterpart 노드/포트 값이 실제로 바뀐 경우에만 노드 렌더러가 다시 그려지도록 custom memo 비교에 relation lookup 비교를 추가.
- relation 포트 lookup 생성 비용 축소
  - JSX 렌더 루프에서 `createRenderedPortRelationLookup`을 노드마다 즉석 호출하던 구조를 제거.
  - `renderedPortRelationLookupByNodeId` selector를 `useMemo`로 만들고, `EditableNode`는 미리 계산된 lookup만 참조하도록 변경.
- 노드 렌더 배열 selector 분리
  - SVG 렌더 중 `renderedNodes.filter(...).map(...)`를 반복하던 구조를 `terrainNodes`, `drawableNodes` selector로 분리.
  - 지형 레이어와 일반 노드 레이어가 같은 파생 배열을 재사용하도록 정리해 렌더 루프의 임시 배열 생성을 축소.
- `EditableNodeLayer` 분리
  - `EditorCanvas.tsx`가 `EditableNode` 반복 렌더링 JSX를 직접 들고 있던 구조를 제거.
  - 지형 노드 레이어와 일반 노드 레이어가 같은 `EditableNodeLayer` 컴포넌트를 재사용하도록 변경.
  - 다음 단계의 drag draft layer, selected-only layer 최적화를 넣을 수 있는 렌더 계층 경계를 마련.
- drag draft layout 1차 도입
  - 드래그 pointer move 중 실제 `layout`을 매 프레임 갱신하지 않고 `dragPreviewLayout`으로 화면 preview만 갱신하도록 변경.
  - pointer up/leave에서 preview layout을 실제 `layout`에 한 번만 commit하도록 정리.
  - undo/redo history batch와 localStorage 저장이 드래그 중 매 move에 반응하는 비용을 줄이는 기반 마련.
- drag draft positions 도입
  - preview용 `EditorLayout` 전체를 매 프레임 생성하던 구조를 제거.
  - 드래그 중인 노드들의 `{ x, y }` 좌표만 `dragDraftPositionsByNodeId` Map으로 보관하고 렌더 시점에 노드 lookup에 합성하도록 변경.
  - pointer up/leave에서 draft positions를 실제 layout에 한 번만 반영하도록 정리.
- resize draft nodes 도입
  - resize pointer move 중 실제 `layout`을 매 프레임 갱신하지 않고 변경된 노드 객체만 `resizeDraftNodesById` Map으로 보관하도록 변경.
  - 렌더 시점에는 draft node map을 node lookup에 합성하고, pointer up/leave에서 실제 layout에 한 번만 commit하도록 정리.
  - 파이프 resize의 연결 포트/노드 전파 결과는 유지하면서 history/localStorage 반응 비용을 줄이는 기반 마련.
- draft relation lookup 재계산 범위 축소
  - 기본 relation 포트 lookup은 실제 `layout` 기준으로 한 번 계산하고, drag/resize draft가 있을 때만 영향받은 노드와 relation counterpart 노드 lookup을 덮어쓰도록 변경.
  - 드래그/리사이즈 중 모든 노드의 `createRenderedPortRelationLookup`이 다시 실행되던 구조를 줄여 포트/attach 표시 계산 비용을 낮춤.
- draft node 배열 합성 제거
  - 드래그/리사이즈 중 상위에서 `renderedNodes.map(...)`으로 전체 draft 노드 배열을 매번 만들던 구조를 제거.
  - 지형/일반 노드 레이어는 실제 layout 기준 정렬 배열을 유지하고, 각 `EditableNodeLayer`가 자기 노드를 렌더링할 때 `renderNodesById`에서 draft 좌표/크기만 꺼내도록 변경.
  - 지형 확장 핸들도 draft node를 직접 조회해, 화면 preview와 핸들 위치가 같이 움직이도록 유지.
- 시뮬레이션 runtime badge/overlay memo 강화
  - `ObjectRuntimeBadge`, `RuntimeBadgeItem`, `UpstreamPipeExtension`에 runtime state 비교 기반 `React.memo`를 적용.
  - badge layer가 `snapshot` 전체 대신 `editorObjects`만 받고, badge 대상 노드 필터는 `runtimeBadgeNodes` selector로 분리.
  - 시뮬레이션 tick 중 막힘 대상 조회를 노드별 `find` 반복 대신 `blockageTargetByEditorId` Map selector로 변경.
- 시뮬레이션 layout selector 강화
  - relation guide endpoint 계산에서 `layout.nodes.find(...)` 반복을 제거하고 `nodesById` Map selector로 대체.
  - relation guide 렌더 대상은 `relationLinks` selector로 미리 분리해 relation이 아닌 link를 매번 컴포넌트 내부에서 걸러내는 비용을 줄임.
  - upstream extension의 왼쪽 relation 존재 여부를 노드마다 `layout.links.some(...)`로 확인하던 구조를 `leftEndpointRelationNodeIds` Set selector로 변경.
- 시뮬레이션 SVG 레이어 memo 경계 분리
  - 부모 SVG 안의 `relationLinks.map`, `sortedNodes.map` 반복 JSX를 `RelationGuideLayer`, `UpstreamExtensionLayer`, `SimulationNodeLayer`로 분리.
  - tick 중 부모 컴포넌트가 다시 렌더되어도 relation guide, upstream extension, runtime node layer가 독립적인 memo 비교 경계를 갖도록 정리.
  - 각 레이어는 selector 결과와 `editorObjects` 참조만 받아 하위 객체 단위 memo가 더 안정적으로 작동하도록 구성.
- 시뮬레이션 SVG animation 계산 메모화
  - `PipeFlowArrows`의 화살표 좌표 배열을 `createPipeFlowArrowItems`와 `useMemo`로 분리해 파이프 크기/방향/화살표 수가 바뀔 때만 다시 계산하도록 변경.
  - `RainOverlay`의 빗방울 좌표/길이/시작 시간 배열을 `createRainDropItems`와 `useMemo`로 분리해 bounds/지표면 기준이 바뀔 때만 다시 생성하도록 변경.
  - `WaterFillRect`의 물결 path 문자열과 stroke width 계산을 memoized 값으로 분리해 runtime fill 렌더 비용을 줄이는 기반 마련.
- 시뮬레이션 animation/static component memo 경계 추가
  - `WaterFillRect`, `FloodOverflow`, `RainOverlay`를 `React.memo`로 감싸 동일 props일 때 함수 호출과 SVG children 재생성을 줄임.
  - `TerrainNode`의 지형 wave path 배열과 `RoadNode`의 차선 dash 배열을 `useMemo`로 분리해 노드 크기가 바뀔 때만 다시 만들도록 정리.
- `SimulationWorkbench.tsx`
  - 막힘 제어 패널 JSX 선언 순서를 helper 함수 뒤로 이동해 React Compiler lint를 통과하도록 정리.
- 검증
  - `npm run build` 통과.
  - `npm run lint` 통과.

### 남은 구조 개선 후보

- `EditorCanvas.tsx`가 여전히 렌더링, 편집 이벤트, 패널 상태, 시나리오 상태를 많이 들고 있다.
- 노드/링크 렌더러가 완전히 독립된 공통 `DiagramNode`, `DiagramLink` 컴포넌트로 분리되지 않았다.
- 편집모드와 시뮬레이션모드가 아직 하나의 `DiagramScene`을 공유하지 않는다.
- 선택 highlight 계산과 일부 패널 상태가 더 세밀한 selector로 분리될 수 있다.
- WebSocket snapshot 비교 계층은 개선됐지만, 실제 운영 데이터에서 추가 profiling이 필요하다.

## 목표 구조

```text
src/components/
  diagram/
    DiagramScene.tsx
    DiagramNode.tsx
    DiagramLink.tsx
    DiagramLabel.tsx
    SoilBackground.tsx
    RuntimeOverlay.tsx
    palette.ts
    selectors.ts
    geometry.ts
  editor/
    EditorCanvas.tsx
    EditorToolbar.tsx
    EditorScenarioBar.tsx
    EditorContextMenu.tsx
    EditorSelectionPanel.tsx
    hooks/
      useEditorSelection.ts
      useEditorDrag.ts
      useEditorResize.ts
      useEditorHistory.ts
      useEditorScenarioState.ts
  simulation/
    SimulationWorkbench.tsx
    SimulationControls.tsx
    SimulationInfoPanel.tsx
    hooks/
      useRuntimeSnapshot.ts
      useSimulationControls.ts
      useBlockageControls.ts
```

## 공통 렌더러 설계

### `DiagramScene`

공통 SVG scene의 진입점이다.

예상 props:

```ts
type DiagramSceneMode = "editor" | "runtime";

type DiagramSceneProps = {
  layout: EditorLayout;
  mode: DiagramSceneMode;
  selectedNodeId?: string | null;
  selectedLinkId?: string | null;
  runtimeSnapshot?: RuntimeSnapshot | null;
  editorDraft?: EditorDraft | null;
  onNodePointerDown?: (nodeId: string, event: React.PointerEvent) => void;
  onLinkPointerDown?: (linkId: string, event: React.PointerEvent) => void;
};
```

책임:

- view bounds 계산
- 토지/하늘 배경 렌더링
- link 렌더링
- node 렌더링
- label 렌더링
- editor 모드일 때 선택 표시, 포트, resize handle 렌더링
- runtime 모드일 때 snapshot overlay, flow animation, blockage/rain/flood 표시

### `DiagramNode`

개별 노드 렌더러다.

memo 기준:

- `node.id`
- `node.x`, `node.y`, `node.width`, `node.height`, `node.rotation`
- `selected`
- `mode`
- 해당 노드의 runtime state
- 해당 노드의 draft transform

관련 없는 노드의 상태 변경으로 rerender되지 않아야 한다.

### `DiagramLink`

개별 link/relation 렌더러다.

memo 기준:

- `link.id`
- from/to node 좌표
- pipe kind, selected 여부
- 해당 link runtime state
- blockage state

관련 없는 노드 이동으로 모든 링크 path를 다시 계산하지 않도록 한다.

## 단계별 실행 계획

## 1단계: 무동작 구조화

목표는 동작을 바꾸지 않고 파일 책임만 나누는 것이다.

작업:

- `EditorCanvas.tsx`에서 순수 계산 함수 이동
  - geometry 계산
  - relation path 계산
  - attach 후보 계산
  - selection helper
  - history helper
- 패널 UI 분리
  - 선택 패널
  - 시나리오 바
  - 컨텍스트 메뉴
  - 툴바
- 기존 props/state 이름은 최대한 유지한다.

완료 기준:

- `npm run build` 통과
- 편집모드 기본 동작 유지
- 시뮬레이션 기본 동작 유지

## 2단계: 공통 `DiagramScene` 도입

목표는 편집모드와 시뮬레이션모드가 같은 SVG 렌더러를 쓰게 하는 것이다.

작업:

- `DiagramScene.tsx` 생성
- `DiagramNode.tsx` 생성
- `DiagramLink.tsx` 생성
- `EditorCanvas.tsx`는 `mode="editor"`로 사용
- `SimulationLayoutPreview.tsx`는 `mode="runtime"`로 사용하거나 `DiagramScene`으로 대체
- editor-only affordance는 옵션으로 켠다.
  - 포트
  - resize handle
  - attach guide
  - context menu target
- runtime-only affordance는 옵션으로 켠다.
  - flow pulse
  - blockage highlight
  - selected runtime object
  - snapshot value overlay

완료 기준:

- 편집모드와 시뮬레이션모드의 토지/파이프/시설 기본 색상과 라벨이 일치
- 다크/라이트 모드에서 두 화면의 배경 톤이 일관됨
- `npm run build` 통과

## 3단계: 드래그/리사이즈 최적화

목표는 pointer move 중 `layout` 전체 commit을 줄이는 것이다.

현재 문제:

- 드래그 중 layout state가 계속 변경되면 모든 노드/링크가 다시 계산될 수 있다.
- RAF를 적용해도 전체 layout 변경이 남아 있으면 체감 개선이 제한된다.

작업:

- `dragDraft` 또는 `interactionDraft` 상태 도입
  - pointer move 중에는 draft 좌표만 변경
  - 실제 `layout`은 pointer up에서만 commit
- draft 적용은 렌더러 내부에서 선택된 노드/링크에만 반영
- history 저장은 pointer up에서만 수행
- relation path는 draft에 영향을 받는 link만 다시 계산

완료 기준:

- 드래그 중 history stack이 증가하지 않음
- 드래그 중 관련 없는 노드가 rerender되지 않음
- 체감상 이동/리사이즈 끊김 감소

## 4단계: selector와 memo 비교 강화

목표는 입력 데이터가 커져도 필요한 부분만 다시 그리게 하는 것이다.

작업:

- `useLayoutIndexes`
  - `nodesById`
  - `linksById`
  - `relationsByNodeId`
  - `linksByNodeId`
  - `sortedNodes`
  - `viewBounds`
- runtime selector
  - `runtimeByEditorObjectId`
  - `runtimeBySwmmNodeId`
  - `runtimeBySwmmLinkId`
  - `blockageByLinkId`
- `React.memo` custom comparator 적용
  - `DiagramNode`
  - `DiagramLink`
  - `RuntimeOverlay`
  - `DiagramLabel`

완료 기준:

- 선택 객체 변경 시 선택 전/후 객체 위주로 rerender
- snapshot tick 수신 시 runtime 값이 바뀐 객체 위주로 rerender
- unrelated panel state 변경으로 전체 SVG rerender가 최소화됨

## 5단계: 애니메이션 분리

목표는 CSS/SVG animation을 React state 변화와 분리하는 것이다.

작업:

- 물 흐름, 빗방울, pulse는 가능한 CSS keyframe/SVG animate로 유지
- tick마다 animation용 배열을 새로 만들지 않음
- runtime 수치, 색상, 높이 등 실제 값 변경만 React props로 전달
- selected highlight는 CSS class 기반으로 처리

완료 기준:

- simulation tick 중 animation이 끊기지 않음
- 강수/막힘 조작 중 UI 입력 지연 감소

## 검증 계획

### 자동 검증

- `npm run build`
- `npm run lint`
  - 실패 시 기존 오류와 신규 오류를 구분해서 기록한다.

### 편집모드 수동 검증

- 객체 선택
- 객체 이동
- 다중 선택
- 리사이즈
- 회전
- attach/detach
- undo/redo
- 새 시나리오 생성
- 시나리오 선택
- 수정모드 진입
- 저장
- 초기화
- JSON 내보내기/불러오기
- INP 다운로드
- 다크/라이트 모드 색상 확인

### 시뮬레이션 수동 검증

- 엔진 시작
- 엔진 일시정지
- 엔진 정지
- WebSocket tick 수신
- 강수 슬라이더 조작
- 막힘 슬라이더 pointer up commit
- 전체화면 진입/종료
- 전체화면 drawer 열기/닫기
- 선택 객체 highlight
- 다크/라이트 모드 색상 확인

### 성능 검증

Chrome Performance에서 같은 레이아웃으로 비교한다.

- 편집모드 drag 5초
- 편집모드 resize 5초
- 시뮬레이션 tick 30초
- 강수 슬라이더 조작 10초
- 막힘 슬라이더 조작 10초

확인 항목:

- FPS
- scripting time
- rendering time
- React commit 횟수
- pointer input delay
- WebSocket tick 중 UI 응답성

## 우선순위

1. `EditorCanvas.tsx` 내부 UI 패널과 순수 계산 함수 분리
2. `DiagramScene`, `DiagramNode`, `DiagramLink` 도입
3. 드래그/리사이즈 draft commit 구조 도입
4. runtime snapshot selector 강화
5. CSS/SVG animation 분리
6. Performance profile로 병목 재측정

## 리스크

- 한 번에 `EditorCanvas.tsx`를 크게 쪼개면 attach, undo/redo, scenario 저장 동작이 깨질 수 있다.
- 공통 렌더러 도입 시 편집모드와 시뮬레이션모드의 좌표계/배경 높이 계산이 달라질 수 있다.
- drag draft 구조를 넣을 때 pointer up commit 누락이 생기면 실제 저장 layout과 화면 draft가 어긋날 수 있다.
- runtime snapshot memo 비교가 너무 얕으면 변화가 반영되지 않고, 너무 깊으면 비교 비용이 커진다.

## 작업 원칙

- 큰 파일은 작은 단계로 나누어 수정한다.
- 각 단계마다 `npm run build`를 실행한다.
- lint 실패는 기존 오류와 신규 오류를 구분한다.
- 기능 추가보다 기존 동작 보존을 우선한다.
- SWMM 계산 결과의 source of truth는 계속 서버/엔진이다.
- React는 강수/막힘 입력과 렌더링 상태만 담당한다.
- `stepSeconds: 1` 실시간 계약은 변경하지 않는다.

## 다음 작업

바로 다음 작업은 추가 구조 변경이 아니라 안정화 검증이다.

1. `docs/react-rendering-verification-checklist.md` 기준으로 편집모드와 시뮬레이션모드 수동 검증을 진행한다.
2. 검증 중 발견되는 UI/동작 회귀만 작은 패치로 수정한다.
3. 회귀가 없으면 현재 성능 개선 구조를 기준점으로 잡는다.
4. 이후 `DiagramScene` 도입은 별도 단계로 다시 계획하고, 한 번에 합치지 않는다.

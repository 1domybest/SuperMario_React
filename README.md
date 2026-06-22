# SuperMario SWMM React Workbench

도시 배수도 편집과 SWMM 기반 실시간 시뮬레이션을 하나의 화면에서 다루기 위한 React 작업장입니다.

이 레포는 **프론트엔드 클라이언트**입니다. 사용자는 React 화면에서 배수도 JSON을 편집하고, 시나리오로 저장한 뒤, Django/SWMM 서버에 실행 요청을 보내 1초 tick 단위의 runtime snapshot을 시각화합니다.

## 핵심 기능

- 배수 객체 편집
  - 지형, 도로, 관로, 커넥터, 맨홀, 빗물받이, 펌프장, 우수토실, 물재생센터, 방류구 배치
  - 포트 클릭 기반 relation 연결
  - 객체 이동, 리사이즈, 회전, undo/redo

- 시나리오 관리
  - 편집한 배수도 JSON을 제목, 설명과 함께 서버 DB에 저장
  - 저장된 시나리오 목록 조회
  - 시나리오 선택, 수정, 저장, 초기화

- SWMM 연동
  - 현재 배수도 JSON을 SWMM 실행 payload로 전달
  - `stepSeconds: 1` 기준 실시간 엔진 실행
  - 강수량, 배속, 객체별 막힘 제어
  - WebSocket snapshot 수신

- 시각화
  - 편집모드와 시뮬레이션모드 전환
  - 다크/라이트 테마
  - 전체화면 시뮬레이션
  - 선택 객체 highlight
  - 수위, 만관율, 막힘, 침수 경고 표시

## 현재 시스템 흐름

```text
React 편집모드
  -> 배수 객체/관로/연결 관계 편집
  -> 시나리오 저장 API 호출
  -> Django DB에 Scenario 저장

React 시뮬레이션모드
  -> 저장된 시나리오 선택
  -> /engine/start 로 layout + control 전달
  -> Django가 SWMM 엔진 세션 시작
  -> WebSocket /ws/simulation 으로 tick snapshot 수신
  -> React가 runtime 값을 배수도 위에 렌더링
```

React는 유량, 유속, 수위, 만관율을 직접 계산하지 않습니다. 수리 계산의 source of truth는 서버의 SWMM 엔진이며, React는 서버 snapshot을 화면 객체에 매핑해 보여줍니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| UI | React 19, TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| API 통신 | Fetch API |
| 실시간 통신 | WebSocket |

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. React 개발 서버 실행

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

브라우저에서 접속:

```text
http://127.0.0.1:5173/
```

### 3. 정적 빌드

```bash
npm run build
```

### 4. Lint

```bash
npm run lint
```

## 화면 예시

### 시뮬레이션 예시

![시뮬레이션 예시 화면](docs/images/simulation-example.png)

### 편집모드 예시

![편집모드 예시 화면](docs/images/editor-example.png)

### 시뮬레이션 전체화면

![시뮬레이션 전체화면](docs/images/simulation-fullscreen.png)

### 화이트/다크 모드

![화이트/다크 모드 화면](docs/images/light-dark-mode.png)

## 주요 화면

### 편집 모드

배수도 JSON의 원본을 만드는 화면입니다.

- 객체 추가: 캔버스 우클릭 메뉴
- 연결 생성: 포트 두 개 클릭
- 위치 편집: 드래그
- 크기 편집: 파이프/지형/도로 resize handle
- 시나리오 저장: 제목, 설명, 전체 layout JSON 저장
- 내보내기: JSON, INP 다운로드

### 시뮬레이션 모드

저장된 시나리오를 SWMM 엔진으로 실행하고 결과를 보는 화면입니다.

- 엔진 시작, 일시정지, 정지
- 강수량 슬라이더
- 객체별 막힘 제어
- runtime tick 표시
- WebSocket 연결 상태 표시
- 선택 객체 상세 정보
- 전체화면 모드

## 백엔드 연결

이 레포에는 백엔드 코드가 포함되어 있지 않습니다. 시나리오 저장, SWMM 엔진 실행, WebSocket tick 수신은 별도 Django/SWMM 서버가 필요합니다.

기본 서버 주소는 `http://127.0.0.1:8000`이며, 환경 변수로 변경할 수 있습니다.


```bash
VITE_SWMM_ENGINE_URL=http://127.0.0.1:8000
```

백엔드 API 상세 설명은 Django 프로젝트 README에서 관리합니다.

## 프로젝트 구조

```text
SuperMario_React/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/          # 편집/시뮬레이션 모드 전환 workbench
│   │   ├── editor/          # 배수도 편집기
│   │   ├── simulation/      # 실시간 SWMM 시뮬레이션 화면
│   │   ├── diagram/         # 공통 SVG 배경/렌더링 helper
│   │   └── theme/           # 다크/라이트 테마 token
│   ├── data/
│   │   └── defaultDrainageLayout.json
│   ├── domain/
│   │   └── drainage/
│   └── services/
│       └── swmm/            # 서버 DTO, API client, runtime mapping helper
├── docs/
│   ├── react-rendering-refactor-plan.md
│   └── react-rendering-verification-checklist.md
├── public/
├── package.json
└── vite.config.ts
```

## 개발 기준

- `EditorLayout` JSON이 React 편집 화면의 source data입니다.
- 서버/SWMM snapshot이 시뮬레이션 수리 결과의 source of truth입니다.
- React에서 SWMM 결과처럼 보이는 유량, 유속, 수위 값을 임의 계산하지 않습니다.
- `stepSeconds: 1` 실시간 계약을 기본값으로 유지합니다.
- 막힘 UI는 사용자 조작값이고, 실제 반영 상태는 서버 snapshot의 runtime state로 확인합니다.
- 편집 객체의 `id`, `swmmId`, 서버 mapping의 SWMM node/link ID를 임의로 분리해서 바꾸지 않습니다.

## 성능 최적화 현황

최근 렌더링 구조화와 성능 개선 작업이 진행되었습니다.

- 편집모드 노드/링크 렌더러 분리
- 드래그/리사이즈 중 전체 layout 즉시 commit 대신 draft preview 사용
- pointer up 시점에 최종 layout commit
- relation 포트 lookup 재계산 범위 축소
- 시뮬레이션 runtime badge, relation guide, node layer memo 경계 분리
- 물 흐름, 빗방울, 수위 animation 계산 memoization

자세한 내용:

- [docs/react-rendering-refactor-plan.md](/Users/onseoktae/Documents/SuperMario/SuperMario_React/docs/react-rendering-refactor-plan.md)
- [docs/react-rendering-verification-checklist.md](/Users/onseoktae/Documents/SuperMario/SuperMario_React/docs/react-rendering-verification-checklist.md)

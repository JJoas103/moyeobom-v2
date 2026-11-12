# 모여봄

**공연 · 연극 · 영화 · 전시 · 축제 · 클래식/국악을 보고, 끝나고 같이 이야기할 사람을 잇는 서비스.**

혼자 본 공연의 여운을 나눌 사람이 없을 때, 같은 행사를 본 사람들과 '이야기 자리'를 만들어 만납니다.
원하면 관람부터 함께할 수도 있습니다.

> 대학 팀 프로젝트 · 데스크톱 웹 전용

## 이렇게 씁니다

```
행사 고르기 → 모임 열기 / 참여 신청 → 호스트 승인 → 모임 채팅 → 이야기 자리 → 서로 평가 → 친구
```

1. **행사를 고른다** — 서울시 문화행사를 매일 받아 와서 보여 줍니다. 취향 · 관심 지역으로 추천하고, 지도와 달력으로도 찾을 수 있습니다.
2. **모임을 열거나 신청한다** — 호스트는 행사, 소개 · 조건, 날짜, 장소 · 타임라인을 단계별로 정합니다. 참여자는 '관람부터 함께' 또는 '이야기 자리만'을 골라 신청합니다.
3. **호스트가 승인한다** — 승인된 사람만 정확한 장소를 보고 모임 채팅방에 들어갑니다.
4. **만나고, 평가한다** — 다음 날 12:00에 평가가 열립니다. 서로 '또 만나고 싶어요'를 고르면 바로 친구가 되고 1:1 채팅방이 생깁니다.

## 주요 기능

| 영역 | 내용 |
|---|---|
| 행사 | 목록 · 상세 · 필터 · 검색, 취향 기반 추천, 지도(카카오맵) · 달력 보기, 행사장 근처 지하철역 · 공중화장실 |
| 모임 | 만들기(4단계) · 수정 · 모집 마감 · 취소, 참여 신청 · 승인 · 거절 · 내보내기, 타임라인 |
| 평가 · 친구 | 매너 평가(좋았어요 / 보통이에요 / 아쉬웠어요), 서로 고르면 친구 성립, 친구 메모 · 끊기 · 차단 |
| 채팅 | 모임 방 · 친구 1:1 실시간 채팅, 공지 고정, 메시지 · 참여자 신고 |
| 매너 점수 | 0~100점, 변동 이력과 규칙 전문을 그대로 공개 |
| 알림 | 신청 · 승인 · 취소 · 평가 열림/마감 임박 · 친구 성립 · 점수 깎임 |
| 마이 | 프로필 · 취향 · 관심 지역, 찜 목록, 받은 제재 · 이의제기, 탈퇴 |
| 관리자 | 신고 처리(제재 · 기각 · 제재 취소), 이의제기 판정, 회원 열람 |

### 매너 점수

"왜 내 점수가 깎였지?"를 남기지 않는 것이 목표입니다. 점수는 50점에서 시작하고, 모든 변동이 이력으로 남아 **이력을 다 더하면 지금 점수가 됩니다.**

| 오를 때 | | 깎일 때 | |
|---|---|---|---|
| 모임을 열었다 ※ | 5점 | 매너가 아쉬웠다는 평가 (1건마다) | 1점 |
| 평가를 보냈다 | 1점 | 평가를 안 보냈다 | 1점 |
| 매너가 좋았다는 평가 (1건마다) | 1점 | 만나기 하루 전에 확정된 참여를 취소했다 | 1점 |
| 친구가 됐다 | 1점 | 참여자를 받은 모임을 취소했다 | 5점 |
| | | 신고로 제재를 받았다 (관리자 확인 뒤) | 7점 |

※ 승인된 참여자가 1명 이상이고, 호스트가 평가를 보냈고, 함께한 사람 절반 이상이 아쉬워하지 않았을 때만.

참석 여부처럼 서비스가 확인할 수 없는 일에는 점수를 주지 않고, 함께한 사람들의 평가로만 움직입니다. 신고는 접수만으로 깎이지 않습니다.

## 기술 스택

| | |
|---|---|
| 프론트엔드 | React 19 · Vite 6 · React Router 7 · Socket.IO Client · FullCalendar · 카카오맵 JS SDK |
| 백엔드 | Node.js · Express 4 · Mongoose 8 · Passport(로컬 · 구글 · 네이버) · express-session + connect-mongo · Socket.IO · node-cron · multer |
| DB | MongoDB Atlas |
| 데이터 | 서울 열린데이터광장 — 문화행사 정보 · 공중화장실 위치 · 지하철역 정보 |

## 구조

```
moyeobom-v2/
├── app.js            Express 서버 (:3000) — JSON API, 배포 시 프론트 빌드도 함께 서빙
├── routes/api/       엔드포인트           → controllers/ → services/ → models/
├── schedulers/       매일 행사 동기화 · 평가 마감 처리 · 오래된 채팅 정리 (node-cron)
├── config/           DB · 인증 · 소켓 · 업로드 설정
├── scripts/          동기화 · 점검 · 테스트 데이터 스크립트
└── frontend/         React SPA (:5173)
    └── src/
        ├── pages/        화면
        ├── components/   공통 · 화면별 컴포넌트
        ├── data/         API 호출 (화면은 여기 함수만 부른다)
        └── utils/        상태 배지 · 날짜 · 매너 점수 등 계산
```

API 응답은 성공이면 `{ success: true, ...data }`, 실패면 `{ success: false, message, fieldErrors? }` 입니다.

## 시작하기

Node.js 20 이상, MongoDB Atlas 클러스터가 필요합니다.

### 1. 설치

```bash
npm install
cd frontend && npm install
```

### 2. 환경 변수

루트 `.env` (`.env_sample` 참고)

| 키 | 설명 |
|---|---|
| `MONGODB_URI` | Atlas 연결 문자열 (필수) |
| `MONGODB_DB` | DB 이름 (기본 `moyeobom`) |
| `SESSION_SECRET` | 세션 서명 키 (배포 시 필수) |
| `FRONTEND_URL` | 화면 주소 — CORS · 소셜 로그인 뒤 돌아갈 곳 (기본 `http://localhost:5173`) |
| `SEOUL_OPEN_API` | 서울 열린데이터광장 인증키 — 행사 · 화장실 · 역 동기화 |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | 구글 로그인 (없으면 그 로그인만 꺼짐) |
| `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | 네이버 로그인 (없으면 그 로그인만 꺼짐) |

`frontend/.env` (`frontend/.env_example` 참고)

| 키 | 설명 |
|---|---|
| `VITE_API_BASE_URL` | 개발 시 API 주소 (기본 `http://localhost:3000`) |
| `VITE_KAKAO_MAP_API` | 카카오맵 JS 키 — 지도 · 장소 검색. 카카오 개발자센터에 사이트 도메인 등록 필요 |

소셜 로그인 콜백은 백엔드 주소입니다 — `http://localhost:3000/api/auth/google/callback`, `.../naver/callback`.

### 3. 데이터 채우기

처음 한 번 동기화해야 행사가 보입니다. 이후에는 서버가 켜져 있으면 자동으로 돌아갑니다.

```bash
npm run sync:events   # 서울시 문화행사 (자동: 매일 04:00)
npm run sync:places   # 공중화장실 · 지하철역 (자동: 매달 1일 04:30)
```

### 4. 실행

개발 — 터미널 두 개

```bash
npm run dev                  # 백엔드  http://localhost:3000
cd frontend && npm run dev   # 프론트  http://localhost:5173  ← 브라우저는 여기로
```

배포 — 한 주소로

```bash
cd frontend && npm run build   # frontend/dist 생성
cd .. && npm start             # http://localhost:3000 에서 화면 · API · 소켓 모두
```

빌드가 있으면 Express가 화면까지 함께 내보내므로 주소가 하나가 됩니다. 이때 `FRONTEND_URL` 을 실제 접속 주소로 바꿔 주세요.

## 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm run dev` / `npm start` | 백엔드 실행 (nodemon / node) |
| `npm run sync:events` · `sync:places` | 공공데이터 수동 동기화 |
| `npm run review:daily` | 평가 열림 · 마감 알림과 점수 반영을 수동 실행 (자동: 매일 12:00) |
| `npm run manner:check` | 모든 회원의 점수가 이력 합과 맞는지 검사 |
| `npm run admin:grant -- <이메일> [--revoke]` | 관리자 지정 · 해제 (화면에서는 바꿀 수 없음) |
| `npm run db:sync-indexes` | 스키마에 없는 옛 인덱스 정리 |
| `npm run seed:test` · `-- --clean` | 테스트용 더미 데이터 넣기 · 지우기 |
| `cd frontend && npm run lint` | 프론트 lint |

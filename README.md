# 모여봄 v2

행사(공연·연극·영화·전시·축제·클래식/국악)를 보고, 끝나고 같이 이야기할 모임을 잇는 서비스.

```
moyeobom-v2/
├── (루트)      Express + MongoDB Atlas  →  JSON API 서버   :3000
└── frontend/   React + Vite             →  화면 전부 (SPA)  :5173
```

## 처음 실행

### 1. 패키지 설치

```bash
# 루트 (백엔드)
npm install

# 프론트엔드
cd frontend
npm install
```

### 2. 환경변수

- 루트 `.env` 의 `MONGODB_URI` 에 Atlas 연결 문자열을 넣는다.
  - Atlas → Database → **Connect** → **Drivers** → 문자열 복사 → `<password>` 를 실제 비밀번호로 바꾼다.
  - Atlas → **Network Access** 에 내 IP(또는 개발 중엔 `0.0.0.0/0`)가 등록돼 있어야 연결된다.
  - DB 이름은 `MONGODB_DB`(기본 `moyeobom`)로 정해진다.
- `frontend/.env` 는 기본값 그대로 써도 된다. 카카오 지도 화면을 만들 때 `VITE_KAKAO_MAP_API` 를 채운다.

### 3. 실행 — 터미널 두 개

```bash
# 터미널 1 — 백엔드
npm run dev            # http://localhost:3000/api/health

# 터미널 2 — 프론트엔드
cd frontend
npm run dev            # http://localhost:5173  ← 브라우저는 여기로
```

홈 화면의 "백엔드 연결" 줄에 `✓ 서버 ok · DB connected` 가 보이면 Atlas까지 연결된 것이다.

## 지금 상태 (1단계: 뼈대)

| 구분 | 내용 |
|------|------|
| 백엔드 | Express, Atlas 연결, `/api/health`, JSON 에러 응답, Event·Meetup 스키마, multer 설정, Socket.IO 연결만 |
| 프론트 | 라우팅, v2 헤더·푸터·디자인 토큰, `api.js` fetch 래퍼, 목업 스위치(`data/config.js`) |
| 화면 | 7개 라우트 자리만 — 목업 데이터가 불러와지는지 목록으로 확인 |
| 인증 | 아직 없음 (passport·session·bcrypt 는 인증 단계에서 설치) |

### 라우트

| 주소 | 시안 v2 |
|------|---------|
| `/` | 홈 |
| `/event` | 행사 목록 |
| `/event/:id` | 행사 상세 |
| `/meetup` | 모임 목록 |
| `/meetup/:id` | 모임 상세 |
| `/meetup/new` | 모임 만들기 ① 행사 고르기 |
| `/meetup/new/:eventId` | 모임 만들기 ② 모임 정보 |

## 규칙

- **목업 = 스키마.** `frontend/src/data/mock/*` 의 필드 이름은 `models/*.js` 와 똑같이 둔다.
  화면은 `data/events.js`, `data/meetups.js` 의 함수만 부르고, API가 붙으면 `USE_MOCK = false` 한 줄만 바꾼다.
- **목업 날짜는 오늘 기준 상대값**(`at(2, '22:10')`)이라 날짜가 지나도 '진행 중'으로 보인다.
- 상태 배지(진행 중 · D-n · n자리 남음 · 마감)는 DB에 저장하지 않고 `utils/status.js` 에서 계산한다.
- 카테고리·예산은 DB에 영문 키(`performance`, `1to2`)로 저장하고 라벨은 `data/constants.js` 에서 붙인다.
- 응답 형태: 성공 `{ success: true, ...data }`, 실패 `{ success: false, message }`.

## 미결정 (와이어프레임 메모에서)

- 최근 끝난 행사로 모임 개설 가능 기간 — 지금은 임시 14일 (`data/events.js` `RECENT_ENDED_DAYS`)
- 승인 기한 · 신청 마감 시점
- 비용 필터 기준, 모임 목록 필터(참여 방식 · 술 · 예산) 확정 여부

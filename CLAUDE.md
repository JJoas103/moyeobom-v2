# 모여봄 v2 — Claude Code 작업 안내

행사(공연·연극·영화·전시·축제·클래식/국악)를 보고, 끝나고 같이 이야기할 **모임**을 잇는 서비스.
대학 팀 프로젝트. 이번 범위는 **데스크톱 웹만**(반응형·앱 없음).

## 구조

```
(루트)      Express + MongoDB Atlas (CommonJS, require)   :3000  JSON API만
frontend/   React 19 + Vite 6 + react-router 7 (ESM)      :5173  화면 전부
```

- 백엔드: `routes/api/*` → `controllers/` → `services/` 순서. 응답은 성공 `{ success: true, ...data }`, 실패 `{ success: false, message, fieldErrors? }`.
- 프론트: 화면은 `src/data/events.js`, `src/data/meetups.js` 의 함수만 부른다. `src/data/config.js` 의 `USE_MOCK_EVENTS` · `USE_MOCK_MEETUPS` 로 도메인별 목업/실제 API 전환.
- 세부 세팅 규칙은 `STACK_SETUP.md` 참고 (EJS 쓰지 않음, 프록시 없음, `credentials: 'include'`).

## 실행

```bash
npm run dev                 # 루트 — 백엔드 (nodemon)
cd frontend && npm run dev  # 프론트 — 브라우저는 5173
cd frontend && npm run lint # 커밋 전 lint 통과 확인
npm run sync:events         # 서울시 문화행사 수동 동기화 (자동: 매일 04:00)
npm run sync:places         # 공중화장실 · 지하철역 수동 동기화 (자동: 매달 1일 04:30)
```

`.env`(루트)·`frontend/.env` 는 커밋하지 않는다. 키 이름은 `.env_sample`, `frontend/.env_example` 참고.

## 지켜야 할 규칙

- **목업 = 스키마.** `frontend/src/data/mock/*` 필드 이름은 `models/*.js` 와 똑같이. API 응답 모양은 `data/events.js`, `data/meetups.js` 맨 위 주석에 적힌 그대로 맞춘다 (USE_MOCK 한 줄로 전환되도록).
- 카테고리·예산은 DB에 영문 키(`performance`, `play`, `film`, `exhibition`, `festival`, `classic` / `under1`, `1to2`, `2to3`, `over3`)로 저장, 라벨은 프론트 `data/constants.js`.
- 상태 배지(진행 중 · D-n · n자리 남음 · 마감)는 저장하지 않고 계산 (`frontend/src/utils/status.js`).
- 모임 응답에서 `members` 배열과 `talk.place`(정확한 장소)는 내려주지 않는다 — 승인된 참여자 전용.
- 디자인 토큰은 `frontend/src/index.css` `:root`. 누를 곳은 그린(`--primary`) 하나. 이모지 아이콘 쓰지 않음(`components/common/Icons.jsx`).
- 한국어 UI 문구는 짧은 해요체.

## 화면 진행 상황 (시안 v2 기준)

| 화면 | 경로 | 상태 |
|------|------|------|
| 행사 목록 | `/event` | 완료 (목업) |
| 행사 상세 | `/event/:id` | 완료 (목업) |
| 모임 목록 | `/meetup` | 완료 (목업) |
| 모임 상세 | `/meetup/:id` | 완료 (목업) — B안 타임라인 + A안 상단 |
| 모임 만들기 ① | `/meetup/new` | 완료 (목업) |
| 모임 만들기 ② | `/meetup/new/:eventId` | 완료 (목업) |
| 모임 평가 ①② · 완료 · 마감 | `/meetup/:id/review` | 완료 (실제 API) — 시안 `html/moyeobom-chat-friends/review-*` |
| 친구 · 요청 | `/friends` · `/friends/requests` | 완료 (실제 API) — 메모 팝업 · 일괄 확인 팝업 포함 |
| 채팅 (모임 · 친구 1:1) | `/chat` · `/chat/:roomId` · `/chat/meetup/:meetupId` | 완료 (실제 API + socket.io) |
| 홈 | `/` | **미구현** — 추천 홈 / 지도로 보기 / 달력으로 보기 탭. 나중에 |

- 행사 · 모임 모두 실제 API 연결됨 (`USE_MOCK_EVENTS = false`, `USE_MOCK_MEETUPS = false`). 표의 '(목업)'은 화면을 처음 만든 시점 기준.
- 인증(passport·session, connect-mongo) 붙음 — `/member/login` · `/member/join` · `/member/social-join`. 찜·추천 이유는 아직.
- 모임: 만들기(로그인 · 만든 사람이 호스트) · 사진 업로드(`public/images/upload`) · 참여 신청(pending 저장) · 호스트 승인 · 수정(`/meetup/:id/edit`, 행사 빼고 전부, 정원은 승인 인원 이상) · 모집 마감/다시 열기 · 취소(되돌리기 없음, 목록 · 행사 모임 수에서 제외). 종료 시각은 없음. 신청자는 `Meetup.members` 배열에 임베드, 정원(`capacity`)은 **호스트 제외**. `talk.place` · `members` 는 호스트와 승인된 참여자에게만 내려준다.

## 평가 · 친구 · 채팅 (결정 로그 2026-10)

시안: `html/moyeobom-chat-friends/` (index.html 에 화면 목록 · 확정 규칙). 기한 계산은 전부 `services/socialRules.js` 한 곳.

- **평가**: 이야기 자리 날짜 다음날 12:00 열림 → 48시간 뒤 마감. 대상 = 확정 참여자(호스트 포함, 나 제외). 한 번만 제출. 칭찬은 `Review.praised` 저장만(매너 점수 미결정), '또 만나고 싶어요'는 비공개.
- **친구 요청**: 서로 고르면 `FriendLink` 생성 → **평가 마감 시각**에 '요청 가능'으로 보이고 그로부터 7일에 만료('요청 가능' · '보낸 요청' 같은 때). 거절 없음 · 만료 뒤 재요청 불가. 요청 = 수락(같은 API) — 둘 다 요청하면 바로 친구 + 1:1 방.
- **채팅**: 모임 방은 모임 만들 때 생기고(호스트), 승인하면 들어감. 평가 마감에 읽기 전용(취소하면 즉시) → 30일 동안 목록에 흐리게 · 신고 가능 → 닫힌 뒤 90일에 삭제(처리 중 신고가 있으면 보류). 1:1 방은 친구 끊기 · 차단하면 바로 목록에서 사라지고 90일 뒤 삭제.
- **cron**: `schedulers/socialCleanup.js` 매일 12:00(서울) — 요청 만료 · 90일 지난 방 삭제. 조회도 지금 시각과 비교하므로 cron 이 늦어도 화면은 맞음.
- **socket.io**: `config/socket.js` — 세션으로 로그인 확인, 각자 `user:<id>` 방에만 들어감. 서버가 받는 사람 user 방으로 `chat:message` · `chat:read` · `chat:notices` · `chat:rooms` · `friends:changed` 를 보냄. 프론트는 `context/SocketContext.jsx` `useSocketEvent`.
- **차단**: 친구 끊김 + 요청 자리 숨김 + 내 모임 채팅에서 상대 메시지 숨김. **신고**: `Report` 저장만 — 처리(관리자) 화면 없음, DB에서 `status: 'done'` 으로 바꾸면 처리 끝.
- 새 도메인(평가 · 친구 · 채팅)은 목업 없이 실제 API 전용 (`data/reviews.js` · `data/friends.js` · `data/chat.js` 맨 위 주석이 응답 모양).

## 행사장 근처 정보 (서울 열린데이터광장)

- 공중화장실 `mgisToiletPoi` → `Toilet`, 지하철역 `subwayStationMaster` → `Station` (GeoJSON + 2dsphere). 키는 `SEOUL_OPEN_API` 하나로 됨.
- `GET /api/nearby?lat=&lng=` — 역 3곳(1.5km) · 화장실 3곳(800m, **공공개방만** — 민간개방은 중복·시간 불일치가 많아 제외, 이름 같고 50m 안이면 하나로), 직선거리. 모임 상세 '행사장 근처'에서 **행사장 좌표** 기준으로 부른다 (이야기 자리 정확한 장소는 승인 전 비공개라 쓰지 않음).
- 실시간 도시데이터(`citydata`) 혼잡도는 쓰지 않기로 함. 날씨도 아직 안 씀.
- 화장실 `VALUE_03`(휴무일?) · `VALUE_05`(장애인 화장실?)는 뜻이 확인되지 않아 저장 안 함.

## 설정 할 일 (콘솔 — 코드 밖)

- [ ] **OAuth 리디렉션 URI 등록** — 콜백은 백엔드(:3000) 주소다. 프론트(5173) 아님.
  - 구글 클라우드 콘솔 › 사용자 인증 정보 › 승인된 리디렉션 URI: `http://localhost:3000/api/auth/google/callback`
  - 네이버 개발자센터 › 애플리케이션 › Callback URL: `http://localhost:3000/api/auth/naver/callback` (서비스 URL: `http://localhost:5173`)
- [ ] **카카오 지도 JS 키 도메인 등록** — 지금 등록된 도메인이 이 프로젝트 주소와 달라 지도가 안 뜬다.
  - 카카오 개발자센터 › 내 애플리케이션 › 플랫폼 › Web › 사이트 도메인에 `http://localhost:5173` 추가 (지도는 브라우저에서 부르므로 프론트 주소)
  - 키는 `frontend/.env` 의 `VITE_KAKAO_MAP_API`

## 완료: 행사 데이터 — 서울시 문화행사 정보 API (1~5 끝남)

`npm run sync:events` 수동 동기화, 매일 04:00(서울) 자동. 교육/체험 · 기타 분류는 제외, 종료일이 지난 행사는 새로 가져오지 않음.

결정 사항
- 외부 API는 **사용자 요청 때 부르지 않는다.** 스케줄러(node-cron)로 주기적으로 가져와 **DB(Event 컬렉션)에 저장**하고, 우리 API는 DB에서 조회한다.
  - 이유: 모임이 행사 `_id` 를 참조, 끝난 행사도 남아야 함, 우리 필터·검색·모임 수는 DB에서만 가능, 호출 한도.
- 출처는 우선 **서울시 문화행사 정보(서울 열린데이터광장)만**. KOPIS·KOBIS는 나중에.
- 저장: Event 스키마 필드 + 출처 ID/링크 + 마지막 동기화 시각. 저장 안 함: 응답 원문 전체, 이미지 파일(주소만).

순서
1. `scripts/checkSeoulCulture.js` — 키로 한 번 호출해 받은 개수 · 샘플 1건 · 실제 필드 이름 출력. **필드 이름은 추측하지 말고 실제 응답으로 확인한 뒤** 변환 코드를 짠다.
2. `services/sources/seoulCulture.js` — 응답 → Event 모양으로 변환. 분류 문자열 → `category` 키 매핑표, 날짜·좌표 파싱(좌표 필드가 뒤바뀌어 있는지 확인).
3. `services/eventSyncService.js` — `source.name + source.id` 기준 upsert(중복 없음). 실행마다 추가·수정·실패 건수를 `SyncLog` 컬렉션에 기록.
4. `schedulers/eventSync.js` — node-cron 매일 새벽(Asia/Seoul). 수동 실행 `npm run sync:events`. 동시 실행 방지.
5. `GET /api/event/list` · `/api/event/recent-ended` · `/api/event/:id` — 프론트 `data/events.js` 의 파라미터(category, genre, district, period, q, hasMeetup, includeEnded, sort)와 응답(meetupCount, openMeetupCount 포함)에 맞춘다. 끝나면 프론트 행사 쪽만 실제 API로 전환.

필요한 키: `.env` 의 `SEOUL_OPEN_API` (서울 열린데이터광장 인증키).

## 미결정 (임의로 정하지 말고 물어볼 것)

- 최근 끝난 행사로 모임을 열 수 있는 기간 — 지금 임시 14일 (`frontend/src/data/events.js` `RECENT_ENDED_DAYS`)
- 승인 기한 · 신청 마감 시점, 신청 거절 기능 여부
- 비용 필터 기준, 모임 목록 필터(참여 방식 · 술 · 예산) 확정 여부
- 홈 첫 화면 구성
- 채팅 공지 최대 개수 — 지금 임시 3개 (`services/chatService.js` `NOTICE_MAX`)
- 친구 메모 글자 수 — 지금 임시 30자 (시안 제안값, `models/Friendship.js` `MEMO_MAX` · `frontend/src/data/friends.js`)
- 만료된 '보낸 요청'을 목록에 남겨 두는 기간 — 지금 임시 7일 (`services/socialRules.js` `SENT_EXPIRED_SHOW_DAYS`)
- 매너 점수 산정 방식 · 노출 위치, 노쇼 판정 주체
- 모임 채팅 '채팅방 나가기' 의미 (모임 참여 취소인지, 목록에서만 숨김인지) — 시안엔 있지만 버튼 뺐음
- 신고 처리 주체 · 화면, 알림 대상 이벤트 · 전달 수단

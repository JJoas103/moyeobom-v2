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
npm run review:daily        # 개설 가점 · 평가 열림/마감 알림 · 평가 마감 반영 (자동: 매일 12:00)
npm run manner:check        # 매너 점수 불변식 검사 — 점수 = 50 + 이력 합
npm run db:sync-indexes     # v1 이 남긴 인덱스 떼내기 (아래 '같은 DB' 절 참고)
npm run migrate:report-index # 한 번만 — 신고 고유 인덱스 지우기 (신고 1:n)
```

`.env`(루트)·`frontend/.env` 는 커밋하지 않는다. 키 이름은 `.env_sample`, `frontend/.env_example` 참고.

`MongoDB 연결 실패: querySrv ENODATA` 가 나오면 코드보다 네트워크의 DNS 를 먼저 본다. 일부 공용 Wi-Fi 의 DNS 는 `mongodb+srv` 에 필요한 SRV · TXT 조회를 처리하지 못한다.

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
| 모임 상세 | `/meetup/:id` | 완료 (목업) — B안 타임라인 + A안 상단. 호스트는 참여자 관리 팝업(신청 · 확정 탭) |
| 모임 만들기 ① | `/meetup/new` | 완료 (목업) |
| 모임 만들기 ② | `/meetup/new/:eventId` | 완료 (목업) |
| 모임 평가 ①② · 완료 · 마감 | `/meetup/:id/review` | 완료 (실제 API) — 시안 `html/moyeobom-chat-friends/review-*` |
| 친구 | `/friends` | 완료 (실제 API) — 메모 팝업 포함. 요청 탭 없음(서로 고르면 바로 친구) |
| 채팅 (모임 · 친구 1:1) | `/chat` · `/chat/:roomId` · `/chat/meetup/:meetupId` | 완료 (실제 API + socket.io) |
| 내 모임 | `/my/meetups?tab=hosted\|joined` | 완료 (실제 API `GET /api/meetup/mine`) — 내가 연 / 참여한(신청 중 포함) 탭, 다가오는 · 지난 모임 카드. 머리줄에 매너 점수 배지 |
| 마이 | `/my?tab=praise\|likes\|settings\|blocks` | 완료 (실제 API `GET/PATCH /api/member/me` · `PATCH /api/member/me/password` · `GET/DELETE /api/friends/blocks`) — 프로필 카드 + 상단 탭. 시안 `html/moyeobom-my/my.html`. 찜은 기능 없어 안내만. 탈퇴 `POST /api/member/withdraw` — 다가오는 연 모임 · 참여(신청 중 포함) 모임 있으면 막음, 비밀번호(소셜은 '탈퇴' 입력) 확인, 친구 · 차단 · 회원 삭제(지난 모임 · 평가 · 메시지는 남김) |
| 홈 | `/?view=rec\|map\|cal` | 완료 (실제 API) — 시안 `html/home.html`. 추천 · 지도 · 달력 탭 + 이번 주 모임 + 지금 열려 있는 행사. 달력은 자동 넘김 · 기간 설정 없음(오늘 · 이번 주말 · 날짜 선택). 실제 카카오 지도는 도메인 등록 뒤 확인 필요 |
| 가입 취향 | `/member/join` · `/member/social-join` · `/my?tab=settings` | 완료 (실제 API) — 가입 ① 계정 ② 취향 ③ 지역. 마이 계정 설정에서 확인 · 수정 |

- 행사 · 모임 모두 실제 API 연결됨 (`USE_MOCK_EVENTS = false`, `USE_MOCK_MEETUPS = false`). 표의 '(목업)'은 화면을 처음 만든 시점 기준.
- 인증(passport·session, connect-mongo) 붙음 — `/member/login` · `/member/join` · `/member/social-join`. 찜은 다음 작업에서 추가 (지금 카드 하트는 저장 안 되는 로컬 상태, 추천 영역엔 하트 없음).
- 취향 · 추천(2026-11): `User.tastes`(행사 카테고리 키 6개, 1개 이상 필수) · `User.districts`(서울 자치구, 선택, 최대 3곳). 기존 회원은 비어 있을 수 있음. `GET /api/event/recommended` 순위 = 취향 일치 → 관심 지역 일치 → 참여했던 모임과 같은 분류 → 모집 중인 모임 많은 순 → 곧 끝나는 순 (`services/recommendService.js`). 행사 · 모임 목록 API 는 달력용 `from` · `to`(`YYYY-MM-DD`)도 받음.
- 모임: 만들기(로그인 · 만든 사람이 호스트) · 사진 업로드(`public/images/upload`) · 참여 신청(pending 저장) · 호스트 승인 · 참여 취소(`POST /api/meetup/:id/leave` — 신청 중 · 승인 모두 이야기 자리 시작 전까지, members 에서 빼서 다시 신청 가능, 승인된 사람은 채팅방에서도 빠지고 '○○님이 나갔어요') · 거절(`POST /api/meetup/:id/members/:userId/reject`) · 내보내기(`.../remove`) — 호스트가 이야기 자리 시작 전까지, members 에서 빼므로 다시 신청 가능, 상대에게 알리지 않음, 내보내면 채팅방에서도 빠지고 '○○님이 나갔어요' · 승인도 시작 전까지 · 수정(`/meetup/:id/edit`, 행사 빼고 전부, 정원은 승인 인원 이상) · 모집 마감/다시 열기 · 취소(되돌리기 없음, 목록 · 행사 모임 수에서 제외). 종료 시각은 없음. 신청자는 `Meetup.members` 배열에 임베드, 정원(`capacity`)은 **호스트 제외**. `talk.place` · `members` 는 호스트와 승인된 참여자에게만 내려준다.

## 평가 · 친구 · 채팅 (결정 로그 2026-10)

시안: `html/moyeobom-chat-friends/` (index.html 에 화면 목록 · 확정 규칙). 기한 계산은 전부 `services/socialRules.js` 한 곳.

- **평가**: 이야기 자리 날짜 다음날 12:00 열림 → 48시간 뒤 마감. 대상 = 확정 참여자(호스트 포함, 나 제외). 한 번만 제출. 매너는 3단계(좋았어요 / 보통이에요 / 아쉬웠어요)로 받아 `Review.praised` · `Review.disappointed` 에 저장하고 평가 마감에 매너 점수로 반영한다('보통'은 저장하지 않음 — 나머지가 보통). '또 만나고 싶어요'는 비공개이고 점수에 쓰지 않으며, 아쉬웠다고 고른 사람은 후보에서 빠진다.
- **친구**(2026-10 변경): 서로 '또 만나고 싶어요'를 고른 게 확정되는 순간 — 즉 **양쪽 평가가 다 들어온 때** — 바로 친구 + 1:1 방이 생긴다 (`friendService.makeFriends`). 요청 · 수락 · 거절 · 기한이 전부 없다. 한쪽만 골랐으면 아무 일도 없고 상대는 알 수 없다. 양쪽 제출이 조건이라 평가 기간 중에 성립해도 비공개는 깨지지 않는다(아직 안 낸 사람은 그 전에 아무것도 못 보고, 평가는 한 번만 제출 가능).
- **채팅**: 모임 방은 모임 만들 때 생기고(호스트), 승인하면 들어감. 평가 마감에 읽기 전용(취소하면 즉시) → 30일 동안 목록에 흐리게 · 신고 가능 → 닫힌 뒤 90일에 삭제(처리 중 신고가 있으면 보류). 1:1 방은 친구 끊기 · 차단하면 바로 목록에서 사라지고 90일 뒤 삭제.
- **cron**: 둘 다 매일 12:00(서울). `schedulers/socialCleanup.js` — 90일 지난 방 · 알림 삭제.
  `schedulers/reviewDaily.js` — 개설 가점 · 평가 열림/마감 임박 알림 · 평가 마감 반영.
  조회도 지금 시각과 비교하므로 cron 이 늦어도 화면은 맞음(점수 · 알림만 늦어진다).
- **socket.io**: `config/socket.js` — 세션으로 로그인 확인, 각자 `user:<id>` 방에만 들어감. 서버가 받는 사람 user 방으로 `chat:message` · `chat:read` · `chat:notices` · `chat:rooms` · `friends:changed` · `notify:changed` 를 보냄. 프론트는 `context/SocketContext.jsx` `useSocketEvent`.
- **차단**: 친구 끊김 + 이후 친구 성립 안 됨 + 내 모임 채팅에서 상대 메시지 숨김. **신고**: `Report` 저장만 — 처리(관리자) 화면 없음, DB에서 `status: 'done'` 으로 바꾸면 처리 끝. 이유(`reason`) 하나 필수, 기타는 내용(`detail`) 필수. 화면은 `components/common/ReportDialog.jsx` 하나 — 채팅 메시지 · 참여자, 차단하며 함께 신고, 참여자 관리 팝업(호스트 → 확정 참여자 `POST /api/meetup/:id/members/:userId/report`). 신청자 · 내보낸 사람은 채팅방 밖이라 신고 대상 아님. 모임 신고: 확정 참여자가 모임 상세 '모임 신고하기'로(`POST /api/meetup/:id/report-host`, 모임 채팅방이 목록에 보이는 동안), 신고 대상은 호스트. 항목 '호스트가 노쇼했어요'(`noshow`)는 호스트 대상(모임 신고 · 채팅 참여자 신고)에만, 이야기 자리 시작 뒤에만 · 취소된 모임 제외 (`socialRules.noShowReportOpen`). 저장만 하고 노쇼 판정 · 제재는 나중에 관리자 기능으로. 신고는 할 때마다 한 건씩 쌓임(대상 1 : 신고 n).
- 새 도메인(평가 · 친구 · 채팅)은 목업 없이 실제 API 전용 (`data/reviews.js` · `data/friends.js` · `data/chat.js` 맨 위 주석이 응답 모양).

## 매너 점수 · 알림 (결정 로그 2026-11)

### 매너 점수 — 설명 가능성이 1순위다

이 기능의 목적은 **"왜 내 점수가 깎였지? 왜 올랐지?"를 남기지 않는 것**이다. 점수를 움직이는 곳은
`services/mannerService.js` 의 `move()` 하나뿐이고, 세 가지를 지킨다.

1. **불변식 `점수 = 50 + Σ(MannerLog.scoreChange)`** (0~100). 이력을 다 더하면 현재 점수가 나온다.
   0·100 경계에 걸려 덜 적용됐으면 **적용분**을 `scoreChange` 에, 규칙상 요청분을 `requested` 에 적어
   화면이 "최고점이라 더 오르지 않았어요"를 설명한다. **`npm run manner:check` 가 전원에 대해 이 식을
   검사한다 — 규칙을 더할 때마다 통과해야 한다.** 마이페이지에도 `50 + 합 = 점수` 검산 줄이 있다.
2. **본인이 한 일이거나 본인이 볼 수 있는 결과만** 점수를 움직인다. 숨은 입력(남의 비공개 선택)
   하나로 움직이면 설명할 수가 없다. 남의 평가를 입력으로 쓸 때는 **문턱**을 둔다 — 한 사람의
   선택만으로는 움직이지 않는다 (아래 '올리는 건 1표, 깎는 건 과반').
3. **규칙 전문을 화면에 띄운다** (`/my?tab=praise` → '점수가 이렇게 움직여요'). 숨기면 추측이 시작된다.

**활동 가점(개설 · 참여)은 두 조건을 다 만족해야 인정한다** (2026-11-05).

1. **그 모임 평가를 보냈다** — 평가 제출이 그 모임에 실제로 관여했다는 **본인의 자발적 증거**라서,
   아무도 남을 판정하지 않고도 노쇼가 이득이 되지 않게 만든다.
2. **함께한 분들의 과반이 매너를 아쉽게 평가하지 않았다** — 그랬으면 활동으로 인정하지 않는다.

→ **"평가를 보내면 그 모임의 활동이 인정돼요. 단, 함께한 분들의 과반이 매너를 아쉽게 평가하면 인정되지 않아요."**

### 평가는 매너를 3단계로 받는다 (2026-11-05)

평가 1단계가 칭찬 체크박스에서 **좋았어요 / 보통이에요 / 아쉬웠어요** 로 바뀌었다. 이유는
**깎는 경로가 전혀 없었다는 것**이다 — 매너가 나쁜 사람도 참석하고 평가만 보내면 모임마다 +3 이고,
10번 나가면 50 → 80 으로 화면 라벨이 "아주 좋아요"가 됐다. **점수가 매너가 아니라 출석률을 재고 있었다.**

> **올리는 건 1표, 깎는 건 과반 (최소 2명).**
> '좋았어요'는 한 명만 골라도 +1. '아쉬웠어요'는 **2명 이상이고 평가한 사람의 과반**일 때만 -3,
> 그리고 **그 모임 활동 가점(+5 · +2)도 인정되지 않는다**. 둘 중 하나라도 못 넘기면 0점이고 이력에도 없다.

비대칭은 의도다 — 설명 못 하는 +1 은 아무도 항의하지 않지만 설명 못 하는 -1 은 이 기능의 목적을 깬다
(`move()` 가 깎일 때만 알림을 보내는 것과 같은 이유). 문턱은
`mannerService.isLowManner(count, raters)` 한 곳이고 `MIN_LOW_COUNT` 가 조정 지점이다.
`raters` 는 나를 평가할 수 있었던 평가자 수(내가 낸 평가는 세지 않는다).

| 나를 평가한 사람 | 1명 | 2명 | 3명 | 4명 | 5명 | 7명 | 10명 |
|---|---|---|---|---|---|---|---|
| 깎이는 데 필요한 '아쉬웠어요' | **없음** | 2 (전원) | 2 | 3 | 3 | 4 | 6 |

**감점 크기가 아니라 활동 인정 여부로 푼 이유.** -2 만 붙이면 참여자는 `+2 +1 -2 = +1`, 호스트는
`+5 +1 -2 = +4` 로 **매너가 아쉬웠다고 확인된 사람의 점수가 오른다.** 감점을 키워 막으려면 호스트
기준으로 -7 쯤 필요해지고 그러면 호스트 취소(-5)보다 커져 서열이 뒤집힌다. 활동 인정 여부로 풀면
호스트와 참여자가 **대칭**이 된다 — 둘 다 평가 제출 +1 만 남고 거기서 -3 이 붙어 net -2.

| 오를 때 | 점수 | 반영 시점 |
|---|---|---|
| 모임을 열었다 | +5 | 평가 마감 (cron) — **평가를 보냈고 매너가 과반으로 아쉽지 않을 때만** |
| 모임에 참여했다 | +2 | 평가 마감 (cron) — 조건 같음 |
| 평가를 보냈다 | +1 | 제출 즉시 |
| 매너가 좋았다는 평가를 받았다 | +1/건 | 평가 마감 (cron) — **한 명만 골라도 오른다** |
| 친구가 됐다 | +1 | 성립 즉시 (양쪽) |

| 깎일 때 | 점수 |
|---|---|
| 확정된 참여 취소 — 이야기 자리 24시간 이내 (`socialRules.isLateLeave`) | -1 |
| 참여자가 있는 모임을 호스트가 취소 | -5 |
| 평가를 안 냈다 | -1 (평가 마감, cron) — 단 **아무도 평가를 안 낸 모임은 전원 감점 없음** |
| 평가자 과반(최소 2명)이 매너를 아쉽게 평가 | -3 (평가 마감, cron) + **그 모임 활동 가점도 없음** |

결과 서열 (한 방향으로 정렬된다 — 노쇼가 이득이 아니고, 매너가 아쉬웠다고 확인되면 점수가 오르지 않는다):

| 참석+평가+좋은 평가 | 참석 + 평가 | 미리 취소 | 참석했지만 미제출 | 말없이 안 옴 | 늦게 취소 | 매너 아쉬움(과반) | 노쇼 신고 인정 | 호스트 취소 |
|---|---|---|---|---|---|---|---|---|
| **+4 이상** | **+3** | **0** | **-1** | **-1** | **-1** | **-2** | **-4** | **-5** |

매너 아쉬움이 미제출(-1)보다 나쁘다 — 평가를 안 낸 건 게으름이고, 과반이 매너를 아쉽다고 한 건
실제로 남에게 피해를 준 것이다. 호스트 취소(-5)보다는 가볍다.

**일부러 0점인 것 — 물어보면 답할 수 있어야 한다**

| 사건 | 왜 0인가 |
|---|---|
| 미리 취소 (이야기 자리 24시간 전까지) | 미리 알려 주는 건 손해가 없어야 한다 |
| 신청 중(승인 전) 취소 | 아무 자리도 비우지 않았다 |
| 참여자 없는 모임 취소 | 아무도 영향받지 않았다 |
| **호스트가 내보냈을 때** (`meetupService.removeMember`) | **본인이 한 일이 아니다.** 늦은 취소(-1)와 달리 본인 선택이 아니므로 원칙 2 에 따라 깎지 않는다. 팀원 코드가 `mannerService.left` 를 부르지 않는 건 우연이 아니라 의도다 — 지우지 말 것 |
| **한 사람만 매너를 아쉽게 평가** | 한 사람 판단으로는 움직이지 않는다. 과반이 아니면 **이력에도 남지 않고 본인에게 보여주지도 않는다** — 점수가 안 움직였는데 보여주면 역추적과 상처만 남는다 |
| **'또 만나고 싶어요' 받음** | 한쪽만 고른 건 상대에게 드러나지 않는 게 약속이다. 점수가 움직이면 역추적 여지가 생기고 본인에게도 설명할 수 없다. 상호 선택은 '친구가 됐다 +1' 로만 반영한다 |
| **노쇼** | 확인할 방법이 없어 **따로 깎지 않는다.** 대신 평가를 보낼 수 없어서 그 모임의 활동 가점(+2 · +5)이 인정되지 않는다 |
| 신고 · 차단 · 친구 끊기 | 관리자 판단 화면이 없거나, 누구 잘못인지 알 수 없다 |

**버린 대안들 — 같은 논의를 반복하지 않도록 남겨 둔다**

| 버린 안 | 왜 |
|---|---|
| 노쇼를 평가에서 지목받게 하기 (2026-11-05) | **1표로 바로 깎인다.** 고의로 누르는 걸 막을 수 없고, 지목자가 익명이라 책임을 물을 수 없고, 되돌릴 관리자 화면도 없어 원칙 2)가 깨진다. 노쇼는 신고 → 관리자 판단이 받는다 |
| 최소치 없는 순수 과반 | `raters=1` 이면 과반이 1 이라 **한 사람 판단으로 깎인다** (5인 모임에서 한 명만 평가를 내도 성립) |
| 최소 3명 + 과반 | 3인 모임(`raters=2`)에 감점 경로가 없어진다. `capacity` 최소가 2(호스트 제외)라 **가장 흔한 크기에서 기능이 죽는다** |
| 전원 일치 | 만석(호스트+10)이면 10명 전원이 같은 평가를 해야 하므로 **"큰 모임에 숨으면 안전하다"** 는 구멍이 생긴다 |
| '아쉬웠어요'에 -2 만 붙이기 | 활동 가점이 남아 **매너가 아쉬웠다고 확인된 사람의 점수가 오른다**(참여자 +1 · 호스트 +4) |

**알고 받아들이는 한계 두 가지**

- **`평가자 3명 중 2명` 에서는 둘이 짜면 통과한다.** 피해가 한 모임당 net -2 로 묶여 있고, 이력에
  `type: 'review_low'` + 모임 참조가 남아 사후 추적이 되고, 신고 → 관리자 판단으로 되돌릴 수 있어서
  받아들인다. 문제가 실제로 생기면 **조정 지점은 `MIN_LOW_COUNT` 를 3 으로 올리는 것**이다.
- **작은 모임에서 매너 평가는 사실상 공개다.** 3인 모임이면 나를 평가할 사람이 2명뿐이라 서로 알 수
  있다. 그게 바로 이 문턱의 근거이기도 하다 — 지목 가능성이 억제력이다. 그래서 **UI 에 '익명'이라고
  적지 않는다.** 지킬 수 있는 약속은 "우리가 알려주지 않는다"이고 "아무도 알 수 없다"가 아니다
  (`/my?tab=praise` 태그는 '평가자 비공개'). 반면 '또 만나고 싶어요'의 "아무에게도 알려지지 않아요"는
  양쪽 제출까지 서버가 아무것도 내보내지 않으므로 실제로 지켜지는 약속이다.

- **평가 미제출 감점은 알림이 전제조건이다.** 열림(마감 48시간 전)과 마감 임박(24시간 전) 알림을
  보내야 "몰라서 못 냈다"가 남지 않는다. 알림을 함께 만든 이유가 이것이다.
- 저장은 `User.manner.score` 하나. 이력은 `models/MannerLog.js`(컬렉션 `mannerlogs`).
- **노출**: 내 프로필 · 내 모임 머리줄 · 모임 상세 호스트 · 참여자 목록 · 친구 목록.
  **평가 화면에는 띄우지 않는다** — 점수를 보고 매너 평가를 고르면 평가가 점수를 따라간다.
  그래서 `services/publicUser.js`(점수 포함)는 `meetupService` · `friendService` 만 쓰고,
  `reviewService` · `chatService` 는 점수 없는 로컬 `publicUser` 를 유지한다.
  ⚠ 짝이 되는 조회에 `PUBLIC_USER_FIELDS` 를 써야 한다 — select 에서 `manner` 가 빠지면 전원 기본값(50)이 조용히 나간다.
- 가입 직후부터 50 으로 **보인다** (숨기지 않는다 — 활동 점수는 이미 움직이는데 숫자가 없으면 그게 새 의문이다).

### 알림

`models/Notification.js`(컬렉션 `notifications_v2`) + `services/notificationService.js` 한 곳에서만 보낸다.
소켓은 `notify:changed`(payload 비움) → 프론트 재조회. 화면은 헤더 종 아이콘 드롭다운, 90일 뒤 정리.

| type | 받는 사람 | 거는 곳 |
|---|---|---|
| `meetup_apply` | 호스트 | `meetupService.applyMeetup` |
| `meetup_approved` | 신청자 | `meetupService.approveMember` |
| `meetup_left` | 호스트 | `meetupService.leaveMeetup` |
| `meetup_cancelled` | 신청 중 · 승인 전원 | `meetupService.setMeetupStatus` |
| `meetup_updated` | 승인된 참여자 | `meetupService.updateMeetup` |
| `review_open` · `review_closing` | 확정 참여자 / **미제출자만** | cron |
| `friend_matched` | 양쪽 | `friendService.makeFriends` |
| `manner_down` | 본인 | `mannerService.move` (깎일 때만) |

**보내지 않는 것**: 채팅 새 메시지(헤더에 안 읽은 수 점이 이미 있다) · **점수가 오를 때**(이력에서
확인) · 차단/차단 해제(상대가 알면 안 된다) · 친구 끊기(탈퇴도 `endFriendship` 을 지나 구분할 수
없다) · 평가 제출(비공개) · 신청 거절 · 내보내기(상대에게 따로 알리지 않기로 함) ·
신고(상대가 알면 안 된다).

- API: `GET /api/notification?limit=` · `GET /api/notification/unread` · `POST /api/notification/read`
  (`ids` 없으면 전부 읽음). 전부 로그인 필요 — 내 알림만 본다.
- cron 알림은 `{ user, type, meetup }` 유니크 부분 인덱스로 중복을 막는다 (`11000` 무시).
  모임 쪽 멱등 표식은 `reviewAppliedAt` · `reviewOpenNoticedAt` · `reviewClosingNoticedAt`.
- 곁가지 실패가 본 작업을 깨지 않도록 전부 `services/sideEffect.js` 의 `sideEffect()` 로 감싼다.
- ⚠ `emitToUsers` 는 `io` 가 없으면 조용히 무시한다. `npm run review:daily` 로 수동 실행하면 알림이
  DB 에는 쌓이지만 실시간 push 는 안 간다 (cron 은 `app.js` 안에서 돌아 정상).

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

> **새 환경에서는 동기화를 한 번 돌려야 행사가 보인다.** 코드만 받아서는 `events_v2` 가 비어 있고
> 목록이 '조건에 맞는 행사가 없어요'로 뜬다. 자동 cron 은 04:00 에만 돌므로 그 시각에 서버가 꺼져
> 있으면 영원히 안 채워진다. 2026-11-04 실행: 받음 19,705 · **추가 196** · 건너뜀(분류 7,522 · 종료 11,987).
> 실행 이력은 `SyncLog`(`synclogs`)에 남는다 — 비어 있으면 안 돌린 것이다. 장소도 같이: `npm run sync:places`.

### ⚠ v1 과 같은 DB 를 쓴다 — 컬렉션 이름이 겹치면 안 된다

v1(`Moyeobom`, 바탕화면 별도 폴더)과 v2 의 `.env` 가 **같은 Atlas 클러스터의 같은 DB(`moyeobom`)**
를 가리킨다. 그래서 컬렉션 이름이 겹치면 v1 기록이 v2 화면에 섞여 나온다.

- **`models/Event.js` → 컬렉션 `events_v2`**. v1 Event 가 `events` 에 4999건 남아 있고 스키마가 다르다
  (`sourceId` · `startAt` · `endAt` · `coords` · `genres`, `category` 는 한글 원문). 섞이면 v2 가 읽는
  `startDate` · `endDate` · `source` · `district` 가 전부 빈 값이 되어 **목록이 0건**(기간 필터에 안 걸림),
  **분류 필터가 항상 0건**, 홈은 4999건을 집계해 멈춘다. 2026-11-04 에 이걸로 하루를 잃었다.
- 새 모델을 만들 때 아래 v1 컬렉션과 겹치는지 먼저 확인할 것.
  `meetings · meetingreviews · comments · feeds · favorites · userfavorites · congestions · places ·
  visitlogs · badges · userbadges · usernotifysettings · messages · activities · notifications · events`
- `users` · `blocks` · `reports` · `chatrooms` · `chatmessages` · `friendships` · `reviews` · `meetups`
  는 공유 중이다 (`users` 는 같은 계정을 쓰므로 의도된 것).

**⚠ 컬렉션 이름만 문제가 아니다 — v1 이 만든 인덱스도 남는다.** mongoose 는 스키마에 없는 인덱스를
자동으로 지우지 않는다. 그중 **유니크** 인덱스는 v2 에 없는 필드를 가리키므로 두 번째 문서부터
`{ 그 필드: null }` 중복으로 저장이 **조용히 실패**한다. 2026-11-04 에 실제로 막혔던 것:

| 인덱스 | v1 필드 | v2 는 | 증상 |
|---|---|---|---|
| `chatrooms.participants_1` (U) | `participants` | `users` | **두 번째 채팅방을 못 만든다** — 친구 성립·모임 방 생성이 멈춘다 |
| `friendships.users_1` (U) | `users` | `userA`·`userB` | **두 번째 친구가 안 생긴다** |
| `users.handle_1` | `handle` | 없음 | (유니크 아님 — 무해) |

→ **`npm run db:sync-indexes`** 로 정리한다 (`scripts/syncIndexes.js` — 스키마에 선언된 인덱스만 남긴다).
새 모델을 만들거나 인덱스를 바꾼 뒤에는 한 번 돌려 볼 것. v1 을 다시 돌리면 v1 이 자기 인덱스를 다시 만든다.

### 행사 목록은 한 페이지씩 (2026-11-04)

`GET /api/event/list` → `{ events, total, genres }`. `page` · `limit`(기본 15 · 상한 50) 받음.

- **`$limit` 이 모임 수 집계보다 앞에 와야 한다.** 전량에 `$lookup` 을 걸면 3분, 페이지만 세면 100ms 대다.
  그래서 `meetupCountStages`($lookup)를 버리고 `services/eventService.js` 의 **`meetupStats()`** 로
  모임 쪽에서 한 번에 모아 **그 페이지 분량에만** 붙인다 (모임이 행사보다 훨씬 적다).
  `listEventsForRanking`(추천) · `listRecentEndedEvents` · `getEvent` 도 같은 방식.
- **기본 정렬이 `endingSoon`(곧 끝나는 순)** 이다. `sort=meetups` 는 '모임 있는 행사 먼저, 같으면 곧
  끝나는 순'으로 동작한다 — 정확한 '모임 많은 순'은 `Event` 에 모임 수를 비정규화해야 가능하다(미결정).
- `genres`(분야 선택지)는 **분야 조건 적용 전** 기준으로 뽑는다. 한 페이지만 보고 만들면 선택지가 빠지고,
  분야를 고른 뒤 기준으로 만들면 고른 분야만 남는다. 덕분에 분야를 고를 때 전량을 한 번 더 받던
  `pages/event/List.jsx` 의 두 번째 호출이 없어졌다.
- 목록 응답은 카드에 필요한 필드만 온다(`LIST_FIELDS`). `description` 같은 큰 필드는 상세에서만.
- **`fetchEvents` 를 부르는 곳은 전부 `limit` 을 넘긴다** — 홈(섹션 5건, 개수는 `total`) · 지도(50) ·
  달력(50) · 비슷한 행사(4) · 모임 만들기(8) · 목록(페이지). 전량을 받는 호출을 새로 만들지 말 것.
- 프론트 목록은 '더 보기'로 페이지를 **누적**한다. `useAsync` 는 data 를 갈아 끼우므로 누적은 호출부에서
  하고, 필터가 바뀌면 `key` 비교로 즉시 1페이지로 돌아간다.
- **모임 목록(`/api/meetup/list`)은 아직 전량 조회다.** 모임이 적어 지금은 괜찮지만 쌓이면 같은 작업이 필요하다.

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
- 승인 기한 · 신청 마감 시점
- 비용 필터 기준, 모임 목록 필터(참여 방식 · 술 · 예산) 확정 여부
- 채팅 공지 최대 개수 — 지금 임시 3개 (`services/chatService.js` `NOTICE_MAX`)
- 친구 메모 글자 수 — 지금 임시 30자 (시안 제안값, `models/Friendship.js` `MEMO_MAX` · `frontend/src/data/friends.js`)
- 신고 기타 내용 글자 수 — 지금 임시 200자 (`models/Report.js` `DETAIL_MAX` · `frontend/src/data/constants.js`)
- 노쇼 판정 주체 — **신고 → 관리자 판단으로 가기로 함** (2026-11-05). **접수까지는 만들어졌다** — `Report.reason` 에 `'noshow'`(호스트 노쇼)가 있고, 모임 상세 '모임 신고하기'와 채팅 참여자 신고에서 호스트를 대상으로만 고를 수 있다 (`socialRules.noShowReportOpen` — 이야기 자리 시작 뒤 · 취소된 모임 제외). **아직 없는 것**: 관리자 판단 화면 · 인정 시 감점(-3, 미제출 -1 과 합쳐 net -4) · 기각 시 되돌리기. 되돌리기는 이력 삭제가 아니라 `manner_revert` 반대 부호 이력 추가여야 한다 — 불변식(점수 = 50 + Σ) 때문이다. 그때까지 노쇼는 점수를 움직이지 않고, 활동 가점을 평가 제출에 묶어 이득이 되지 않게만 해 뒀다. QR · 방문 인증이 생기면 다시 볼 것
- 모임 채팅 '채팅방 나가기' 버튼 — 참여 취소와 같은 동작으로 하기로 함(2026-10). 버튼은 아직 모임 상세 신청 박스에만 있음
- 신고 처리 주체 · 화면 (접수만 되고 관리자 판단이 없어 매너 점수에도 반영하지 않는다)

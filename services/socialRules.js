// 평가 · 친구 · 채팅 기한 — 결정 로그(2026-10) 기준. 시각은 전부 서울 시간 12:00 에 맞춤
//   평가: 이야기 자리 날짜 다음날 12:00 열림 → 48시간 뒤 마감
//   친구 요청: 평가 마감부터 7일 ('요청 가능' · '보낸 요청' 같은 날 만료). 처리는 매일 12:00 cron
//   모임 채팅: 평가 마감에 읽기 전용 → 30일 동안 목록에 흐리게 · 신고 가능 → 닫힌 뒤 90일에 삭제
//   1:1 채팅: 친구 끊기 · 차단하면 목록에서 바로 사라짐 → 90일 뒤 삭제

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const KST_OFFSET = 9 * HOUR;

const REVIEW_OPEN_HOUR = 12; // 다음날 12:00
const REVIEW_HOURS = 48;
const FRIEND_REQUEST_DAYS = 7;
const CLOSED_ROOM_VISIBLE_DAYS = 30;
const CHAT_KEEP_DAYS = 90;
const SENT_EXPIRED_SHOW_DAYS = 7; // 임시 — 만료된 '보낸 요청'을 목록에 남겨 두는 기간 (결정 로그에 없음)

/** 이야기 자리 시각 → { opensAt, closesAt } (서울 날짜 기준 다음날 12:00 ~ +48시간) */
function reviewWindow(talkStartAt) {
  const kst = new Date(talkStartAt).getTime() + KST_OFFSET;
  const kstMidnight = Math.floor(kst / DAY) * DAY;
  const opensAt = new Date(kstMidnight + DAY + REVIEW_OPEN_HOUR * HOUR - KST_OFFSET);
  const closesAt = new Date(opensAt.getTime() + REVIEW_HOURS * HOUR);
  return { opensAt, closesAt };
}

/** 모임 채팅방이 닫히는(읽기 전용이 되는) 시각 */
function meetupRoomClosesAt(meetup) {
  return reviewWindow(meetup.talk.startAt).closesAt;
}

const friendRequestExpiresAt = (reviewClosesAt) => new Date(new Date(reviewClosesAt).getTime() + FRIEND_REQUEST_DAYS * DAY);

module.exports = {
  HOUR,
  DAY,
  REVIEW_HOURS,
  FRIEND_REQUEST_DAYS,
  CLOSED_ROOM_VISIBLE_DAYS,
  CHAT_KEEP_DAYS,
  SENT_EXPIRED_SHOW_DAYS,
  reviewWindow,
  meetupRoomClosesAt,
  friendRequestExpiresAt,
};

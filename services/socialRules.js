// 평가 · 친구 · 채팅 기한 — 계산은 전부 여기. 시각은 서울 시간 12:00 에 맞춤
//   평가: 이야기 자리 날짜 다음날 12:00 열림 → 48시간 뒤 마감
//   친구: 서로 '또 만나고 싶어요'를 고른 게 확정되는 순간(양쪽 평가가 다 들어온 때) 바로 성립 — 기한 없음
//   모임 채팅: 평가 마감에 읽기 전용 → 30일 동안 목록에 흐리게 · 신고 가능 → 닫힌 뒤 90일에 삭제
//   1:1 채팅: 친구 끊기 · 차단하면 목록에서 바로 사라짐 → 90일 뒤 삭제
//   매너 점수: 이야기 자리 24시간 안에 확정된 참여를 취소하면 늦은 취소로 본다
//   관람 동행 신청: 이야기 자리 전날까지 — 승인 뒤 회차를 정하고 예매할 하루를 남긴다

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const KST_OFFSET = 9 * HOUR;

const REVIEW_OPEN_HOUR = 12; // 다음날 12:00
const REVIEW_HOURS = 48;
const LATE_LEAVE_HOURS = 24; // 이 시간 안에 확정된 참여를 취소하면 늦은 취소 (-1)
const CLOSED_ROOM_VISIBLE_DAYS = 30;
const CHAT_KEEP_DAYS = 90;

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

/** 이야기 자리를 앞두고 취소했는지 — 늦은 취소면 true (services/mannerService.js) */
const isLateLeave = (talkStartAt, now = new Date()) => new Date(talkStartAt) - now <= LATE_LEAVE_HOURS * HOUR;

/** '관람부터 함께' 신청이 닫히는 시각 — 이야기 자리 날짜(서울) 0시. 그 전날까지 받는다 */
function watchApplyClosesAt(talkStartAt) {
  const kst = new Date(talkStartAt).getTime() + KST_OFFSET;
  return new Date(Math.floor(kst / DAY) * DAY - KST_OFFSET);
}

const watchApplyOpen = (talkStartAt, now = new Date()) => now < watchApplyClosesAt(talkStartAt);

/** '호스트 노쇼' 신고를 받을 수 있는지 — 이야기 자리가 시작된 뒤, 취소된 모임 제외 */
function noShowReportOpen(meetup, now = new Date()) {
  return Boolean(meetup) && meetup.status !== 'cancelled' && new Date(meetup.talk.startAt) <= now;
}

module.exports = {
  HOUR,
  DAY,
  REVIEW_HOURS,
  LATE_LEAVE_HOURS,
  CLOSED_ROOM_VISIBLE_DAYS,
  CHAT_KEEP_DAYS,
  reviewWindow,
  meetupRoomClosesAt,
  isLateLeave,
  watchApplyClosesAt,
  watchApplyOpen,
  noShowReportOpen,
};

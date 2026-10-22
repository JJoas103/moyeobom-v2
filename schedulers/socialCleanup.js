const cron = require('node-cron');
const { expireLinks } = require('../services/friendService');
const { purgeClosedRooms } = require('../services/chatService');

// 친구 요청 만료 · 오래된 채팅 삭제 — 매일 12:00(서울)
// 평가 마감이 늘 12:00 이라 같은 시각에 돌리면 하루 늦게 만료되는 일이 없음
// (조회 쪽도 expiresAt · closesAt 을 지금 시각과 비교하므로 cron 이 늦어도 화면은 맞음)
const SCHEDULE = '0 12 * * *';
const TIMEZONE = 'Asia/Seoul';

async function runSocialCleanup(now = new Date()) {
  try {
    const expired = await expireLinks(now);
    const purged = await purgeClosedRooms(now);
    console.log(
      `[친구 · 채팅 정리] 요청 만료 ${expired} · 방 삭제 ${purged.rooms}(메시지 ${purged.messages})` +
        `${purged.kept ? ` · 신고 처리 중이라 보류 ${purged.kept}` : ''}`
    );
  } catch (err) {
    console.error('[친구 · 채팅 정리] 실행 오류:', err.message);
  }
}

function startSocialCleanupScheduler() {
  cron.schedule(SCHEDULE, () => runSocialCleanup(), { name: 'social-cleanup', timezone: TIMEZONE, noOverlap: true });
  console.log(`[친구 · 채팅 정리] 스케줄 등록: 매일 12:00 (${TIMEZONE})`);
}

module.exports = { startSocialCleanupScheduler, runSocialCleanup };

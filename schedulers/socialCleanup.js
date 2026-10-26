const cron = require('node-cron');
const { purgeClosedRooms } = require('../services/chatService');

// 오래된 채팅 삭제 — 매일 12:00(서울)
// 평가 마감이 늘 12:00 이라 같은 시각에 돌린다
// (조회 쪽도 closesAt 을 지금 시각과 비교하므로 cron 이 늦어도 화면은 맞음)
const SCHEDULE = '0 12 * * *';
const TIMEZONE = 'Asia/Seoul';

async function runSocialCleanup(now = new Date()) {
  try {
    const purged = await purgeClosedRooms(now);
    console.log(
      `[채팅 정리] 방 삭제 ${purged.rooms}(메시지 ${purged.messages})` +
        `${purged.kept ? ` · 신고 처리 중이라 보류 ${purged.kept}` : ''}`
    );
  } catch (err) {
    console.error('[채팅 정리] 실행 오류:', err.message);
  }
}

function startSocialCleanupScheduler() {
  cron.schedule(SCHEDULE, () => runSocialCleanup(), { name: 'social-cleanup', timezone: TIMEZONE, noOverlap: true });
  console.log(`[채팅 정리] 스케줄 등록: 매일 12:00 (${TIMEZONE})`);
}

module.exports = { startSocialCleanupScheduler, runSocialCleanup };

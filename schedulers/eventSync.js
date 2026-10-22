const cron = require('node-cron');
const { syncSeoulCulture } = require('../services/eventSyncService');
const { runAndLog } = require('./runAndLog');

// 행사 동기화 — 매일 새벽 4시(서울). 수동 실행은 npm run sync:events
const SCHEDULE = '0 4 * * *';
const TIMEZONE = 'Asia/Seoul';

const runEventSync = (trigger) => runAndLog('행사 동기화', () => syncSeoulCulture({ trigger }));

function startEventSyncScheduler() {
  cron.schedule(SCHEDULE, () => runEventSync('cron'), {
    name: 'event-sync',
    timezone: TIMEZONE,
    noOverlap: true, // 같은 프로세스 안 중복 실행 방지 (프로세스 간은 SyncLog 잠금)
  });
  console.log(`[행사 동기화] 스케줄 등록: 매일 04:00 (${TIMEZONE})`);
}

module.exports = { startEventSyncScheduler, runEventSync };

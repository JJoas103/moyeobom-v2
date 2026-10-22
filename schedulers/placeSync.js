const cron = require('node-cron');
const { syncToilets, syncStations } = require('../services/placeSyncService');
const { runAndLog } = require('./runAndLog');

// 화장실 · 지하철역 동기화 — 거의 안 바뀌어서 매달 1일 새벽 4시 30분(서울). 수동 실행은 npm run sync:places
const SCHEDULE = '30 4 1 * *';
const TIMEZONE = 'Asia/Seoul';

/** 화장실 → 역 순서로 실행. 각각의 SyncLog(또는 null) 반환 */
async function runPlaceSync(trigger) {
  const toilets = await runAndLog('화장실 동기화', () => syncToilets({ trigger }));
  const stations = await runAndLog('역 동기화', () => syncStations({ trigger }));
  return { toilets, stations };
}

function startPlaceSyncScheduler() {
  cron.schedule(SCHEDULE, () => runPlaceSync('cron'), { name: 'place-sync', timezone: TIMEZONE, noOverlap: true });
  console.log(`[장소 동기화] 스케줄 등록: 매달 1일 04:30 (${TIMEZONE})`);
}

module.exports = { startPlaceSyncScheduler, runPlaceSync };

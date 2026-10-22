const Event = require('../models/Event');
const seoulCulture = require('./sources/seoulCulture');
const { runSync } = require('./syncRunner');

// 행사 동기화 — source.name + source.id 기준 upsert
// 응답에서 빠진 행사도 삭제 안 함 (모임이 참조 · 끝난 행사도 보존)

/**
 * 서울시 문화행사 동기화
 * @param {{ trigger?: 'cron'|'manual' }} options
 * @returns SyncLog 문서 (이미 실행 중이면 { alreadyRunning: true, running })
 */
function syncSeoulCulture({ trigger = 'manual' } = {}) {
  return runSync({
    logSource: 'SEOUL',
    sourceName: 'SEOUL',
    trigger,
    Model: Event,
    pageSize: seoulCulture.PAGE_SIZE,
    fetchPage: seoulCulture.fetchPage,
    transform: (row, ctx) => {
      const result = seoulCulture.toEvent(row, ctx);
      return result.skip ? { skip: result.skip === 'no-id' ? 'invalid' : result.skip } : { doc: result.event };
    },
  });
}

module.exports = { syncSeoulCulture };

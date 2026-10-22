const SyncLog = require('../models/SyncLog');

// 외부 데이터 동기화 공통 — 페이지 단위 수신 → source.name + source.id 기준 upsert → SyncLog 기록
// 사용처: 행사(eventSyncService) · 화장실 · 역(placeSyncService)

const STALE_MS = 60 * 60 * 1000; // 1시간 넘게 'running' 이면 중단된 실행으로 간주
const MAX_ERROR_MESSAGES = 20;
const FETCH_RETRIES = 2;
const REMOVE_GUARD_RATIO = 0.5; // 받은 수가 저장된 수의 절반 미만이면 삭제 건너뜀 (출처 장애 대비)

async function withRetry(fn) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= FETCH_RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}

// axios 에러 메시지에 요청 URL(인증키 포함)이 섞일 수 있음 → 상태·코드만 기록
const errorText = (err) => (err.response ? `HTTP ${err.response.status}` : err.code || err.message);

function pushError(log, message) {
  if (log.errorMessages.length < MAX_ERROR_MESSAGES) log.errorMessages.push(message);
}

/** 실행 중인 동기화 로그 반환 (없으면 null). 오래된 'running' 은 실패로 정리 */
async function findRunning(source) {
  const running = await SyncLog.findOne({ source, status: 'running' }).sort({ startedAt: -1 });
  if (!running) return null;
  if (Date.now() - running.startedAt.getTime() < STALE_MS) return running;
  running.status = 'failed';
  running.finishedAt = new Date();
  running.errorMessages.push('중간에 멈춘 실행 — 다음 실행에서 정리');
  await running.save();
  return null;
}

// 저장된 문서와 내용 비교 — 같으면 쓰기 생략 (updatedAt · updated 건수에 실제 변경만 반영)
function sameContent(saved, { source, ...fields }) {
  if ((saved.source?.url ?? null) !== (source.url ?? null)) return false;
  return Object.entries(fields).every(([key, value]) => JSON.stringify(saved[key] ?? null) === JSON.stringify(value ?? null));
}

async function upsertDocs(Model, docs, log) {
  const ops = docs.map(({ source, ...fields }) => ({
    updateOne: {
      filter: { 'source.name': source.name, 'source.id': source.id },
      update: { $set: { ...fields, ...(source.url !== undefined && { 'source.url': source.url }) } },
      upsert: true,
    },
  }));

  let result;
  try {
    result = await Model.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // ordered:false — 일부 실패해도 나머지는 저장
    if (!err.writeErrors && !err.result) throw err;
    result = err.result;
    const writeErrors = err.writeErrors || [];
    log.failed += writeErrors.length;
    writeErrors.forEach((e) => pushError(log, `저장 실패: ${e.errmsg || e.message}`));
  }

  log.inserted += result.upsertedCount || 0;
  log.updated += result.modifiedCount || 0;
}

/** 한 페이지 저장 — 바뀐 것만 upsert, 동기화 시각은 받은 문서 전부 갱신 */
async function savePage(Model, docs, syncedAt, log) {
  if (!docs.length) return;

  const sourceName = docs[0].source.name;
  const ids = docs.map((d) => d.source.id);
  const saved = await Model.find({ 'source.name': sourceName, 'source.id': { $in: ids } }).lean();
  const savedById = new Map(saved.map((e) => [e.source.id, e]));

  const changed = docs.filter((doc) => {
    const prev = savedById.get(doc.source.id);
    return !prev || !sameContent(prev, doc);
  });
  log.unchanged += docs.length - changed.length;

  if (changed.length) await upsertDocs(Model, changed, log);

  await Model.updateMany(
    { 'source.name': sourceName, 'source.id': { $in: ids } },
    { $set: { 'source.syncedAt': syncedAt } },
    { timestamps: false } // 동기화 시각만 변경 (내용 변경 아님)
  );
}

/**
 * 동기화 한 번 실행
 * @param {{
 *   logSource: string,              // SyncLog.source — 동시 실행 잠금 단위
 *   sourceName: string,             // 문서의 source.name
 *   trigger: 'cron'|'manual',
 *   Model: mongoose.Model,
 *   pageSize: number,
 *   fetchPage: (start, end) => Promise<{ total, rows }>,
 *   transform: (row, { now }) => ({ doc } | { skip: 'category'|'ended'|'invalid' }),
 *   removeMissing?: boolean,        // 출처에서 사라진 문서를 지울지 (행사는 false — 모임이 참조)
 * }} options
 * @returns SyncLog 문서 (이미 실행 중이면 { alreadyRunning: true, running })
 */
async function runSync({ logSource, sourceName, trigger, Model, pageSize, fetchPage, transform, removeMissing = false }) {
  await Promise.all([Model.init(), SyncLog.init()]); // upsert 기준 · 동시 실행 방지 인덱스 먼저 생성
  const running = await findRunning(logSource);
  if (running) return { alreadyRunning: true, running };

  let log;
  try {
    log = await SyncLog.create({ source: logSource, trigger });
  } catch (err) {
    if (err.code === 11000) return { alreadyRunning: true, running: await findRunning(logSource) }; // 방금 다른 쪽이 시작함
    throw err;
  }
  const now = new Date();

  try {
    let seen = 0; // 이번에 받아 저장 대상이 된 수
    for (let start = 1, total = Infinity; start <= total; start += pageSize) {
      const page = await withRetry(() => fetchPage(start, start + pageSize - 1));
      total = page.total;
      log.fetched += page.rows.length;

      const docs = [];
      for (const row of page.rows) {
        const result = transform(row, { now });
        if (result.skip) {
          log.skipped[result.skip in log.skipped ? result.skip : 'invalid'] += 1;
          continue;
        }
        const invalid = new Model(result.doc).validateSync();
        if (invalid) {
          log.failed += 1;
          pushError(log, `검증 실패 (${result.doc.source?.id}): ${invalid.message}`);
          continue;
        }
        docs.push(result.doc);
      }
      seen += docs.length;

      await savePage(Model, docs, now, log);
      await log.save(); // 페이지마다 진행 상황 기록
    }

    if (removeMissing) await removeStale(Model, sourceName, now, seen, log);
    log.status = 'success';
  } catch (err) {
    log.status = 'failed';
    pushError(log, `중단: ${errorText(err)}`);
  } finally {
    log.finishedAt = new Date();
    await log.save();
  }

  return log;
}

// 이번 실행에서 받지 못한(= 출처에서 사라진) 문서 정리
async function removeStale(Model, sourceName, now, seen, log) {
  const stored = await Model.countDocuments({ 'source.name': sourceName });
  if (seen < stored * REMOVE_GUARD_RATIO) {
    pushError(log, `받은 수(${seen})가 저장된 수(${stored})보다 너무 적어 삭제를 건너뜀`);
    return;
  }
  const { deletedCount } = await Model.deleteMany({ 'source.name': sourceName, 'source.syncedAt': { $lt: now } });
  log.removed += deletedCount;
}

module.exports = { runSync };

// 동기화 1회 실행 + 결과 한 줄 로그. 실패해도 throw 없이 SyncLog(또는 null) 반환
async function runAndLog(label, run) {
  try {
    const result = await run();
    if (result.alreadyRunning) {
      console.log(`[${label}] 이미 실행 중이라 건너뜀 (${result.running?.startedAt?.toISOString() || '시작 시각 모름'} 시작)`);
      return result;
    }
    const { status, fetched, inserted, updated, unchanged, removed, failed, skipped, errorMessages } = result;
    const seconds = ((result.finishedAt - result.startedAt) / 1000).toFixed(1);
    const skippedText = Object.entries({ 분류: skipped.category, 끝남: skipped.ended, '잘못된 값': skipped.invalid })
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
    console.log(
      `[${label}] ${status} · ${seconds}초 · 받음 ${fetched} · 추가 ${inserted} · 수정 ${updated} · 그대로 ${unchanged}` +
        `${removed ? ` · 삭제 ${removed}` : ''} · 실패 ${failed}${skippedText ? ` · 건너뜀(${skippedText})` : ''}`
    );
    errorMessages.forEach((message) => console.error(`  - ${message}`));
    return result;
  } catch (err) {
    // DB 연결 끊김 등 로그조차 못 남긴 경우
    console.error(`[${label}] 실행 오류:`, err.message);
    return null;
  }
}

const succeeded = (result) => Boolean(result && !result.alreadyRunning && result.status === 'success');

module.exports = { runAndLog, succeeded };

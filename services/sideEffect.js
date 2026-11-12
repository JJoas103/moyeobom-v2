// 곁가지 작업(채팅방 · 매너 점수 · 알림) — 실패해도 본 작업은 성공으로 두고 로그만 남긴다
async function sideEffect(label, run) {
  try {
    await run();
  } catch (err) {
    console.error(`[곁가지] ${label} 실패:`, err.message);
  }
}

module.exports = { sideEffect };

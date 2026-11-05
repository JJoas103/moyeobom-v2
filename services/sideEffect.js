// 곁가지 작업 — 실패해도 본 작업(모임 만들기 · 승인 · 평가 제출 등)은 성공으로 두고 기록만 남긴다.
// 채팅방 처리 · 매너 점수 · 알림이 전부 이 성질이다. 점수를 못 줬다고 승인이 취소되면 더 나쁘다.
//
// 원래 services/meetupService.js 지역 함수였는데 reviewService · friendService 도 쓰게 되어 여기로 옮겼다.
async function sideEffect(label, run) {
  try {
    await run();
  } catch (err) {
    console.error(`[곁가지] ${label} 실패:`, err.message);
  }
}

module.exports = { sideEffect };

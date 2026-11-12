// 로그인 확인 — 401 JSON만 응답 (화면 이동은 프론트 담당)
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ success: false, authRequired: true, message: '로그인이 필요해요' });
};

/**
 * 관리자 확인 — 신고 처리 화면(/api/admin/*) 전용. isLoggedIn 뒤에 쓴다
 *
 * 비로그인(401)과 권한 없음(403)을 구분한다 — 프론트가 로그인 화면으로 보낼지(401)
 * 홈으로 되돌릴지(403) 갈라야 하기 때문이다. authRequired 를 붙이지 않는 것도 그래서다.
 * 화면 쪽 거울은 frontend/src/components/RequireAdmin.jsx 이고 판단은 여기가 단독이다
 */
const isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ success: false, message: '권한이 없어요' });
};

module.exports = { isLoggedIn, isAdmin };

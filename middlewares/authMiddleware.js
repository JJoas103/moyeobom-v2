// 로그인 확인 — 401 JSON만 응답 (화면 이동은 프론트 담당)
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ success: false, authRequired: true, message: '로그인이 필요해요' });
};

// 관리자 확인 — isLoggedIn 뒤에 쓴다. 403(권한 없음)은 401 과 달리 프론트가 홈으로 돌려보낸다
// 판단은 여기 단독, 화면 쪽 RequireAdmin.jsx 는 표시만
const isAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ success: false, message: '권한이 없어요' });
};

module.exports = { isLoggedIn, isAdmin };

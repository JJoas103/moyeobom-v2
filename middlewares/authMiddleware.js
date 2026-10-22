// 로그인 확인 — 401 JSON만 응답 (화면 이동은 프론트 담당)
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ success: false, authRequired: true, message: '로그인이 필요해요' });
};

module.exports = { isLoggedIn };

const passport = require('../config/passport');
const userService = require('../services/userService');
const { removeUploaded } = require('../middlewares/uploadMiddleware');

// 소셜 로그인은 브라우저 이동 흐름 — 끝나면 프론트(SPA)로 리다이렉트
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /api/auth/me — 비로그인도 정상 응답(user: null). 프론트 첫 세션 확인용
const me = (req, res) => {
  res.json({ success: true, user: req.isAuthenticated() ? userService.toPublicUser(req.user) : null });
};

// POST /api/auth/login { email, password }
const login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ success: false, message: info?.message || '로그인하지 못했어요' });
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.json({ success: true, user: userService.toPublicUser(user) });
    });
  })(req, res, next);
};

// POST /api/auth/logout
const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ success: true });
  });
};

// GET /api/auth/google · /api/auth/naver — 소셜 로그인 시작 (링크로 이동)
const socialStart = (strategy, options) => passport.authenticate(strategy, options);

// GET /api/auth/{google|naver}/callback
const socialCallback = (strategy) => (req, res, next) => {
  passport.authenticate(strategy, (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      if (info?.type === 'social_new') {
        // 처음 온 소셜 사용자 — 세션에 담아 두고 닉네임 입력 화면으로
        req.session.socialData = info.socialData;
        return res.redirect(`${FRONTEND_URL}/member/social-join`);
      }
      return res.redirect(`${FRONTEND_URL}/member/login?error=social`);
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.redirect(FRONTEND_URL);
    });
  })(req, res, next);
};

// GET /api/auth/social-data — 닉네임 입력 화면이 세션의 소셜 정보를 불러올 때
const socialData = (req, res) => {
  const data = req.session.socialData;
  res.json({ success: true, socialData: data ? { email: data.email, nickname: data.nickname, provider: data.provider } : null });
};

// POST /api/auth/social-join (multipart: nickname, uploadFile?)
const socialJoin = async (req, res, next) => {
  if (!req.session.socialData) {
    removeUploaded(req);
    return res.status(400).json({ success: false, message: '시간이 지나 다시 로그인해야 해요' });
  }

  try {
    const { email, provider } = req.session.socialData;
    const user = await userService.createSocialUser({
      email,
      provider,
      nickname: req.body.nickname,
      uploadFile: req.file,
    });
    delete req.session.socialData;

    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.json({ success: true, user: userService.toPublicUser(user) });
    });
  } catch (error) {
    removeUploaded(req);
    if (error.code === 'NICKNAME_DUPLICATE') {
      return res.status(400).json({ success: false, message: error.message, fieldErrors: { nickname: error.message } });
    }
    next(error);
  }
};

module.exports = { me, login, logout, socialStart, socialCallback, socialData, socialJoin };

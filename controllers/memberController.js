const userService = require('../services/userService');
const myPageService = require('../services/myPageService');
const { removeUploaded } = require('../middlewares/uploadMiddleware');

// POST /api/member/join (multipart: email, password, password2, nickname, uploadFile?)
// 가입만 처리, 로그인 안 함 — 이동은 프론트(로그인 화면)
const join = async (req, res, next) => {
  try {
    const { email, password, nickname } = req.body;
    await userService.createUser({ email, password, nickname, uploadFile: req.file });
    res.json({ success: true });
  } catch (error) {
    removeUploaded(req);
    if (error.code === 'NICKNAME_DUPLICATE') {
      return res.status(400).json({ success: false, message: error.message, fieldErrors: { nickname: error.message } });
    }
    if (error.code === 11000) {
      // email unique 인덱스 충돌 (중복확인 뒤에 누가 먼저 가입한 경우)
      const message = '이미 가입된 이메일이에요';
      return res.status(400).json({ success: false, message, fieldErrors: { email: message } });
    }
    next(error);
  }
};

// GET /api/member/check-email?email=
const checkEmail = async (req, res, next) => {
  try {
    res.json({ success: true, available: await userService.checkEmail(req.query.email) });
  } catch (error) {
    next(error);
  }
};

// GET /api/member/me → { profile, stats, praise } (마이 첫 화면)
const myPage = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await myPageService.getMyPage(req.user)) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/member/me (multipart: nickname, uploadFile?, removeImage?) → { user }
const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user, {
      nickname: req.body.nickname,
      uploadFile: req.file,
      removeImage: req.body.removeImage === 'true',
    });
    res.json({ success: true, user: userService.toPublicUser(user) });
  } catch (error) {
    removeUploaded(req);
    if (error.code === 'NICKNAME_DUPLICATE') {
      return res.status(400).json({ success: false, message: error.message, fieldErrors: { nickname: error.message } });
    }
    next(error);
  }
};

// PATCH /api/member/me/password { currentPassword, password, password2 }
const changePassword = async (req, res, next) => {
  try {
    await userService.changePassword(req.user, req.body);
    res.json({ success: true });
  } catch (error) {
    if (error.fieldErrors) return res.status(400).json({ success: false, message: error.message, fieldErrors: error.fieldErrors });
    next(error);
  }
};

// POST /api/member/withdraw { password | confirmText } — 탈퇴 후 로그아웃 · 세션 삭제
const withdraw = async (req, res, next) => {
  try {
    await myPageService.withdraw(req.user, req.body || {});
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    });
  } catch (error) {
    if (error.fieldErrors) return res.status(400).json({ success: false, message: error.message, fieldErrors: error.fieldErrors });
    next(error);
  }
};

module.exports = { join, checkEmail, myPage, updateProfile, changePassword, withdraw };

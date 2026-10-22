const userService = require('../services/userService');
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

module.exports = { join, checkEmail };

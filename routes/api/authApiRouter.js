const express = require('express');
const authController = require('../../controllers/authController');
const { uploadProfile } = require('../../config/upload');
const { handleUpload } = require('../../middlewares/uploadMiddleware');
const { socialJoinValidationRules, validate } = require('../../middlewares/validationMiddleware');

const router = express.Router();

router.get('/me', authController.me);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// 소셜 로그인 — fetch 아님, 브라우저 이동 링크로 사용
router.get('/google', authController.socialStart('google-api', { scope: ['profile', 'email'] }));
router.get('/google/callback', authController.socialCallback('google-api'));
router.get('/naver', authController.socialStart('naver-api'));
router.get('/naver/callback', authController.socialCallback('naver-api'));

// 소셜 첫 가입 — 닉네임 입력
router.get('/social-data', authController.socialData);
router.post(
  '/social-join',
  handleUpload(uploadProfile.single('uploadFile')),
  socialJoinValidationRules,
  validate,
  authController.socialJoin
);

module.exports = router;

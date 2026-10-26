const express = require('express');
const memberController = require('../../controllers/memberController');
const { uploadProfile } = require('../../config/upload');
const { handleUpload } = require('../../middlewares/uploadMiddleware');
const { isLoggedIn } = require('../../middlewares/authMiddleware');
const { joinValidationRules, profileValidationRules, passwordChangeRules, validate } = require('../../middlewares/validationMiddleware');

const router = express.Router();

router.post('/join', handleUpload(uploadProfile.single('uploadFile')), joinValidationRules, validate, memberController.join);
router.get('/check-email', memberController.checkEmail);

// 마이 — 로그인 필요
router.get('/me', isLoggedIn, memberController.myPage);
router.patch('/me', isLoggedIn, handleUpload(uploadProfile.single('uploadFile')), profileValidationRules, validate, memberController.updateProfile);
router.patch('/me/password', isLoggedIn, passwordChangeRules, validate, memberController.changePassword);
router.post('/withdraw', isLoggedIn, memberController.withdraw); // 탈퇴 — 규칙은 services/myPageService.js withdraw

module.exports = router;

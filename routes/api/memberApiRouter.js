const express = require('express');
const memberController = require('../../controllers/memberController');
const { uploadProfile } = require('../../config/upload');
const { handleUpload } = require('../../middlewares/uploadMiddleware');
const { joinValidationRules, validate } = require('../../middlewares/validationMiddleware');

const router = express.Router();

router.post('/join', handleUpload(uploadProfile.single('uploadFile')), joinValidationRules, validate, memberController.join);
router.get('/check-email', memberController.checkEmail);

// TODO(마이 화면 단계): 회원정보 수정 · 탈퇴

module.exports = router;

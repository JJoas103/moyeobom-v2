const express = require('express');
const meetupController = require('../../controllers/meetupController');
const reviewController = require('../../controllers/reviewController');
const { isLoggedIn } = require('../../middlewares/authMiddleware');
const { uploadMeetup } = require('../../config/upload');
const { handleUpload } = require('../../middlewares/uploadMiddleware');

const router = express.Router();

// 조회는 누구나 (로그인 시 내 신청 상태 · 호스트 여부 포함)
router.get('/list', meetupController.list);

// 만들기 · 수정 · 신청 · 승인은 로그인 필요 (수정 · 상태 · 승인은 호스트만)
router.post('/image', isLoggedIn, handleUpload(uploadMeetup.single('image'), 'image'), meetupController.uploadImage);
router.post('/', isLoggedIn, meetupController.create);
router.patch('/:id', isLoggedIn, meetupController.update);
router.post('/:id/status', isLoggedIn, meetupController.changeStatus);
router.post('/:id/apply', isLoggedIn, meetupController.apply);
router.post('/:id/members/:userId/approve', isLoggedIn, meetupController.approve);

// 모임 평가 — 확정 참여자만
router.get('/:id/review', isLoggedIn, reviewController.detail);
router.post('/:id/review', isLoggedIn, reviewController.submit);

router.get('/:id', meetupController.detail); // '/list' 보다 뒤

module.exports = router;

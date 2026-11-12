const express = require('express');
const notificationController = require('../../controllers/notificationController');
const { isLoggedIn } = require('../../middlewares/authMiddleware');

const router = express.Router();

// 전부 로그인 필요 — 내 알림만 본다
router.use(isLoggedIn);

// 고정 경로를 먼저 (뒤에 /:id 가 생겨도 'unread' 가 id 로 잡히지 않게)
router.get('/unread', notificationController.unread);
router.get('/', notificationController.list);
router.post('/read', notificationController.read);
router.delete('/', notificationController.clear); // 모두 지우기
router.delete('/:id', notificationController.remove); // 한 건 지우기

module.exports = router;

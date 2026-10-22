const express = require('express');
const chatController = require('../../controllers/chatController');
const { isLoggedIn } = require('../../middlewares/authMiddleware');

const router = express.Router();

// 전부 로그인 필요 (방 참여자 확인은 서비스에서)
router.use(isLoggedIn);

router.get('/rooms', chatController.rooms);
router.get('/unread', chatController.unread);
router.get('/meetup/:meetupId', chatController.meetupRoom);
router.get('/rooms/:id', chatController.room);
router.get('/rooms/:id/messages', chatController.messages);
router.post('/rooms/:id/messages', chatController.send);
router.post('/rooms/:id/read', chatController.read);
router.post('/rooms/:id/notices', chatController.pin);
router.delete('/rooms/:id/notices/:messageId', chatController.unpin);
router.post('/rooms/:id/report', chatController.report);

module.exports = router;

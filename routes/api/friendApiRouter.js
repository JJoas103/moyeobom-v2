const express = require('express');
const friendController = require('../../controllers/friendController');
const { isLoggedIn } = require('../../middlewares/authMiddleware');

const router = express.Router();

// 전부 로그인 필요
router.use(isLoggedIn);

router.get('/', friendController.list);
router.get('/requests', friendController.requests);
router.post('/links/request', friendController.sendRequests); // '/links/:id/request' 보다 앞
router.post('/links/:id/request', friendController.sendRequest);
router.post('/block', friendController.block);
router.patch('/:id/memo', friendController.memo);
router.delete('/:id', friendController.unfriend);

module.exports = router;

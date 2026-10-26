const express = require('express');
const friendController = require('../../controllers/friendController');
const { isLoggedIn } = require('../../middlewares/authMiddleware');

const router = express.Router();

// 전부 로그인 필요
router.use(isLoggedIn);

router.get('/', friendController.list);
router.post('/block', friendController.block);
router.get('/blocks', friendController.blocks);
router.delete('/blocks/:userId', friendController.unblock); // '/:id' 보다 앞
router.patch('/:id/memo', friendController.memo);
router.delete('/:id', friendController.unfriend);

module.exports = router;

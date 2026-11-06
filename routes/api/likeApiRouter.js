const express = require('express');
const likeController = require('../../controllers/likeController');
const { isLoggedIn } = require('../../middlewares/authMiddleware');

const router = express.Router();

// 전부 로그인 필요 — 내 찜만 본다
router.use(isLoggedIn);

router.get('/', likeController.list);
router.get('/ids', likeController.ids);
router.post('/:type/:id', likeController.add);
router.delete('/:type/:id', likeController.remove);

module.exports = router;

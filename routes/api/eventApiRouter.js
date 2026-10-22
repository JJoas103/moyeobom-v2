const express = require('express');
const eventController = require('../../controllers/eventController');

const router = express.Router();

// 스케줄러가 DB에 넣은 행사만 조회 (요청 때 외부 API 호출 안 함)
router.get('/list', eventController.list);
router.get('/recent-ended', eventController.recentEnded); // '/:id' 보다 먼저
router.get('/:id', eventController.detail);

module.exports = router;

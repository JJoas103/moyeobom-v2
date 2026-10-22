const express = require('express');
const nearbyController = require('../../controllers/nearbyController');

const router = express.Router();

// 스케줄러가 DB에 넣은 화장실 · 역만 조회
router.get('/', nearbyController.nearby);

module.exports = router;

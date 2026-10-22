const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// GET /api/health — 프론트가 백엔드·DB 연결을 확인하는 용도
router.get('/', (req, res) => {
  res.json({
    success: true,
    server: 'ok',
    db: DB_STATES[mongoose.connection.readyState] || 'unknown',
    time: new Date().toISOString(),
  });
});

module.exports = router;

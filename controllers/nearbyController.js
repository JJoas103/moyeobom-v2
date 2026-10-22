const nearbyService = require('../services/nearbyService');

// GET /api/nearby?lat=37.58&lng=127.00 — 좌표 근처 화장실 · 지하철역
const nearby = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const valid = Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
    if (!valid) return res.status(400).json({ success: false, message: '좌표 값이 올바르지 않습니다' });

    const { toilets, stations } = await nearbyService.findNearby({ lat, lng });
    res.json({ success: true, toilets, stations });
  } catch (err) {
    next(err);
  }
};

module.exports = { nearby };

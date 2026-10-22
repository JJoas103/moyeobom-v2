const reviewService = require('../services/reviewService');

// GET /api/meetup/:id/review — 확정 참여자만
const detail = async (req, res, next) => {
  try {
    res.json({ success: true, review: await reviewService.getReview(req.params.id, req.user._id) });
  } catch (err) {
    next(err);
  }
};

// POST /api/meetup/:id/review { praised: [userId], again: [userId] } → { praisedCount, againCount }
const submit = async (req, res, next) => {
  try {
    res.status(201).json({ success: true, result: await reviewService.submitReview(req.params.id, req.user._id, req.body) });
  } catch (err) {
    next(err);
  }
};

module.exports = { detail, submit };

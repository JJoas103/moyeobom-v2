const friendService = require('../services/friendService');

// 서비스가 던진 { status, fieldErrors } 를 응답으로
const sendError = (res, next, err) => {
  if (err.fieldErrors) return res.status(400).json({ success: false, message: err.message, fieldErrors: err.fieldErrors });
  next(err);
};

// GET /api/friends → { friends }
const list = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await friendService.listFriends(req.user._id)) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/friends/:id/memo { memo }
const memo = async (req, res, next) => {
  try {
    res.json({ success: true, memo: await friendService.setMemo(req.params.id, req.user._id, req.body?.memo) });
  } catch (err) {
    sendError(res, next, err);
  }
};

// DELETE /api/friends/:id — 친구 끊기
const unfriend = async (req, res, next) => {
  try {
    await friendService.unfriend(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/friends/block { userId }
const block = async (req, res, next) => {
  try {
    await friendService.block(req.user._id, req.body?.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/friends/blocks → { blocks }
const blocks = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await friendService.listBlocks(req.user._id)) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/friends/blocks/:userId — 차단 풀기
const unblock = async (req, res, next) => {
  try {
    await friendService.unblock(req.user._id, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, memo, unfriend, block, blocks, unblock };

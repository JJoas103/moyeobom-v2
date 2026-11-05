const likeService = require('../services/likeService');

// 컨트롤러 공통 — 서비스 결과를 { success: true, ...data } 로 (controllers/chatController.js 와 같은 모양)
const handle = (run) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await run(req)) });
  } catch (err) {
    next(err);
  }
};

const me = (req) => req.user._id;

module.exports = {
  // GET /api/likes → { events, meetups }
  list: handle((req) => likeService.listLikes(me(req))),
  // GET /api/likes/ids → { events: [_id], meetups: [_id] }
  ids: handle((req) => likeService.listLikeIds(me(req))),
  // POST /api/likes/:type/:id — type: event | meetup
  add: handle(async (req) => {
    await likeService.addLike(me(req), req.params.type, req.params.id);
    return {};
  }),
  // DELETE /api/likes/:type/:id
  remove: handle(async (req) => {
    await likeService.removeLike(me(req), req.params.type, req.params.id);
    return {};
  }),
};

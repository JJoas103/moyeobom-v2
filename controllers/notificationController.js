const notificationService = require('../services/notificationService');

// 컨트롤러 공통 — 서비스 결과를 { success: true, ...data } 로
const handle = (run) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await run(req)) });
  } catch (err) {
    next(err);
  }
};

const me = (req) => req.user._id;

module.exports = {
  // GET /api/notification?limit= → { notifications }
  list: handle((req) => notificationService.listNotifications(me(req), req.query.limit)),
  // GET /api/notification/unread → { count }
  unread: handle((req) => notificationService.unreadCount(me(req))),
  // POST /api/notification/read { ids? } → { read } — ids 가 없으면 전부 읽음
  read: handle((req) => notificationService.markRead(me(req), req.body?.ids)),
  // DELETE /api/notification → { cleared } — 내 알림 전부 지우기
  clear: handle((req) => notificationService.clearAll(me(req))),
  // DELETE /api/notification/:id → { removed } — 한 건 지우기
  remove: handle((req) => notificationService.removeOne(me(req), req.params.id)),
};

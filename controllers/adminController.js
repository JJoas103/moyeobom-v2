const adminService = require('../services/adminService');

// 컨트롤러 공통 — 서비스 결과를 { success: true, ...data } 로 (controllers/notificationController.js 와 같은 모양)
const handle = (run) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await run(req)) });
  } catch (err) {
    next(err);
  }
};

const me = (req) => req.user._id;

module.exports = {
  // GET /api/admin/reports?status=&page=&limit= → { reports, total, counts, page, limit }
  listReports: handle((req) => adminService.listReports(req.query)),
  // GET /api/admin/reports/:id → { report }
  getReport: handle((req) => adminService.getReport(req.params.id)),
  // POST /api/admin/reports/:id/resolve { action: 'accept'(제재) | 'reject'(기각), note? } → { report }
  resolveReport: handle((req) => adminService.resolveReport(req.params.id, me(req), req.body?.action, req.body?.note)),
  // POST /api/admin/reports/:id/revert { note? } → { report } — 제재를 취소한다
  revertReport: handle((req) => adminService.revertReport(req.params.id, me(req), req.body?.note)),
  // POST /api/admin/reports/:id/appeal { action: 'accept'(무효처리) | 'reject'(이의 기각), reply? } → { report }
  decideAppeal: handle((req) => adminService.decideAppeal(req.params.id, me(req), req.body?.action, req.body?.reply)),

  // GET /api/admin/members?q=&sort=&page=&limit= → { members, total, page, limit }
  listMembers: handle((req) => adminService.listMembers(req.query)),
  // GET /api/admin/members/:id → { member, manner, reports, meetups }
  getMember: handle((req) => adminService.getMember(req.params.id)),
};

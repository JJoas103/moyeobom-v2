const appealService = require('../services/appealService');

// 이의제기 — 제재당한 당사자용 (controllers/adminController.js 의 handle 과 같은 모양)
const handle = (run) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await run(req)) });
  } catch (err) {
    next(err);
  }
};

const me = (req) => req.user._id;

module.exports = {
  // GET /api/member/appeals → { sanctions } — 내가 받은 제재와 이의 상태
  listMine: handle((req) => appealService.listMine(me(req))),
  // POST /api/member/appeals/:reportId { text } → { appeal } — 제재 1건당 한 번
  submit: handle((req) => appealService.submit(me(req), req.params.reportId, req.body?.text)),
};

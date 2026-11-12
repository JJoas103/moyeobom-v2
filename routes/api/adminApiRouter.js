const express = require('express');
const adminController = require('../../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../../middlewares/authMiddleware');

const router = express.Router();

// 전부 관리자 전용 — 라우터 입구에서 한 번만 막는다. 개별 핸들러에 다시 걸지 않는다
// (한 곳에서 막으면 새 엔드포인트를 더할 때 빠뜨릴 자리가 없다)
router.use(isLoggedIn, isAdmin);

router.get('/reports', adminController.listReports);
router.get('/reports/:id', adminController.getReport);
router.post('/reports/:id/resolve', adminController.resolveReport); // 제재 · 기각
router.post('/reports/:id/revert', adminController.revertReport); // 제재 취소
router.post('/reports/:id/appeal', adminController.decideAppeal); // 이의제기 — 무효처리 · 이의 기각

router.get('/members', adminController.listMembers);
router.get('/members/:id', adminController.getMember);

module.exports = router;

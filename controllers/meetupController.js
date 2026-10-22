const meetupService = require('../services/meetupService');

const PERIODS = ['', 'today', 'week', 'weekend', 'month'];

// 쿼리 값은 전부 문자열 — 'true' · '1' 만 참
const toBool = (v) => v === 'true' || v === '1';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const viewerOf = (req) => (req.isAuthenticated() ? req.user._id : null);

// 서비스가 던진 { status, fieldErrors } 를 응답으로
const sendError = (res, next, err) => {
  if (err.fieldErrors) return res.status(400).json({ success: false, message: err.message, fieldErrors: err.fieldErrors });
  next(err);
};

// GET /api/meetup/list?eventId=&category=&district=&period=&joinType=&alcohol=&budget=&q=&openOnly=&includePast=
const list = async (req, res, next) => {
  try {
    const { query } = req;
    const period = str(query.period);
    if (!PERIODS.includes(period)) return res.status(400).json({ success: false, message: '기간 값이 올바르지 않습니다' });

    const meetups = await meetupService.listMeetups(
      {
        eventId: str(query.eventId),
        category: str(query.category),
        district: str(query.district),
        period,
        joinType: str(query.joinType),
        alcohol: str(query.alcohol),
        budget: str(query.budget),
        q: str(query.q),
        openOnly: toBool(query.openOnly),
        includePast: toBool(query.includePast),
      },
      viewerOf(req)
    );
    res.json({ success: true, meetups });
  } catch (err) {
    next(err);
  }
};

// GET /api/meetup/:id
const detail = async (req, res, next) => {
  try {
    res.json({ success: true, meetup: await meetupService.getMeetup(req.params.id, viewerOf(req)) });
  } catch (err) {
    next(err);
  }
};

// POST /api/meetup/image (multipart: image) → { imageUrl: '/images/upload/파일' }
const uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '사진을 골라 주세요', fieldErrors: { image: '사진을 골라 주세요' } });
  res.json({ success: true, imageUrl: `/images/upload/${req.file.filename}` });
};

// POST /api/meetup — body 는 Meetup 스키마 필드 (event, title, intro, imageUrl, talk, alcohol, budget, capacity, watch)
const create = async (req, res, next) => {
  try {
    const meetup = await meetupService.createMeetup(req.body, req.user._id);
    res.status(201).json({ success: true, meetup });
  } catch (err) {
    sendError(res, next, err);
  }
};

// PATCH /api/meetup/:id — 호스트만. body 는 만들기와 같음 (event 는 무시)
const update = async (req, res, next) => {
  try {
    const meetup = await meetupService.updateMeetup(req.params.id, req.user._id, req.body);
    res.json({ success: true, meetup });
  } catch (err) {
    sendError(res, next, err);
  }
};

// POST /api/meetup/:id/status { status: 'open'|'closed'|'cancelled' } — 호스트만
const changeStatus = async (req, res, next) => {
  try {
    const meetup = await meetupService.setMeetupStatus(req.params.id, req.user._id, req.body?.status);
    res.json({ success: true, meetup });
  } catch (err) {
    next(err);
  }
};

// POST /api/meetup/:id/apply { joinType }
const apply = async (req, res, next) => {
  try {
    const member = await meetupService.applyMeetup(req.params.id, req.user._id, req.body?.joinType);
    res.json({ success: true, member });
  } catch (err) {
    next(err);
  }
};

// POST /api/meetup/:id/members/:userId/approve — 호스트만
const approve = async (req, res, next) => {
  try {
    const meetup = await meetupService.approveMember(req.params.id, req.user._id, req.params.userId);
    res.json({ success: true, meetup });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, uploadImage, create, update, changeStatus, apply, approve };

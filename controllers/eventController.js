const eventService = require('../services/eventService');
const recommendService = require('../services/recommendService');

const PERIODS = ['', 'today', 'week', 'weekend', 'month'];
const SORTS = ['meetups', 'endingSoon'];

// 쿼리 값은 전부 문자열 — 'true' · '1' 만 참
const toBool = (v) => v === 'true' || v === '1';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
// 숫자가 아니면 undefined 로 넘겨 서비스 기본값(page 1 · limit 15)을 쓰게 한다
const num = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

// GET /api/event/list?category=&genre=&district=&period=&from=&to=&q=&hasMeetup=&includeEnded=&sort=&page=&limit=
//   → { events, total, genres } — 한 페이지씩. limit 기본 15 · 상한 50 은 eventService 가 정리한다
const list = async (req, res, next) => {
  try {
    const { query } = req;
    const period = str(query.period);
    const from = str(query.from);
    const to = str(query.to);
    const sort = str(query.sort) || 'endingSoon'; // 기본은 곧 끝나는 순 ($limit 을 모임 수 집계 앞에 둘 수 있다)
    if (!PERIODS.includes(period)) return res.status(400).json({ success: false, message: '기간 값이 올바르지 않습니다' });
    if (!eventService.isValidDayRange(from, to)) return res.status(400).json({ success: false, message: '날짜 값이 올바르지 않습니다' });
    if (!SORTS.includes(sort)) return res.status(400).json({ success: false, message: '정렬 값이 올바르지 않습니다' });

    const result = await eventService.listEvents({
      category: str(query.category),
      genre: str(query.genre),
      district: str(query.district),
      period,
      from,
      to,
      q: str(query.q),
      hasMeetup: toBool(query.hasMeetup),
      includeEnded: toBool(query.includeEnded),
      sort,
      page: num(query.page),
      limit: num(query.limit),
    });
    res.json({ success: true, ...result }); // { events, total, genres }
  } catch (err) {
    next(err);
  }
};

// GET /api/event/recent-ended
const recentEnded = async (req, res, next) => {
  try {
    const events = await eventService.listRecentEndedEvents();
    res.json({ success: true, events });
  } catch (err) {
    next(err);
  }
};

const viewerOf = (req) => (req.isAuthenticated() ? req.user : null);

// GET /api/event/recommended → { event, reasons, basis }
const recommended = async (req, res, next) => {
  try {
    res.json({ success: true, ...(await recommendService.recommendEvent(viewerOf(req))) });
  } catch (err) {
    next(err);
  }
};

// GET /api/event/:id
const detail = async (req, res, next) => {
  try {
    const event = await eventService.getEvent(req.params.id);
    event.recommendReasons = await recommendService.reasonsForEvent(event, viewerOf(req));
    res.json({ success: true, event });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, recentEnded, recommended, detail };

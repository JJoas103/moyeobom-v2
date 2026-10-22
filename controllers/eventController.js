const eventService = require('../services/eventService');

const PERIODS = ['', 'today', 'week', 'weekend', 'month'];
const SORTS = ['meetups', 'endingSoon'];

// 쿼리 값은 전부 문자열 — 'true' · '1' 만 참
const toBool = (v) => v === 'true' || v === '1';
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// GET /api/event/list?category=&genre=&district=&period=&q=&hasMeetup=&includeEnded=&sort=
const list = async (req, res, next) => {
  try {
    const { query } = req;
    const period = str(query.period);
    const sort = str(query.sort) || 'meetups';
    if (!PERIODS.includes(period)) return res.status(400).json({ success: false, message: '기간 값이 올바르지 않습니다' });
    if (!SORTS.includes(sort)) return res.status(400).json({ success: false, message: '정렬 값이 올바르지 않습니다' });

    const events = await eventService.listEvents({
      category: str(query.category),
      genre: str(query.genre),
      district: str(query.district),
      period,
      q: str(query.q),
      hasMeetup: toBool(query.hasMeetup),
      includeEnded: toBool(query.includeEnded),
      sort,
    });
    res.json({ success: true, events });
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

// GET /api/event/:id
const detail = async (req, res, next) => {
  try {
    const event = await eventService.getEvent(req.params.id);
    res.json({ success: true, event });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, recentEnded, detail };

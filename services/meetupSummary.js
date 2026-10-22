const Meetup = require('../models/Meetup');
const Event = require('../models/Event');

// 채팅방 · 친구 카드 · 평가 화면에 붙는 작은 모임 정보 ('커튼콜 끝나고 넘버 얘기해요 · 여름밤의 정원 · 09.30')
//   { _id, title, imageUrl, talk: { startAt, area }, capacity, event: { _id, title, posterUrl, category, venue, area } }

function meetupSummary(meetup, events) {
  if (!meetup) return null;
  const event = events.get(String(meetup.event));
  return {
    _id: String(meetup._id),
    title: meetup.title,
    imageUrl: meetup.imageUrl || '',
    talk: { startAt: meetup.talk.startAt, area: meetup.talk.area },
    capacity: meetup.capacity,
    event: event
      ? {
          _id: String(event._id),
          title: event.title,
          posterUrl: event.posterUrl || '',
          category: event.category,
          venue: event.venue || '',
          area: event.area || '',
        }
      : null,
  };
}

/** 모임 문서들의 행사 → Map */
async function loadEvents(meetups) {
  const events = await Event.find(
    { _id: { $in: meetups.map((m) => m.event) } },
    { title: 1, posterUrl: 1, category: 1, venue: 1, area: 1 }
  ).lean();
  return new Map(events.map((e) => [String(e._id), e]));
}

/** 모임 id 목록 → Map(id → 요약) */
async function summarizeMeetups(ids) {
  const meetups = await Meetup.find({ _id: { $in: [...new Set(ids.map(String))] } }, { title: 1, event: 1, talk: 1, imageUrl: 1, capacity: 1 }).lean();
  const events = await loadEvents(meetups);
  return new Map(meetups.map((m) => [String(m._id), meetupSummary(m, events)]));
}

module.exports = { meetupSummary, loadEvents, summarizeMeetups };

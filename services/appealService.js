const mongoose = require('mongoose');
const Report = require('../models/Report');
const { APPEAL_MAX } = require('../models/Report');
const ChatRoom = require('../models/ChatRoom');
const Meetup = require('../models/Meetup');

// 이의제기 — **제재당한 당사자용.** 관리자가 보는 쪽은 services/adminService.js 다.
//
// ★ 왜 있나: 제재(-7)는 **사람이 판단한 유일한 처분**이라 오판 비용이 가장 크다.
//   되돌리는 길이 관리자의 자각뿐이면 당사자는 아무것도 할 수 없다. 창구를 둔다.
//
// ★★ **제재 1건당 한 번.** `appeal.at` 이 있으면 두 번째 제출을 막는다. 재심을 열면
//   같은 글을 반복해 읽게 되고, 한 번뿐이라는 걸 알아야 사람이 제대로 쓴다.
//
// 신고 내용(누가 무엇을 신고했는지)은 **내려주지 않는다** — 신고자를 역추적할 여지를 만들지 않는다.
// 당사자가 아는 것은 '어느 모임에서 제재를 받았다' 와 '언제' 까지다.

const httpError = (status, message) => Object.assign(new Error(message), { status });
const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** 화면에 내려주는 모양 — 신고자 · 이유 · 증거는 뺀다 */
const appealRow = (doc, meetupTitle) => ({
  _id: String(doc._id),
  meetupTitle: meetupTitle || '',
  sanctionedAt: doc.resolvedAt || doc.createdAt,
  canAppeal: !doc.appeal?.at, // 아직 안 냈으면 쓸 수 있다
  appeal: doc.appeal?.at
    ? {
        text: doc.appeal.text || '',
        at: doc.appeal.at,
        status: doc.appeal.status, // open · accepted · rejected
        reply: doc.appeal.reply || '',
        decidedAt: doc.appeal.decidedAt || null,
      }
    : null,
});

/**
 * 내가 받은 제재 목록 — 이의를 낼 수 있는 것 · 이미 낸 것
 * 취소된 제재(`reverted`)는 뺀다 — 이미 풀렸으니 이의를 낼 이유가 없다
 */
async function listMine(userId) {
  const docs = await Report.find(
    { target: oid(userId), status: 'accepted' },
    { room: 1, resolvedAt: 1, createdAt: 1, appeal: 1 }
  )
    .sort({ resolvedAt: -1 })
    .lean();
  if (!docs.length) return { sanctions: [] };

  // 모임 제목만 붙인다 (어느 자리였는지 알아야 사정을 쓸 수 있다)
  const rooms = await ChatRoom.find({ _id: { $in: docs.map((d) => d.room) } }, { meetup: 1 }).lean();
  const roomMap = new Map(rooms.map((r) => [String(r._id), r.meetup]));
  const meetups = await Meetup.find({ _id: { $in: [...roomMap.values()].filter(Boolean) } }, { title: 1 }).lean();
  const titleOf = new Map(meetups.map((m) => [String(m._id), m.title]));

  return { sanctions: docs.map((d) => appealRow(d, titleOf.get(String(roomMap.get(String(d.room)))))) };
}

/** 이의제기 제출 — 본인이 대상인 제재 건에만, 한 번만 */
async function submit(userId, reportId, text) {
  if (!mongoose.isValidObjectId(reportId)) throw httpError(404, '제재를 찾을 수 없습니다');
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) throw httpError(400, '어떤 사정이었는지 적어 주세요');
  if (body.length > APPEAL_MAX) throw httpError(400, `${APPEAL_MAX}자까지 적을 수 있어요`);

  // 조건을 전부 쿼리에 넣는다 — 읽고 나서 쓰면 두 번 눌렀을 때 둘 다 통과한다.
  // `appeal.at` 이 없는 문서만 집어야 '한 번만' 이 지켜진다
  const doc = await Report.findOneAndUpdate(
    { _id: oid(reportId), target: oid(userId), status: 'accepted', 'appeal.at': { $exists: false } },
    { $set: { appeal: { text: body, at: new Date(), status: 'open' } } },
    { new: true, projection: { appeal: 1 } }
  ).lean();

  if (!doc) {
    // 왜 안 되는지 갈라 말한다 — '안 돼요' 하나로는 본인이 무엇을 할지 알 수 없다
    const found = await Report.findOne({ _id: oid(reportId), target: oid(userId) }, { status: 1, appeal: 1 }).lean();
    if (!found) throw httpError(404, '제재를 찾을 수 없습니다');
    if (found.appeal?.at) throw httpError(400, '이미 이의제기를 냈어요. 한 번만 낼 수 있어요');
    throw httpError(400, '지금은 이의제기를 낼 수 없는 제재예요');
  }
  return { appeal: { text: body, at: doc.appeal.at, status: 'open', reply: '', decidedAt: null } };
}

module.exports = { listMine, submit, APPEAL_MAX };

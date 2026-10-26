const mongoose = require('mongoose');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const Friendship = require('../models/Friendship');
const userService = require('./userService');
const friendService = require('./friendService');
const { reviewWindow } = require('./socialRules');
const { summarizeMeetups } = require('./meetupSummary');

// 마이 — 응답 모양은 frontend/src/data/member.js 맨 위 주석 기준
//   참여한 모임: 내가 연 모임 + 승인된 모임 (취소 제외, 신청 중 제외)
//   받은 칭찬: 평가가 마감된 모임만 · 누가 칭찬했는지는 내려주지 않음 (매너 점수는 미결정이라 횟수만)

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const WITHDRAW_TEXT = '탈퇴'; // 소셜 가입자 탈퇴 확인 문구

const participantCount = (meetup) => 1 + (meetup.members || []).filter((m) => m.status === 'approved').length;

/** 받은 칭찬 → { total, meetups: [{ meetup(작은 요약), praisedCount, othersCount }] } 최근 모임 순 */
async function receivedPraise(userId, now = new Date()) {
  const counts = await Review.aggregate([
    { $match: { praised: oid(userId) } },
    { $group: { _id: '$meetup', praisedCount: { $sum: 1 } } },
  ]);
  if (counts.length === 0) return { total: 0, meetups: [] };

  const docs = await Meetup.find({ _id: { $in: counts.map((c) => c._id) }, status: { $ne: 'cancelled' } }, { talk: 1, members: 1 }).lean();
  const closed = docs.filter((m) => reviewWindow(m.talk.startAt).closesAt <= now);
  const summaries = await summarizeMeetups(closed.map((m) => m._id));
  const countMap = new Map(counts.map((c) => [String(c._id), c.praisedCount]));

  const meetups = closed
    .sort((a, b) => new Date(b.talk.startAt) - new Date(a.talk.startAt))
    .map((m) => ({
      meetup: summaries.get(String(m._id)),
      praisedCount: countMap.get(String(m._id)),
      othersCount: participantCount(m) - 1, // 나를 평가할 수 있었던 사람 수
    }));
  return { total: meetups.reduce((sum, m) => sum + m.praisedCount, 0), meetups };
}

/** 아직 안 끝난 모임 수 — 탈퇴 막는 조건 { hosted(내가 연), joined(신청 중 · 승인) } */
async function upcomingMeetups(userId, now = new Date()) {
  const me = oid(userId);
  const base = { status: { $ne: 'cancelled' }, 'talk.startAt': { $gt: now } };
  const [hosted, joined] = await Promise.all([
    Meetup.countDocuments({ ...base, host: me }),
    Meetup.countDocuments({ ...base, 'members.user': me }),
  ]);
  return { hosted, joined };
}

/**
 * 회원 탈퇴 — 다가오는 연 모임 · 참여 모임이 있으면 막음. 확인: 이메일 가입자는 비밀번호, 소셜은 '탈퇴' 입력
 * 지우는 것: 회원 · 프로필 사진 · 친구(1:1 방 닫힘) · 요청 자리 · 차단 기록
 * 남는 것: 지난 모임 · 평가 · 채팅 메시지 (화면엔 '알 수 없음' · 호스트 이름 없음으로 보임)
 */
async function withdraw(user, { password, confirmText }) {
  const upcoming = await upcomingMeetups(user._id);
  if (upcoming.hosted || upcoming.joined) {
    throw Object.assign(new Error('다가오는 모임을 먼저 정리해 주세요'), { status: 400 });
  }
  if (user.provider === 'local') {
    if (!(await userService.verifyPassword(user, password || ''))) {
      throw Object.assign(new Error('비밀번호가 맞지 않아요'), { fieldErrors: { password: '비밀번호가 맞지 않아요' } });
    }
  } else if (String(confirmText || '').trim() !== WITHDRAW_TEXT) {
    throw Object.assign(new Error(`'${WITHDRAW_TEXT}'를 적어 주세요`), { fieldErrors: { confirmText: `'${WITHDRAW_TEXT}'를 적어 주세요` } });
  }

  await friendService.removeUser(user._id);
  await userService.deleteUser(user);
}

/** 마이 첫 화면 — 프로필 · 숫자 · 받은 칭찬 · 다가오는 모임 수(탈퇴 안내) */
async function getMyPage(user) {
  const me = oid(user._id);
  const [meetupCount, friendCount, praise, upcoming] = await Promise.all([
    Meetup.countDocuments({
      status: { $ne: 'cancelled' },
      $or: [{ host: me }, { members: { $elemMatch: { user: me, status: 'approved' } } }],
    }),
    Friendship.countDocuments({ $or: [{ userA: me }, { userB: me }] }),
    receivedPraise(user._id),
    upcomingMeetups(user._id),
  ]);

  return {
    profile: { ...userService.toPublicUser(user), createdAt: user.createdAt },
    stats: { meetupCount, friendCount, praiseCount: praise.total },
    praise,
    upcoming,
  };
}

module.exports = { WITHDRAW_TEXT, getMyPage, receivedPraise, withdraw };

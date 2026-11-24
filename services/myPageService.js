const mongoose = require('mongoose');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const Friendship = require('../models/Friendship');
const userService = require('./userService');
const friendService = require('./friendService');
const likeService = require('./likeService');
const mannerService = require('./mannerService');
const { reviewWindow } = require('./socialRules');

// 마이 — 응답 모양은 frontend/src/data/member.js 맨 위 주석 기준
//   참여한 모임: 내가 연 모임 + 승인된 모임 (취소 제외, 신청 중 제외)
//   받은 칭찬: 평가가 마감된 모임만, 횟수만 (평가자 비공개). 분모는 실제로 평가를 낸 사람 수
//     '아쉬웠어요'는 내려주지 않는다 — 점수가 움직였으면 매너 이력에 남는다
//   매너 점수: 점수 + 변동 이력

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const WITHDRAW_TEXT = '탈퇴'; // 소셜 가입자 탈퇴 확인 문구

/**
 * 받은 '좋았어요' 건수 — 프로필 카드의 `좋은 평가` 타일과 탭 배지에 쓰는 숫자 하나.
 *
 * 모임별 목록도 같이 내려 줬는데 2026-11-18 에 걷어냈다 — 마이페이지에서 그 목록이 바로 위
 * 매너 이력과 모임 제목 · 날짜 · 건수 · 링크까지 겹쳤다 (`PraiseTab.jsx` 머리말).
 * ⚠ **마감 · 취소 필터는 그대로 둔다.** `Review.countDocuments({ praised: me })` 한 줄로 바꾸면
 *   아직 평가 기간이 열려 있는 모임까지 세어 화면의 숫자가 조용히 커진다.
 */
async function countPraise(userId, now = new Date()) {
  const me = oid(userId);
  const counts = await Review.aggregate([
    { $match: { praised: me } },
    { $group: { _id: '$meetup', praisedCount: { $sum: 1 } } },
  ]);
  if (counts.length === 0) return 0;

  const docs = await Meetup.find(
    { _id: { $in: counts.map((c) => c._id) }, status: { $ne: 'cancelled' } },
    { talk: 1 }
  ).lean();
  const closed = new Set(
    docs.filter((m) => reviewWindow(m.talk.startAt).closesAt <= now).map((m) => String(m._id))
  );
  return counts.reduce((sum, c) => (closed.has(String(c._id)) ? sum + c.praisedCount : sum), 0);
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
 * 지우는 것: 회원 · 프로필 사진 · 친구(1:1 방 닫힘) · 요청 자리 · 차단 기록 · 찜
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
  await likeService.removeUser(user._id);
  await userService.deleteUser(user);
}

/** 마이 첫 화면 — 프로필 · 숫자 · 다가오는 모임 수(탈퇴 안내) · 매너 점수와 이력 */
async function getMyPage(user) {
  const me = oid(user._id);
  const [meetupCount, friendCount, praiseCount, upcoming, mannerLog] = await Promise.all([
    Meetup.countDocuments({
      status: { $ne: 'cancelled' },
      $or: [{ host: me }, { members: { $elemMatch: { user: me, status: 'approved' } } }],
    }),
    Friendship.countDocuments({ $or: [{ userA: me }, { userB: me }] }),
    countPraise(user._id),
    upcomingMeetups(user._id),
    mannerService.listLog(user._id),
  ]);

  return {
    profile: { ...userService.toPublicUser(user), createdAt: user.createdAt },
    stats: { meetupCount, friendCount, praiseCount },
    upcoming,
    manner: {
      score: mannerService.scoreOf(user),
      base: mannerService.BASE, // 이력이 없을 때 '50점에서 시작한 그대로예요' 에 쓴다
      log: mannerLog,
      rules: mannerService.SCORES, // '이렇게 움직여요' 표 — 정책을 화면에 그대로 띄운다
    },
  };
}

module.exports = { WITHDRAW_TEXT, getMyPage, withdraw };

const { MANNER_BASE } = require('../models/User');

// 매너 점수를 함께 싣는 사용자 모양 — meetupService · friendService 만 쓴다
// reviewService(점수를 보고 평가하게 됨) · chatService 는 점수 없는 로컬 publicUser 를 쓴다
// ⚠ 조회 select 에 PUBLIC_USER_FIELDS 를 써야 한다 — manner 가 빠지면 전원 50점으로 조용히 나간다
const PUBLIC_USER_FIELDS = { nickname: 1, profileImage: 1, manner: 1 };

/** 탈퇴한 사람(문서 없음)은 null — 화면마다 '알 수 없음' 처리를 따로 한다 */
const publicUser = (user) =>
  user
    ? {
        _id: String(user._id),
        nickname: user.nickname,
        profileImage: user.profileImage || '',
        manner: { score: user.manner?.score ?? MANNER_BASE },
      }
    : null;

/** 탈퇴자 자리를 채워야 하는 화면(채팅)용 */
const unknownUser = (id) => ({
  _id: String(id),
  nickname: '알 수 없음',
  profileImage: '',
  manner: { score: MANNER_BASE },
});

module.exports = { publicUser, unknownUser, PUBLIC_USER_FIELDS };

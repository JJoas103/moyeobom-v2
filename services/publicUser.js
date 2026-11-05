const { MANNER_BASE } = require('../models/User');

// 매너 점수를 함께 보여주는 사용자 모양 — 한 곳에서만 만든다.
//
// 쓰는 곳: meetupService(모임 상세 호스트 · 참여자) · friendService(친구 목록).
// 쓰지 않는 곳(정책):
//   · reviewService — 평가 화면에 점수를 띄우면 점수를 보고 칭찬을 고르게 된다
//   · chatService  — 채팅은 노출 범위가 아니다
//   두 곳은 점수 없는 로컬 publicUser 를 그대로 둔다 (각 파일 주석 참고)
//
// 따로 고치면 한 곳만 빠뜨려도 그 화면에서만 점수가 안 보이고, 그게
// "왜 이 사람은 점수가 없지?"라는 설명 불가능한 상태를 만든다. 그래서 모양과 select 를 함께 내보낸다.
//
// ⚠ 짝이 되는 조회에 PUBLIC_USER_FIELDS 를 써야 한다. select 에서 manner 가 빠지면
//   점수가 전원 기본값(50)으로 조용히 나간다 — 틀린 값이 나가는 쪽이 제일 위험하다
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

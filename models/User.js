const mongoose = require('mongoose');
const { CATEGORIES } = require('./Event');

// 회원 — 로컬(이메일 · 비밀번호) 또는 소셜(구글 · 네이버). v1 과 users 컬렉션을 같이 쓴다
// manner.score 는 mannerService 만 바꾼다 — 근거는 MannerLog (점수 = 50 + Σ scoreChange)

// 취향 = 행사 카테고리 키. 라벨은 frontend/src/data/constants.js CATEGORIES
const TASTES = CATEGORIES;
const DISTRICT_MAX = 3; // 관심 지역 최대 개수
const MANNER_BASE = 50; // 매너 점수 시작값 (services/mannerService.js 와 같이)
// 역할 — 신고 처리 화면(/admin)에 들어갈 수 있는지. 승격은 npm run admin:grant 한 곳에서만
const ROLES = ['user', 'admin'];
const SEOUL_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구',
  '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구',
  '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String }, // bcrypt 해시. 소셜 가입자는 없음
    nickname: { type: String, required: true, unique: true, trim: true },
    profileImage: { type: String, default: '' }, // public/images/profile 파일 이름. 없으면 기본 아바타
    provider: { type: String, enum: ['local', 'google', 'naver'], default: 'local' },
    role: { type: String, enum: ROLES, default: 'user' }, // 화면에서 바꾸지 않는다 — 승격은 scripts/grantAdmin.js 만
    tastes: { type: [{ type: String, enum: TASTES }], default: [] }, // 가입 때 고르고 마이에서 수정. 기존 회원은 비어 있을 수 있음
    districts: { type: [{ type: String, enum: SEOUL_DISTRICTS }], default: [] }, // 관심 지역 (선택)
    manner: {
      score: { type: Number, default: MANNER_BASE }, // 가입 직후부터 이 값으로 보인다 (숨기지 않음)
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.TASTES = TASTES;
module.exports.DISTRICT_MAX = DISTRICT_MAX;
module.exports.SEOUL_DISTRICTS = SEOUL_DISTRICTS;
module.exports.MANNER_BASE = MANNER_BASE;
module.exports.ROLES = ROLES;

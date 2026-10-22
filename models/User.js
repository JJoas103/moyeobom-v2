const mongoose = require('mongoose');

// 회원 — 로컬(이메일·비밀번호) 또는 소셜(구글·네이버) 가입
// v1(모여봄) User 에서 v2에 없는 기능 필드 제외 (혼잡도 알림 · 매너 점수 · 이모지 아바타 등)
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String }, // bcrypt 해시. 소셜 가입자는 없음
    nickname: { type: String, required: true, unique: true, trim: true },
    profileImage: { type: String, default: '' }, // public/images/profile 파일 이름. 없으면 기본 아바타
    provider: { type: String, enum: ['local', 'google', 'naver'], default: 'local' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

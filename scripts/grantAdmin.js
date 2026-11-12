// 관리자 승격 · 해제: npm run admin:grant -- <이메일> [--revoke]
//
// 관리자 역할을 바꾸는 유일한 수단이다 — 화면에는 두지 않았다. 관리자가 관리자를 임명할 수 있으면
// 한 계정이 털렸을 때 되돌릴 방법이 없고, 신고 인정(-7)은 사람이 판단한 유일한 감점이라
// 그 권한이 번지는 일이 가장 비싸다.
//
// ⚠ users 컬렉션은 v1(Moyeobom)과 공유한다 — 이메일이 반드시 v2 회원이라는 보장이 없다.
//   찾은 계정의 닉네임 · 가입 방식을 찍어 주니 승격 전에 눈으로 확인할 것.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

  if (!email) {
    console.error('이메일이 필요해요 — npm run admin:grant -- someone@example.com [--revoke]');
    process.exit(1);
  }

  await connectDB();

  const role = revoke ? 'user' : 'admin';
  const before = await User.findOne({ email }, { email: 1, nickname: 1, provider: 1, role: 1 }).lean();
  if (!before) {
    console.error(`${email} 계정을 찾지 못했어요`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`대상: ${before.nickname} <${before.email}> · ${before.provider} 가입 · 지금 ${before.role || 'user'}`);

  if ((before.role || 'user') === role) {
    console.log(`이미 ${role} 이라 바꾸지 않았어요`);
  } else {
    await User.updateOne({ _id: before._id }, { $set: { role } });
    console.log(`${before.nickname} → ${role} 로 바꿨어요`);
    // 세션에 담긴 req.user 는 passport 가 요청마다 다시 읽으므로 다시 로그인할 필요가 없다
    console.log('새로고침하면 헤더에 관리자 메뉴가 보여요');
  }

  const admins = await User.find({ role: 'admin' }, { email: 1, nickname: 1 }).lean();
  console.log(`현재 관리자 ${admins.length}명: ${admins.map((a) => `${a.nickname}<${a.email}>`).join(' · ') || '없음'}`);

  await mongoose.disconnect();
}

// `require` 만 해도 돌아 버리면 사고가 난다 (2026-11-07 공유 DB 정리 사고) — 직접 실행할 때만 돈다
if (require.main === module)
  main().catch((err) => {
    console.error('역할을 바꾸지 못했어요:', err.message);
    process.exit(1);
  });

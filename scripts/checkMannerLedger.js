// 매너 점수 불변식 검사: npm run manner:check
//
//   모든 회원에 대해   score === clamp(50 + Σ MannerLog.scoreChange)
//
// 이 식이 깨지면 "왜 내 점수가 이 숫자지?"를 설명할 수 없게 된다 — 이 기능의 존재 이유가 무너진다.
// 점수를 움직이는 규칙을 새로 더할 때마다 이 검사를 통과해야 한다.
// (services/mannerService.js 의 move() 만 점수를 건드리므로, 깨졌다면 그 밖에서 건드린 코드가 있다는 뜻이다)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const MannerLog = require('../models/MannerLog');
const { BASE, MIN, MAX } = require('../services/mannerService');

const clamp = (n) => Math.min(MAX, Math.max(MIN, n));

async function main() {
  await connectDB();

  const users = await User.find({}, { nickname: 1, manner: 1 }).lean();
  const sums = await MannerLog.aggregate([{ $group: { _id: '$user', sum: { $sum: '$scoreChange' }, n: { $sum: 1 } } }]);
  const sumMap = new Map(sums.map((r) => [String(r._id), r]));

  let bad = 0;
  for (const u of users) {
    const row = sumMap.get(String(u._id)) || { sum: 0, n: 0 };
    const score = u.manner?.score ?? BASE;
    const expected = clamp(BASE + row.sum);
    if (score !== expected) {
      bad += 1;
      console.log(
        `  어긋남  ${String(u.nickname).padEnd(14)} 저장 ${String(score).padStart(3)}` +
          ` / 기대 ${String(expected).padStart(3)} (= ${BASE} + ${row.sum}, 이력 ${row.n}건)`
      );
    }
  }

  // 경계에 걸린 이력 — scoreChange 와 requested 가 다르면 덜 적용된 것이다 (정상, 화면이 설명한다)
  const clamped = await MannerLog.countDocuments({ $expr: { $ne: ['$scoreChange', '$requested'] } });

  console.log();
  console.log(`회원 ${users.length}명 · 이력 ${await MannerLog.countDocuments()}건 · 경계에 걸린 이력 ${clamped}건`);
  console.log(bad === 0 ? '불변식 통과 — 모든 점수가 이력으로 설명된다' : `${bad}명 어긋남`);

  await mongoose.disconnect();
  process.exit(bad === 0 ? 0 : 1);
}

// `require` 만 해도 돌아 버리면 사고가 난다 — 문법 확인하려고 require 했다가 공유 DB 가
// 정리된 적이 있다 (2026-11-07). 직접 실행할 때만 돈다.
if (require.main === module) main();

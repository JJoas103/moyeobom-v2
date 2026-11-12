// 한 번만 실행: npm run migrate:approved-ever
// 기존 모임에 Meetup.approvedEver 를 채움 — 호스트 취소 감점(-5)의 판정 기준이다 (2026-11-10).
// 이 필드가 없는 문서는 조건이 `(doc.approvedEver || 0) > 0` 에서 0 으로 떨어져 참여자가 있어도
// 취소 감점이 걸리지 않는다. 지금 승인된 인원 수를 넣어 그 구멍을 메운다.
//
// ⚠ 한계 — **마이그레이션 전에 이미 내보낸 사람은 되살릴 수 없다.** members 는 $pull 로 지워져
//   흔적이 없으므로 여기서 넣는 값은 실제 '승인한 적 있는 사람 수'의 **하한**이다. 이 시점 이후의
//   승인은 approveMember 가 $inc 로 정확히 센다.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Meetup = require('../models/Meetup');

async function main() {
  await connectDB();

  const target = { approvedEver: { $exists: false } };
  const before = await Meetup.countDocuments(target);

  // 집계 파이프라인 수정 — members 에서 approved 만 세어 그대로 넣는다 (문서마다 값이 다르다)
  const res = await Meetup.updateMany(target, [
    {
      $set: {
        approvedEver: {
          $size: {
            $filter: { input: { $ifNull: ['$members', []] }, cond: { $eq: ['$$this.status', 'approved'] } },
          },
        },
      },
    },
  ]);

  const left = await Meetup.countDocuments({ approvedEver: { $exists: false } });
  const withMembers = await Meetup.countDocuments({ approvedEver: { $gt: 0 } });
  console.log(`대상 ${before}건 · 채움 ${res.modifiedCount}건 · 남은 미설정 ${left}건`);
  console.log(`approvedEver > 0 인 모임: ${withMembers}건 (취소하면 -5 가 걸린다)`);

  // 검산 — 채운 값이 지금 승인 인원과 같은지 (내보내기가 없었으면 같아야 한다)
  const mismatched = await Meetup.aggregate([
    { $match: { approvedEver: { $exists: true } } },
    {
      $set: {
        nowApproved: {
          $size: { $filter: { input: { $ifNull: ['$members', []] }, cond: { $eq: ['$$this.status', 'approved'] } } },
        },
      },
    },
    { $match: { $expr: { $lt: ['$approvedEver', '$nowApproved'] } } },
    { $project: { title: 1, approvedEver: 1, nowApproved: 1 } },
  ]);
  if (mismatched.length) {
    console.log('⚠ approvedEver 가 지금 승인 인원보다 작은 모임 — 확인 필요:');
    mismatched.forEach((m) => console.log(`   ${m.title} : ${m.approvedEver} < ${m.nowApproved}`));
  } else {
    console.log('검산 통과 — approvedEver 가 지금 승인 인원보다 작은 모임은 없다');
  }

  await mongoose.disconnect();
}

// `require` 만 해도 돌아 버리면 사고가 난다 — 문법 확인하려고 require 했다가 공유 DB 가
// 정리된 적이 있다 (2026-11-07). 직접 실행할 때만 돈다.
if (require.main === module)
  main().catch((err) => {
    console.error('approvedEver 를 채우지 못했어요:', err.message);
    process.exit(1);
  });

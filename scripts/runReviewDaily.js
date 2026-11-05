// 평가 하루 처리 수동 실행: npm run review:daily
//   개설 가점 · 평가 열림 알림 · 마감 임박 알림 · 평가 마감 반영 (자동: 매일 12:00 서울)
//   모임에 표식을 남기므로 여러 번 돌려도 중복되지 않는다
//
// ⚠ 이 스크립트는 app.js 와 다른 프로세스라 socket.io 가 없다 — 알림은 DB 에 쌓이지만
//   실시간 push 는 안 간다 (config/socket.js emitToUsers 가 io 없으면 무시). 화면을 새로 열면 보인다
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const { runReviewDaily } = require('../schedulers/reviewDaily');

async function main() {
  await connectDB();
  await runReviewDaily();
  await mongoose.disconnect();
  process.exit(0);
}

main();

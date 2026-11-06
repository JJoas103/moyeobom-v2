// 행사 동기화 수동 실행: npm run sync:events
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const { runEventSync } = require('../schedulers/eventSync');
const { succeeded } = require('../schedulers/runAndLog');

async function main() {
  await connectDB();
  const result = await runEventSync('manual');
  await mongoose.disconnect();
  // 실패했거나 실행하지 못했으면 종료 코드 1
  process.exit(succeeded(result) ? 0 : 1);
}

// `require` 만 해도 돌아 버리면 사고가 난다 — 문법 확인하려고 require 했다가 공유 DB 가
// 정리된 적이 있다 (2026-11-07). 직접 실행할 때만 돈다.
if (require.main === module) main();

// 화장실 · 지하철역 동기화 수동 실행: npm run sync:places
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const { runPlaceSync } = require('../schedulers/placeSync');
const { succeeded } = require('../schedulers/runAndLog');

async function main() {
  await connectDB();
  const { toilets, stations } = await runPlaceSync('manual');
  await mongoose.disconnect();
  // 하나라도 실패했거나 실행하지 못했으면 종료 코드 1
  process.exit(succeeded(toilets) && succeeded(stations) ? 0 : 1);
}

// `require` 만 해도 돌아 버리면 사고가 난다 — 문법 확인하려고 require 했다가 공유 DB 가
// 정리된 적이 있다 (2026-11-07). 직접 실행할 때만 돈다.
if (require.main === module) main();

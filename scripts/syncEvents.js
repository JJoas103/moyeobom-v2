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

main();

// 한 번만 실행: npm run migrate:report-index
// 신고가 한 사람에 여러 건 쌓이도록 예전 고유 인덱스를 지움 — 코드에서 뺀 인덱스는 DB에 그대로 남아 있어서 직접 지워야 함
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

const INDEX = 'reporter_1_target_1_room_1_message_1';

async function main() {
  await connectDB();
  const reports = mongoose.connection.collection('reports');
  const exists = (await mongoose.connection.db.listCollections({ name: 'reports' }).hasNext()) && (await reports.indexExists(INDEX));
  if (exists) await reports.dropIndex(INDEX);
  console.log(exists ? `인덱스를 지웠어요: ${INDEX}` : `지울 인덱스가 없어요: ${INDEX}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('인덱스를 지우지 못했어요:', err.message);
  process.exit(1);
});

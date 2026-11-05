// 인덱스 정리: npm run db:sync-indexes
//
// v1(Moyeobom)과 같은 Atlas DB 를 쓰기 때문에, v1 이 돌 때 만들어 둔 인덱스가 v2 컬렉션에 남아 있다.
// mongoose 는 스키마에 없는 인덱스를 자동으로 지우지 않아서 그대로 쌓인다. 그중 **유니크** 인덱스는
// v2 에 없는 필드를 가리키므로 두 번째 문서부터 `{ 그 필드: null }` 중복으로 저장이 실패한다.
//
// 실제로 막혔던 것 (2026-11-04)
//   chatrooms.participants_1 (unique)  ← v1 ChatRoom.participants. v2 는 users 를 쓴다
//       → 두 번째 채팅방을 못 만든다 (친구 성립 · 모임 방 생성이 거기서 멈춘다)
//   friendships.users_1 (unique)       ← v1 Friendship. v2 는 userA · userB 를 쓴다
//       → 두 번째 친구가 안 생긴다
//
// syncIndexes() 는 스키마에 선언된 인덱스를 만들고, 선언되지 않은 것을 떼낸다.
// v1 을 다시 돌리면 v1 이 자기 인덱스를 다시 만들 것이므로 v1 쪽이 깨지지는 않는다.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// v2 가 쓰는 모델 전부 (models/ 디렉터리와 같이 유지할 것)
const MODELS = [
  '../models/Block',
  '../models/ChatMessage',
  '../models/ChatRoom',
  '../models/Event',
  '../models/Friendship',
  '../models/MannerLog',
  '../models/Meetup',
  '../models/Notification',
  '../models/Report',
  '../models/Review',
  '../models/Station',
  '../models/SyncLog',
  '../models/Toilet',
  '../models/User',
];

async function main() {
  await connectDB();

  for (const path of MODELS) {
    const Model = require(path);
    const before = (await Model.collection.indexes().catch(() => [])).map((i) => i.name);
    const dropped = await Model.syncIndexes();
    const after = (await Model.collection.indexes()).map((i) => i.name);
    const added = after.filter((n) => !before.includes(n));

    const parts = [];
    if (dropped.length) parts.push('떼냄 ' + dropped.join(', '));
    if (added.length) parts.push('만듦 ' + added.join(', '));
    console.log('  ' + Model.collection.name.padEnd(18) + (parts.length ? parts.join(' · ') : '그대로'));
  }

  await mongoose.disconnect();
  process.exit(0);
}

main();

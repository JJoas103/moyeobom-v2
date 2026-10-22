require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const connectDB = require('./config/database');
const passport = require('./config/passport');
const { apiErrorHandler, apiNotFound } = require('./middlewares/apiErrorMiddleware');
const { startEventSyncScheduler } = require('./schedulers/eventSync');
const { startPlaceSyncScheduler } = require('./schedulers/placeSync');
const { startSocialCleanupScheduler } = require('./schedulers/socialCleanup');
const { setupSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_DAYS = 14; // 로그인 유지 기간

connectDB();
startEventSyncScheduler(); // 매일 새벽 행사 동기화 (실행 시각엔 DB 연결 완료 상태)
startPlaceSyncScheduler(); // 매달 1일 화장실 · 지하철역 동기화
startSocialCleanupScheduler(); // 매일 12:00 친구 요청 만료 · 오래된 채팅 삭제

// 세션 — MongoDB 저장 (nodemon 재시작해도 로그인 유지). Socket.IO 도 같은 세션으로 사용자 확인
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'secret_key',
  resave: false,
  saveUninitialized: false, // 로그인·소셜 가입 중일 때만 세션 생성
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB || 'moyeobom',
    ttl: SESSION_DAYS * 24 * 60 * 60,
  }),
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 },
});

// Socket.IO — 채팅 · 친구 소식 (로그인한 사람만 연결)
setupSocket(server, { origin: FRONTEND_URL, sessionMiddleware, passport });

// 미들웨어
app.use(cors({ origin: FRONTEND_URL, credentials: true })); // 세션 쿠키를 쓰게 되면 credentials 필수
app.use(express.static(path.join(__dirname, 'public'))); // 업로드 이미지 서빙
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// 라우터 — 전부 /api/* 아래
app.use('/api/health', require('./routes/api/healthApiRouter'));
app.use('/api/auth', require('./routes/api/authApiRouter'));
app.use('/api/member', require('./routes/api/memberApiRouter'));
app.use('/api/event', require('./routes/api/eventApiRouter'));
app.use('/api/nearby', require('./routes/api/nearbyApiRouter'));
app.use('/api/meetup', require('./routes/api/meetupApiRouter'));
app.use('/api/friends', require('./routes/api/friendApiRouter'));
app.use('/api/chat', require('./routes/api/chatApiRouter'));

// 에러 핸들링 — 라우터 등록 뒤에 위치
app.use('/api', apiNotFound);
app.use('/api', apiErrorHandler);

const PORT = process.env.PORT || 3000;
server
  .listen(PORT, '0.0.0.0', () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`오류: ${PORT}번 포트가 이미 사용 중입니다.`);
    else console.error('서버 시작 중 오류 발생:', err);
  });

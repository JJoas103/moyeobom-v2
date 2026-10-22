const { Server } = require('socket.io');

// Socket.IO — 로그인 세션으로 사용자 확인 → 각자 `user:<id>` 방에만 들어감
// 서버는 받는 사람의 user 방으로만 보냄 (채팅 메시지 · 읽음 · 친구 소식). 클라이언트가 방을 고르지 않음
let io = null;

// 첫 연결(handshake) 때만 세션 미들웨어 실행
const onlyForHandshake = (middleware) => (req, res, next) => {
  const isHandshake = req._query.sid === undefined;
  if (isHandshake) middleware(req, res, next);
  else next();
};

function setupSocket(server, { origin, sessionMiddleware, passport }) {
  io = new Server(server, { cors: { origin, credentials: true } });

  io.engine.use(onlyForHandshake(sessionMiddleware));
  io.engine.use(onlyForHandshake(passport.session()));
  io.engine.use(
    onlyForHandshake((req, res, next) => {
      if (req.user) return next();
      res.writeHead(401);
      res.end();
    })
  );

  io.on('connection', (socket) => {
    socket.join(`user:${socket.request.user._id}`);
  });
  return io;
}

/** 여러 사람에게 보내기 — userIds: ObjectId · 문자열 섞여도 됨 */
function emitToUsers(userIds, event, payload) {
  if (!io) return; // 스크립트 실행(cron 수동 등) 중엔 소켓 없음
  const rooms = [...new Set(userIds.map((id) => `user:${id}`))];
  if (rooms.length) io.to(rooms).emit(event, payload);
}

module.exports = { setupSocket, emitToUsers };

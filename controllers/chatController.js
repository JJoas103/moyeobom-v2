const chatService = require('../services/chatService');

// 컨트롤러 공통 — 서비스 결과를 { success: true, ...data } 로
const handle = (run) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await run(req)) });
  } catch (err) {
    next(err);
  }
};

const me = (req) => req.user._id;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

module.exports = {
  // GET /api/chat/rooms → { rooms }
  rooms: handle(async (req) => ({ rooms: await chatService.listRooms(me(req)) })),
  // GET /api/chat/unread → { count }
  unread: handle(async (req) => ({ count: await chatService.totalUnread(me(req)) })),
  // GET /api/chat/meetup/:meetupId → { roomId } (모임 상세 '모임 채팅 열기')
  meetupRoom: handle(async (req) => ({ roomId: await chatService.roomIdForMeetup(req.params.meetupId, me(req)) })),
  // GET /api/chat/rooms/:id → { room, messages, hasMore }
  room: handle((req) => chatService.getRoom(req.params.id, me(req))),
  // GET /api/chat/rooms/:id/messages?before=<messageId> → { messages, hasMore }
  messages: handle((req) => chatService.listMessages(req.params.id, me(req), str(req.query.before))),
  // POST /api/chat/rooms/:id/messages { text } → { message }
  send: handle(async (req) => ({ message: await chatService.sendMessage(req.params.id, me(req), req.body?.text) })),
  // POST /api/chat/rooms/:id/read → { at }
  read: handle(async (req) => ({ at: await chatService.markRead(req.params.id, me(req)) })),
  // POST /api/chat/rooms/:id/notices { messageId } → { notices } (호스트만)
  pin: handle(async (req) => ({ notices: await chatService.pinNotice(req.params.id, me(req), req.body?.messageId) })),
  // DELETE /api/chat/rooms/:id/notices/:messageId → { notices } (호스트만)
  unpin: handle(async (req) => ({ notices: await chatService.unpinNotice(req.params.id, me(req), req.params.messageId) })),
  // POST /api/chat/rooms/:id/report { messageId? , userId? }
  report: handle(async (req) => {
    await chatService.report(req.params.id, me(req), { messageId: req.body?.messageId, targetId: req.body?.userId });
    return {};
  }),
};

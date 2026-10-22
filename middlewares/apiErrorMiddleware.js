// /api/* 에서 매칭되는 라우트가 없을 때
const apiNotFound = (req, res) => {
  res.status(404).json({ success: false, message: `없는 API입니다: ${req.method} ${req.originalUrl}` });
};

// 에러 응답도 JSON — 프론트 api.js 가 message 를 꺼내 씀
const apiErrorHandler = (err, req, res, next) => {
  let statusCode = err.status || 500;
  // 서비스 계층에서 "찾을 수 없습니다"로 던진 에러는 404로 매핑
  if (!err.status && typeof err.message === 'string' && err.message.includes('찾을 수 없습니다')) {
    statusCode = 404;
  }
  // 잘못된 ObjectId (/api/event/abc 같은 요청)
  if (err.name === 'CastError') statusCode = 400;

  // 서버 오류(5xx)만 스택 기록 — 4xx(이미 신청함 · 권한 없음 등)는 정상 흐름
  if (statusCode >= 500) {
    console.error(`[API ${req.method} ${req.originalUrl}]`);
    console.error(err.stack);
  }

  res.status(statusCode).json({ success: false, message: err.message || '서버 오류가 발생했습니다' });
};

module.exports = { apiErrorHandler, apiNotFound };

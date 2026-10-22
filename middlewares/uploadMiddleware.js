const fs = require('fs');
const multer = require('multer');

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: '사진 용량이 너무 커요',
};

/**
 * multer 업로더 감싸기 — 업로드 오류 → 400 JSON(fieldErrors)
 *   router.post('/join', handleUpload(uploadProfile.single('uploadFile'), 'uploadFile'), ...)
 * fieldName: 프론트 폼이 오류를 붙일 칸 이름
 */
const handleUpload = (uploader, fieldName = 'uploadFile') => (req, res, next) => {
  uploader(req, res, (err) => {
    if (!err) return next();
    const message = err instanceof multer.MulterError ? MULTER_MESSAGES[err.code] || '사진을 올리지 못했어요' : err.message;
    res.status(400).json({ success: false, message, fieldErrors: { [fieldName]: message } });
  });
};

/** 요청 실패 시 방금 올라온 파일 삭제 (고아 파일 방지) */
const removeUploaded = (req) => {
  if (req.file?.path) fs.unlink(req.file.path, () => {});
};

module.exports = { handleUpload, removeUploaded };

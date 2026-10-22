const multer = require('multer');
const path = require('path');

const makeFileName = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  cb(null, Date.now() + ext); // 업로드 시각 + 확장자
};

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('이미지 파일만 업로드 가능합니다'));
};

const uploadProfile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images/profile'),
    filename: makeFileName,
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 프로필 5MB
  fileFilter: imageFilter,
});

// 모임 대표 이미지 (모임 만들기 ② — 선택, 세로 3:4로 표시)
const uploadMeetup = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images/upload'),
    filename: makeFileName,
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFilter,
});

module.exports = { uploadProfile, uploadMeetup };

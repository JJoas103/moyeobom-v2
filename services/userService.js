const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const SALT_ROUNDS = 10;
const PROFILE_DIR = path.join(__dirname, '..', 'public', 'images', 'profile');

const nicknameDuplicate = () => Object.assign(new Error('이미 쓰고 있는 닉네임이에요'), { code: 'NICKNAME_DUPLICATE' });

/** 클라이언트에 보낼 필드만 (password 제외) */
function toPublicUser(user) {
  return {
    _id: user._id.toString(),
    email: user.email,
    nickname: user.nickname,
    profileImage: user.profileImage,
    provider: user.provider,
  };
}

// 회원가입 (로컬)
async function createUser({ email, password, nickname, uploadFile }) {
  if (await User.exists({ nickname })) throw nicknameDuplicate();

  return User.create({
    email,
    password: await bcrypt.hash(password, SALT_ROUNDS),
    nickname,
    profileImage: uploadFile ? uploadFile.filename : '',
    provider: 'local',
  });
}

// 소셜 가입 마무리 — 세션에 담아 둔 소셜 정보 + 사용자가 고른 닉네임
async function createSocialUser({ email, nickname, provider, uploadFile }) {
  const existing = await User.findOne({ email });
  if (existing) return existing;

  if (await User.exists({ nickname })) throw nicknameDuplicate();

  return User.create({
    email,
    nickname,
    profileImage: uploadFile ? uploadFile.filename : '',
    provider,
  });
}

/** 이메일을 쓸 수 있으면 true */
async function checkEmail(email) {
  return !(await User.exists({ email: String(email || '').trim().toLowerCase() }));
}

const findUserById = (id) => User.findById(id);
const findUserByEmail = (email) => User.findOne({ email: String(email || '').trim().toLowerCase() });

/** 로컬 로그인 비밀번호 확인 */
async function verifyPassword(user, password) {
  if (!user?.password) return false; // 소셜 가입자는 비밀번호 없음
  return bcrypt.compare(password, user.password);
}

// ---------- 마이 › 계정 설정 ----------

const fieldError = (field, message) => Object.assign(new Error(message), { fieldErrors: { [field]: message } });
const removeProfileFile = (filename) => {
  if (filename) fs.unlink(path.join(PROFILE_DIR, filename), () => {});
};

/** 닉네임 · 프로필 사진 바꾸기 — uploadFile 있으면 새 사진, removeImage 면 기본 사진. 예전 파일은 지움 */
async function updateProfile(user, { nickname, uploadFile, removeImage }) {
  if (nickname !== user.nickname && (await User.exists({ nickname, _id: { $ne: user._id } }))) throw nicknameDuplicate();

  const oldImage = user.profileImage;
  user.nickname = nickname;
  if (uploadFile) user.profileImage = uploadFile.filename;
  else if (removeImage) user.profileImage = '';
  await user.save();

  if (oldImage && oldImage !== user.profileImage) removeProfileFile(oldImage);
  return user;
}

/** 회원 지우기 — 정리 순서 · 막는 조건은 myPageService.withdraw */
async function deleteUser(user) {
  await User.deleteOne({ _id: user._id });
  removeProfileFile(user.profileImage);
}

/** 비밀번호 바꾸기 — 이메일 가입자만 */
async function changePassword(user, { currentPassword, password }) {
  if (user.provider !== 'local' || !user.password) throw Object.assign(new Error('소셜 계정은 비밀번호가 없어요'), { status: 400 });
  if (!(await bcrypt.compare(currentPassword, user.password))) throw fieldError('currentPassword', '지금 비밀번호가 맞지 않아요');
  user.password = await bcrypt.hash(password, SALT_ROUNDS);
  await user.save();
}

module.exports = {
  toPublicUser,
  createUser,
  createSocialUser,
  checkEmail,
  findUserById,
  findUserByEmail,
  verifyPassword,
  updateProfile,
  changePassword,
  deleteUser,
};

const bcrypt = require('bcrypt');
const User = require('../models/User');

const SALT_ROUNDS = 10;

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

module.exports = {
  toPublicUser,
  createUser,
  createSocialUser,
  checkEmail,
  findUserById,
  findUserByEmail,
  verifyPassword,
};

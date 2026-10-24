const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const NaverStrategy = require('passport-naver-v2').Strategy;
const userService = require('../services/userService');

const LOGIN_FAILED = '이메일 또는 비밀번호가 맞지 않아요';

// 로컬 로그인
passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
    try {
      const user = await userService.findUserByEmail(email);
      if (!user) return done(null, false, { message: LOGIN_FAILED });
      if (user.provider !== 'local') {
        return done(null, false, { message: `${user.provider === 'google' ? '구글' : '네이버'}로 가입한 계정이에요` });
      }
      if (!(await userService.verifyPassword(user, password))) return done(null, false, { message: LOGIN_FAILED });
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// 소셜 로그인 — 가입된 이메일이면 로그인, 처음이면 소셜 정보만 전달 (DB 저장은 닉네임 입력 후)
function socialVerify(provider, toSocialData) {
  return async (accessToken, refreshToken, profile, done) => {
    try {
      const socialData = { ...toSocialData(profile), provider };
      if (!socialData.email) return done(null, false, { type: 'no_email' });
      const user = await userService.findUserByEmail(socialData.email);
      if (user) return done(null, user);
      return done(null, false, { type: 'social_new', socialData });
    } catch (error) {
      return done(error);
    }
  };
}

const googleVerify = socialVerify('google', (profile) => ({
  email: profile.emails?.[0]?.value,
  nickname: profile.displayName,
}));

const naverVerify = socialVerify('naver', (profile) => ({
  email: profile.email,
  nickname: profile.nickname,
}));

// 콜백 주소는 백엔드(:3000) — OAuth 콘솔에도 같은 주소 등록
passport.use(
  'google-api',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    },
    googleVerify
  )
);

passport.use(
  'naver-api',
  new NaverStrategy(
    {
      clientID: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      callbackURL: '/api/auth/naver/callback',
    },
    naverVerify
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    // 탈퇴 등으로 사용자가 없으면 false → 로그아웃 상태로 처리
    done(null, (await userService.findUserById(id)) || false);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;

const { body, validationResult } = require('express-validator');
const { removeUploaded } = require('./uploadMiddleware');
const { TASTES, DISTRICT_MAX, SEOUL_DISTRICTS } = require('../models/User');

const nicknameRule = () =>
  body('nickname')
    .trim()
    .notEmpty()
    .withMessage('닉네임을 적어 주세요')
    .isLength({ min: 2, max: 15 })
    .withMessage('닉네임은 2~15자로 적어 주세요');

const passwordRules = () => [
  body('password')
    .notEmpty()
    .withMessage('비밀번호를 적어 주세요')
    .bail()
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('영문 · 숫자 · 특수문자(@$!%*?&)를 섞어 8자 이상으로 적어 주세요'),
  body('password2').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('비밀번호가 서로 달라요');
    return true;
  }),
];

// 폼 전송은 값이 하나면 문자열로 온다 — 항상 중복 없는 배열로 맞춤
const toList = (value) => {
  if (value === undefined || value === null || value === '') return [];
  return [...new Set(Array.isArray(value) ? value : [value])];
};

const tasteRules = () => [
  body('tastes')
    .customSanitizer(toList)
    .custom((list) => {
      if (list.length === 0) throw new Error('좋아하는 걸 하나 이상 골라 주세요');
      if (!list.every((key) => TASTES.includes(key))) throw new Error('고를 수 없는 취향이에요');
      return true;
    }),
  body('districts')
    .customSanitizer(toList)
    .custom((list) => {
      if (list.length > DISTRICT_MAX) throw new Error(`관심 지역은 ${DISTRICT_MAX}곳까지 고를 수 있어요`);
      if (!list.every((name) => SEOUL_DISTRICTS.includes(name))) throw new Error('고를 수 없는 지역이에요');
      return true;
    }),
];

const joinValidationRules = [
  body('email').trim().notEmpty().withMessage('이메일을 적어 주세요').bail().isEmail().withMessage('이메일 형식이 아니에요'),
  nicknameRule(),
  ...passwordRules(),
  ...tasteRules(),
];

const socialJoinValidationRules = [nicknameRule(), ...tasteRules()];

// 마이 › 계정 설정
const profileValidationRules = [nicknameRule()];
const passwordChangeRules = [body('currentPassword').notEmpty().withMessage('지금 비밀번호를 적어 주세요'), ...passwordRules()];
const tasteUpdateRules = tasteRules();

// 검증 결과 → { success:false, fieldErrors: { 필드: 메시지 } } (프론트 폼이 칸 아래에 표시)
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  removeUploaded(req);
  const fieldErrors = {};
  errors.array().forEach((err) => {
    if (!fieldErrors[err.path]) fieldErrors[err.path] = err.msg;
  });
  res.status(400).json({ success: false, message: '입력한 내용을 확인해 주세요', fieldErrors });
};

module.exports = { joinValidationRules, socialJoinValidationRules, profileValidationRules, passwordChangeRules, tasteUpdateRules, validate };

const { body, validationResult } = require('express-validator');
const { removeUploaded } = require('./uploadMiddleware');

const nicknameRule = () =>
  body('nickname')
    .trim()
    .notEmpty()
    .withMessage('닉네임을 적어 주세요')
    .isLength({ min: 2, max: 15 })
    .withMessage('닉네임은 2~15자로 적어 주세요');

const joinValidationRules = [
  body('email').trim().notEmpty().withMessage('이메일을 적어 주세요').bail().isEmail().withMessage('이메일 형식이 아니에요'),
  nicknameRule(),
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

const socialJoinValidationRules = [nicknameRule()];

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

module.exports = { joinValidationRules, socialJoinValidationRules, validate };

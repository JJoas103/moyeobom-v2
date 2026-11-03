import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../../components/common/Field'
import ProfilePicker from '../../components/member/ProfilePicker'
import { JoinStepList, JoinTasteSteps } from '../../components/member/JoinSteps'
import { stepOfErrors } from '../../utils/user'
import { apiGet, apiPostForm } from '../../api'
import '../../styles/create.css'
import '../../styles/auth.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/ // 백엔드 passwordRules 와 같음
const PASSWORD_HINT = '영문 · 숫자 · 특수문자(@$!%*?&)를 섞어 8자 이상'

export default function Join() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // ① 계정 ② 취향 ③ 지역 — ③에서 한 번에 가입
  const [form, setForm] = useState({ email: '', password: '', password2: '', nickname: '' })
  const [tastes, setTastes] = useState([])
  const [districts, setDistricts] = useState([])
  const [image, setImage] = useState(null)
  const [errors, setErrors] = useState({})
  const [emailOk, setEmailOk] = useState(null) // 중복확인을 통과한 이메일
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const email = form.email.trim()
  const emailChecked = emailOk !== null && emailOk === email

  const checkEmail = async () => {
    if (!EMAIL_RE.test(email)) return setErrors((x) => ({ ...x, email: '이메일 형식이 아니에요' }))
    setChecking(true)
    try {
      const { available } = await apiGet('/api/member/check-email', { params: { email } })
      if (available) {
        setEmailOk(email)
        setErrors((x) => ({ ...x, email: undefined }))
      } else {
        setEmailOk(null)
        setErrors((x) => ({ ...x, email: '이미 가입된 이메일이에요' }))
      }
    } catch (err) {
      setErrors((x) => ({ ...x, email: err.message }))
    } finally {
      setChecking(false)
    }
  }

  // 취향을 고른 뒤에 되돌아오지 않게 계정 칸은 여기서 먼저 확인
  const goNext = (e) => {
    e.preventDefault()
    const next = {}
    if (!emailChecked) next.email = '이메일 중복확인을 해 주세요'
    if (!PASSWORD_RE.test(form.password)) next.password = '영문 · 숫자 · 특수문자(@$!%*?&)를 섞어 8자 이상으로 적어 주세요'
    if (form.password !== form.password2) next.password2 = '비밀번호가 서로 달라요'
    const nicknameLength = form.nickname.trim().length
    if (nicknameLength < 2 || nicknameLength > 15) next.nickname = '닉네임은 2~15자로 적어 주세요'
    setErrors((x) => ({ ...x, ...next }))
    if (Object.keys(next).length === 0) {
      setSubmitError(null)
      setStep(2)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const body = new FormData()
    Object.entries({ ...form, email }).forEach(([k, v]) => body.append(k, v))
    tastes.forEach((key) => body.append('tastes', key))
    districts.forEach((name) => body.append('districts', name))
    if (image) body.append('uploadFile', image)

    setSubmitting(true)
    setSubmitError(null)
    try {
      await apiPostForm('/api/member/join', body)
      navigate('/member/login', { state: { joined: true } })
    } catch (err) {
      if (err.fieldErrors) {
        setErrors(err.fieldErrors)
        setStep(stepOfErrors(err.fieldErrors))
      }
      setSubmitError(err.fieldErrors ? null : err.message)
      setSubmitting(false)
    }
  }

  if (step > 1) {
    return (
      <JoinTasteSteps
        step={step}
        tastes={tastes}
        districts={districts}
        onTastes={setTastes}
        onDistricts={setDistricts}
        onStep={setStep}
        onSubmit={submit}
        submitting={submitting}
        submitLabel="가입하기"
        error={submitError || errors.tastes || errors.districts}
      />
    )
  }

  return (
    <div className="auth">
      <JoinStepList current={1} />
      <div className="auth__head">
        <h1>회원가입</h1>
        <p>모임에서는 닉네임으로 보여요.</p>
      </div>

      {submitError && (
        <div className="auth__alert auth__alert--error" role="alert">
          {submitError}
        </div>
      )}

      <form className="auth__form" onSubmit={goNext} noValidate>
        <Field label="이메일" error={errors.email}>
          <div className="input-row">
            <input
              className="input"
              type="email"
              autoComplete="email"
              aria-label="이메일"
              aria-invalid={errors.email ? true : undefined}
              value={form.email}
              onChange={set('email')}
            />
            <button type="button" className="btn btn--line" onClick={checkEmail} disabled={checking || !email}>
              {checking ? '확인 중...' : '중복확인'}
            </button>
          </div>
        </Field>
        {emailChecked && !errors.email && <span className="field__ok">쓸 수 있는 이메일이에요</span>}

        <Field label="비밀번호" hint={PASSWORD_HINT} error={errors.password}>
          <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="비밀번호 확인" error={errors.password2}>
          <input className="input" type="password" autoComplete="new-password" value={form.password2} onChange={set('password2')} />
        </Field>
        <Field label="닉네임" hint="2~15자" error={errors.nickname} count={[form.nickname.trim().length, 15]}>
          <input className="input" value={form.nickname} onChange={set('nickname')} maxLength={15} />
        </Field>

        <ProfilePicker
          file={image}
          onChange={setImage}
          error={errors.uploadFile}
          onError={(message) => setErrors((x) => ({ ...x, uploadFile: message || undefined }))}
        />

        <button type="submit" className="btn btn--primary btn--lg auth__submit">
          다음
        </button>
      </form>

      <p className="auth__foot">
        이미 계정이 있어요?
        <Link to="/member/login">로그인</Link>
      </p>
    </div>
  )
}

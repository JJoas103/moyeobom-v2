import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../../components/common/Field'
import { useAuth } from '../../context/AuthContext'
import { API_BASE_URL } from '../../api'
import '../../styles/create.css'
import '../../styles/auth.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(searchParams.get('error') === 'social' ? '소셜 로그인을 마치지 못했어요. 다시 시도해 주세요.' : null)
  const [submitting, setSubmitting] = useState(false)

  const joined = location.state?.joined // 회원가입 직후
  // 로그인이 필요해서 넘어왔다면 원래 화면으로 (로그인·가입 화면 자신은 제외)
  const fromState = location.state?.from
  const from = fromState && !fromState.startsWith('/member') ? fromState : '/'

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__head">
        <h1>로그인</h1>
        <p>모임을 만들거나 참여하려면 로그인해요.</p>
      </div>

      {joined && !error && <div className="auth__alert auth__alert--ok">가입을 마쳤어요. 이제 로그인해요.</div>}
      {error && (
        <div className="auth__alert auth__alert--error" role="alert">
          {error}
        </div>
      )}

      <form className="auth__form" onSubmit={submit}>
        <Field label="이메일">
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="비밀번호">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="btn btn--primary btn--lg auth__submit" disabled={submitting}>
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="auth__divider">또는</div>

      {/* 소셜 로그인은 fetch 가 아니라 백엔드로 이동하는 링크 */}
      <div className="auth__social">
        <a href={`${API_BASE_URL}/api/auth/google`} className="btn btn--line btn--lg">
          구글로 계속하기
        </a>
        <a href={`${API_BASE_URL}/api/auth/naver`} className="btn btn--line btn--lg">
          네이버로 계속하기
        </a>
      </div>

      <p className="auth__foot">
        아직 회원이 아니에요?
        <Link to="/member/join">회원가입</Link>
      </p>
    </div>
  )
}

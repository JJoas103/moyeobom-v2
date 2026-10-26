import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/common/Avatar'
import Dialog from '../../components/common/Dialog'
import Field from '../../components/common/Field'
import { useAuth } from '../../context/AuthContext'
import { WITHDRAW_TEXT, changePassword, updateProfile, withdraw } from '../../data/member'
import { PROVIDER_LABEL } from '../../data/constants'
import '../../styles/create.css'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX = 5 * 1024 * 1024 // 백엔드 uploadProfile 과 같은 5MB
const NICKNAME_MAX = 15
const PASSWORD_HINT = '영문 · 숫자 · 특수문자(@$!%*?&) 8자 이상'

// 계정 설정 — 프로필(사진 · 닉네임) · 비밀번호(이메일 가입자만) · 로그아웃 · 회원 탈퇴
export default function SettingsTab({ profile, upcoming, onSaved }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const onLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="mypage-settings">
      <ProfileForm profile={profile} onSaved={onSaved} />

      <section className="mypage-form" aria-label="계정">
        <h2 className="mypage-form__title">계정</h2>
        <Field label="이메일" hint="바꿀 수 없어요">
          <input className="input" value={profile.email} readOnly />
        </Field>
        <div className="mypage-form__row">
          <span className="field__label">로그인 방식</span>
          <span className="mypage-tags">
            <span className="mypage-chip">{PROVIDER_LABEL[profile.provider]}</span>
            {profile.provider !== 'local' && <span className="mypage-tag">비밀번호 없음</span>}
          </span>
        </div>
        {profile.provider === 'local' && <PasswordForm />}
        <div className="mypage-settings__foot">
          <button type="button" className="btn btn--line mypage-btn" onClick={onLogout}>
            로그아웃
          </button>
          <button type="button" className="btn btn--danger mypage-btn" onClick={() => setWithdrawOpen(true)}>
            회원 탈퇴
          </button>
        </div>
      </section>

      {withdrawOpen && <WithdrawDialog profile={profile} upcoming={upcoming} onClose={() => setWithdrawOpen(false)} />}
    </div>
  )
}

// 탈퇴 확인 — 다가오는 모임이 있으면 안내만, 없으면 비밀번호(소셜은 '탈퇴') 입력 뒤 빨간 버튼
function WithdrawDialog({ profile, upcoming, onClose }) {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const local = profile.provider === 'local'
  const blocked = upcoming.hosted > 0 || upcoming.joined > 0
  const ready = local ? value.length > 0 : value.trim() === WITHDRAW_TEXT

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await withdraw(local ? { password: value } : { confirmText: value })
      await refreshUser() // 세션이 끝나 user → null
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.fieldErrors?.password || err.fieldErrors?.confirmText || err.message)
      setBusy(false)
    }
  }

  if (blocked) {
    return (
      <Dialog label="아직 탈퇴할 수 없어요" onClose={onClose}>
        <span className="dialog__title">아직 탈퇴할 수 없어요</span>
        <span className="mypage-tags">
          {upcoming.hosted > 0 && <span className="mypage-tag">다가오는 연 모임 {upcoming.hosted}</span>}
          {upcoming.joined > 0 && <span className="mypage-tag">참여 중인 모임 {upcoming.joined}</span>}
        </span>
        <p className="dialog__text">모임을 취소하거나 끝난 뒤에 탈퇴할 수 있어요.</p>
        <div className="dialog__actions">
          <button type="button" className="btn btn--line dialog__btn" onClick={onClose}>
            닫기
          </button>
          <Link to="/my/meetups" className="btn btn--primary dialog__btn">
            내 모임 보기
          </Link>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog label="회원 탈퇴" onClose={onClose} width={400}>
      <form className="mypage-withdraw" onSubmit={onSubmit} noValidate>
        <span className="dialog__title">정말 탈퇴할까요?</span>
        <Field label={local ? '비밀번호' : `'${WITHDRAW_TEXT}'를 적어 주세요`} error={error}>
          <input
            className="input"
            type={local ? 'password' : 'text'}
            autoComplete={local ? 'current-password' : 'off'}
            placeholder={local ? '' : WITHDRAW_TEXT}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError('')
            }}
          />
        </Field>
        <div className="dialog__actions">
          <button type="button" className="btn btn--line dialog__btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn--danger dialog__btn" disabled={!ready || busy}>
            {busy ? '탈퇴하는 중...' : '탈퇴하기'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ProfileForm({ profile, onSaved }) {
  const { refreshUser } = useAuth()
  const inputRef = useRef(null)
  const [nickname, setNickname] = useState(profile.nickname)
  const [file, setFile] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const hasImage = Boolean(file) || (!removeImage && Boolean(profile.profileImage))
  const changed = nickname.trim() !== profile.nickname || Boolean(file) || (removeImage && Boolean(profile.profileImage))

  const pick = (e) => {
    const next = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 onChange 가 오도록
    if (!next) return
    if (!IMAGE_TYPES.includes(next.type)) return setErrors({ uploadFile: 'JPG · PNG · WEBP 사진만 올릴 수 있어요.' })
    if (next.size > IMAGE_MAX) return setErrors({ uploadFile: '5MB 이하 사진만 올릴 수 있어요.' })
    setErrors({})
    setFile(next)
    setRemoveImage(false)
    setDone(false)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const name = nickname.trim()
    if (name.length < 2 || name.length > NICKNAME_MAX) return setErrors({ nickname: `닉네임은 2~${NICKNAME_MAX}자로 적어 주세요` })

    setSaving(true)
    setErrors({})
    try {
      await updateProfile({ nickname: name, file, removeImage })
      setFile(null)
      setRemoveImage(false)
      setDone(true)
      await refreshUser() // 헤더 프로필도 바로 바뀌게
      onSaved()
    } catch (err) {
      setErrors(err.fieldErrors || { form: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mypage-form" onSubmit={onSubmit} noValidate>
      <h2 className="mypage-form__title">프로필</h2>

      <div className={`mypage-form__row${errors.uploadFile ? ' has-error' : ''}`}>
        <span className="field__label">프로필 사진</span>
        <div className="mypage-photo">
          {preview ? <img className="avatar" src={preview} alt="" style={{ width: 64, height: 64 }} /> : <Avatar user={removeImage ? { _id: profile._id } : profile} size={64} />}
          <button type="button" className="btn btn--line mypage-btn" onClick={() => inputRef.current?.click()}>
            사진 바꾸기
          </button>
          {hasImage && (
            <button
              type="button"
              className="btn mypage-btn mypage-btn--text"
              onClick={() => {
                setFile(null)
                setRemoveImage(true)
                setDone(false)
              }}
            >
              기본 사진으로
            </button>
          )}
          <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(',')} onChange={pick} hidden />
        </div>
        {errors.uploadFile && (
          <span className="field__error" role="alert">
            {errors.uploadFile}
          </span>
        )}
      </div>

      <Field label="닉네임" hint={`2~${NICKNAME_MAX}자`} error={errors.nickname} count={[nickname.trim().length, NICKNAME_MAX]}>
        <input
          className="input"
          value={nickname}
          maxLength={NICKNAME_MAX}
          onChange={(e) => {
            setNickname(e.target.value)
            setDone(false)
          }}
        />
      </Field>

      {errors.form && (
        <p className="field__error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="mypage-form__actions">
        {done && !changed && <span className="mypage-saved" role="status">저장했어요</span>}
        <button type="submit" className="btn btn--primary" disabled={saving || !changed}>
          {saving ? '저장하는 중...' : '저장하기'}
        </button>
      </div>
    </form>
  )
}

const EMPTY_PASSWORD = { currentPassword: '', password: '', password2: '' }

function PasswordForm() {
  const [form, setForm] = useState(EMPTY_PASSWORD)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setDone(false)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await changePassword(form)
      setForm(EMPTY_PASSWORD)
      setDone(true)
    } catch (err) {
      setErrors(err.fieldErrors || { form: err.message })
    } finally {
      setSaving(false)
    }
  }

  const filled = form.currentPassword && form.password && form.password2

  return (
    <form className="mypage-form mypage-form--sub" onSubmit={onSubmit} noValidate>
      <h3 className="mypage-form__subtitle">비밀번호 바꾸기</h3>
      <Field label="지금 비밀번호" error={errors.currentPassword}>
        <input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
      </Field>
      <Field label="새 비밀번호" hint={PASSWORD_HINT} error={errors.password}>
        <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
      </Field>
      <Field label="새 비밀번호 확인" error={errors.password2}>
        <input className="input" type="password" autoComplete="new-password" value={form.password2} onChange={set('password2')} />
      </Field>
      {errors.form && (
        <p className="field__error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="mypage-form__actions">
        {done && <span className="mypage-saved" role="status">비밀번호를 바꿨어요</span>}
        <button type="submit" className="btn btn--primary" disabled={saving || !filled}>
          {saving ? '바꾸는 중...' : '비밀번호 바꾸기'}
        </button>
      </div>
    </form>
  )
}

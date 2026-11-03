import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Field from '../../components/common/Field'
import DataState from '../../components/common/DataState'
import ProfilePicker from '../../components/member/ProfilePicker'
import { JoinStepList, JoinTasteSteps } from '../../components/member/JoinSteps'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../utils/useAsync'
import { stepOfErrors } from '../../utils/user'
import { apiGet, apiPostForm } from '../../api'
import '../../styles/create.css'
import '../../styles/auth.css'

const PROVIDER_LABEL = { google: '구글', naver: '네이버' }

// 소셜 로그인 첫 가입 — 세션의 소셜 정보 + 닉네임 · 취향 · 지역 입력
export default function SocialJoin() {
  const { data, loading, error } = useAsync(() => apiGet('/api/auth/social-data'), [])

  if (data && !data.socialData) return <Navigate to="/member/login" replace /> // 세션이 없으면(직접 들어옴 · 만료) 로그인으로

  return (
    <DataState loading={loading && !data} error={error}>
      {data?.socialData && <SocialJoinForm socialData={data.socialData} />}
    </DataState>
  )
}

function SocialJoinForm({ socialData }) {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState((socialData.nickname || '').slice(0, 15))
  const [tastes, setTastes] = useState([])
  const [districts, setDistricts] = useState([])
  const [image, setImage] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const goNext = (e) => {
    e.preventDefault()
    const length = nickname.trim().length
    if (length < 2 || length > 15) return setErrors((x) => ({ ...x, nickname: '닉네임은 2~15자로 적어 주세요' }))
    setSubmitError(null)
    setStep(2)
  }

  const submit = async (e) => {
    e.preventDefault()
    const body = new FormData()
    body.append('nickname', nickname.trim())
    tastes.forEach((key) => body.append('tastes', key))
    districts.forEach((name) => body.append('districts', name))
    if (image) body.append('uploadFile', image)

    setSubmitting(true)
    setSubmitError(null)
    try {
      await apiPostForm('/api/auth/social-join', body)
      await refreshUser()
      navigate('/', { replace: true })
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
        submitLabel="시작하기"
        error={submitError || errors.tastes || errors.districts}
      />
    )
  }

  return (
    <div className="auth">
      <JoinStepList current={1} />
      <div className="auth__head">
        <h1>거의 다 됐어요</h1>
        <p>
          {PROVIDER_LABEL[socialData.provider] || '소셜'} 계정({socialData.email})으로 가입해요. 모임에서 쓸 닉네임을 정해 주세요.
        </p>
      </div>

      {submitError && (
        <div className="auth__alert auth__alert--error" role="alert">
          {submitError}
        </div>
      )}

      <form className="auth__form" onSubmit={goNext} noValidate>
        <Field label="닉네임" hint="2~15자, 다른 사람과 겹치지 않게" error={errors.nickname} count={[nickname.trim().length, 15]}>
          <input
            className="input"
            value={nickname}
            maxLength={15}
            onChange={(e) => {
              setNickname(e.target.value)
              if (errors.nickname) setErrors((x) => ({ ...x, nickname: undefined }))
            }}
          />
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
    </div>
  )
}

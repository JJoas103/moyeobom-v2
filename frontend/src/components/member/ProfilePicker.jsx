import { useEffect, useMemo, useRef } from 'react'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX = 5 * 1024 * 1024 // 백엔드 uploadProfile 과 같은 5MB

/** 프로필 사진 고르기 (선택) — 고른 File 을 onChange 로 전달 */
export default function ProfilePicker({ file, onChange, error, onError }) {
  const inputRef = useRef(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const pick = (e) => {
    const next = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 onChange 가 오도록
    if (!next) return
    if (!IMAGE_TYPES.includes(next.type)) return onError('JPG · PNG · WEBP 사진만 올릴 수 있어요.')
    if (next.size > IMAGE_MAX) return onError('5MB 이하 사진만 올릴 수 있어요.')
    onError(null)
    onChange(next)
  }

  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <span className="field__label">
        프로필 사진<span className="field__optional">선택</span>
      </span>
      <div className="profile-pick">
        {preview ? <img className="profile-pick__preview" src={preview} alt="" /> : <span className="profile-pick__preview" />}
        <button type="button" className="btn btn--line btn--sm" onClick={() => inputRef.current?.click()}>
          {file ? '다른 사진 고르기' : '사진 고르기'}
        </button>
        {file && (
          <button
            type="button"
            className="btn btn--line btn--sm"
            onClick={() => onChange(null)}
          >
            빼기
          </button>
        )}
        <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(',')} onChange={pick} />
      </div>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

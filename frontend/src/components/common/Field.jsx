import { cloneElement, isValidElement, useId } from 'react'

/**
 * 폼 입력칸 한 줄 — 라벨 · 입력 · 도움말 · 오류 · 글자 수
 *   <Field label="모임 제목" error={errors.title} count={[title.length, 40]}>
 *     <input ... />
 *   </Field>
 * 자식 입력에 id · aria-invalid · aria-describedby 자동 연결
 */
export default function Field({ label, optional, hint, error, count, children, className = '' }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children

  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {optional && <span className="field__optional">선택</span>}
      </label>
      {control}
      {(hint || error || count) && (
        <div className="field__foot">
          {error ? (
            <span id={errorId} className="field__error" role="alert">
              {error}
            </span>
          ) : (
            hint && (
              <span id={hintId} className="field__hint">
                {hint}
              </span>
            )
          )}
          {count && (
            <span className={`field__count${count[0] > count[1] ? ' is-over' : ''}`}>
              {count[0]} / {count[1]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

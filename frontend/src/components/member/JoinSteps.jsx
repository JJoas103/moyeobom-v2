import { useEffect } from 'react'
import TastePicker from './TastePicker'
import DistrictPicker from './DistrictPicker'
import { DISTRICT_MAX } from '../../data/constants'

const STEPS = ['계정', '취향', '지역']

/** 가입 단계 표시 — ① 계정 — ② 취향 — ③ 지역 (모양은 create.css 모임 만들기 단계와 같음) */
export function JoinStepList({ current }) {
  return (
    <ol className="create-steps" aria-label="가입 단계">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li key={label} className={`create-steps__item${active ? ' is-active' : ''}${done ? ' is-done' : ''}`} aria-current={active ? 'step' : undefined}>
            <span className="create-steps__num">{n}</span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

/** 가입 ② 취향 · ③ 지역 화면 — 이메일 가입과 소셜 가입이 함께 씀. 값은 부모가 들고 있다가 ③에서 한 번에 보냄 */
export function JoinTasteSteps({ step, tastes, districts, onTastes, onDistricts, onStep, onSubmit, submitting, submitLabel, error }) {
  // 중괄호 필수 — scrollTo 가 Promise 를 돌려주는 브라우저에선 React 가 그 값을 정리 함수로 호출해 화면이 죽음
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  return (
    <div className="auth">
      <JoinStepList current={step} />
      {error && (
        <div className="auth__alert auth__alert--error" role="alert">
          {error}
        </div>
      )}

      {step === 2 ? (
        <>
          <div className="auth__head">
            <h1>어떤 행사를 좋아해요?</h1>
            <p>고른 취향으로 행사를 추천해요. 나중에 마이에서 바꿀 수 있어요.</p>
          </div>
          <TastePicker value={tastes} onChange={onTastes} />
          <div className="taste-actions">
            <span className="taste-actions__count" role="status">
              {tastes.length > 0 ? `${tastes.length}개 골랐어요` : '하나 이상 골라 주세요'}
            </span>
            <button type="button" className="btn btn--line btn--lg" onClick={() => onStep(1)}>
              이전
            </button>
            <button type="button" className="btn btn--primary btn--lg" disabled={tastes.length === 0} onClick={() => onStep(3)}>
              다음
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={onSubmit} className="auth__form" noValidate>
          <div className="auth__head">
            <h1>어디서 자주 봐요?</h1>
            <p>고른 지역의 행사를 먼저 보여 드려요. 안 골라도 괜찮아요.</p>
          </div>
          <DistrictPicker value={districts} onChange={onDistricts} />
          <div className="taste-actions">
            <span className="taste-actions__count" role="status">
              {districts.length} / {DISTRICT_MAX}곳
            </span>
            <button type="button" className="btn btn--line btn--lg" onClick={() => onStep(2)}>
              이전
            </button>
            <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
              {submitting ? '가입하는 중…' : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

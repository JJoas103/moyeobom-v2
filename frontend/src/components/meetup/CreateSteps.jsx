/** 모임 만들기 단계 표시 — ① 행사 고르기 (CreatePick) — ② 소개 · 조건 — ③ 언제 — ④ 어디서 (MeetupForm 의 STEPS) */
export default function CreateSteps({ current }) {
  const steps = ['행사 고르기', '소개 · 조건', '언제', '어디서']
  return (
    <ol className="create-steps" aria-label="모임 만들기 단계">
      {steps.map((label, i) => {
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

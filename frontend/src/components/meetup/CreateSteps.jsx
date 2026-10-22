/** 모임 만들기 단계 표시 — ① 행사 고르기 — ② 모임 정보 */
export default function CreateSteps({ current }) {
  const steps = ['행사 고르기', '모임 정보']
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

/** 켜고 끄는 스위치 — <button role="switch"> (키보드 조작 가능) */
export default function Switch({ label, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__label">{label}</span>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
    </button>
  )
}

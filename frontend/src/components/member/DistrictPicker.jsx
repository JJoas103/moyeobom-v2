import { DISTRICT_MAX, SEOUL_DISTRICTS } from '../../data/constants'
import '../../styles/taste.css'

/** 관심 지역 고르기 — 자치구 칩, 최대 DISTRICT_MAX 곳. value 는 자치구 이름 배열 */
export default function DistrictPicker({ value, onChange }) {
  const full = value.length >= DISTRICT_MAX
  const toggle = (name) => onChange(value.includes(name) ? value.filter((d) => d !== name) : [...value, name])

  return (
    <div className="district-picker" role="group" aria-label={`관심 지역, 최대 ${DISTRICT_MAX}곳`}>
      {SEOUL_DISTRICTS.map((name) => {
        const on = value.includes(name)
        return (
          <button
            key={name}
            type="button"
            className={`chip chip--outline${on ? ' is-active' : ''}`}
            aria-pressed={on}
            disabled={full && !on}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}

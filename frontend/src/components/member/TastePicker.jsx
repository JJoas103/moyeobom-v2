import { CheckIcon } from '../common/Icons'
import { CATEGORIES, POSTER_TONES } from '../../data/constants'
import '../../styles/taste.css'

/** 취향 고르기 — 음악 앱 첫 화면처럼 카테고리 타일을 눌러 여러 개 고름. value 는 카테고리 키 배열 */
export default function TastePicker({ value, onChange }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <div className="taste-picker">
      {CATEGORIES.map((category, i) => {
        const on = value.includes(category.key)
        const [bg, ink] = POSTER_TONES[i % POSTER_TONES.length]
        return (
          <button
            key={category.key}
            type="button"
            className={`taste-tile${on ? ' is-on' : ''}`}
            style={{ background: bg, color: ink }}
            aria-pressed={on}
            onClick={() => toggle(category.key)}
          >
            <span className="taste-tile__eng">{category.key.toUpperCase()}</span>
            <span className="taste-tile__label">{category.label}</span>
            {on && (
              <span className="taste-tile__check">
                <CheckIcon size={14} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

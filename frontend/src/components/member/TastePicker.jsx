import { CheckIcon } from '../common/Icons'
import { CATEGORIES } from '../../data/constants'
import { assetUrl } from '../../utils/asset'
import '../../styles/taste.css'

// 타일 사진 (public/images/category) — 비율이 달라 타일에 맞춰 잘라 채우고, 잘릴 때 남길 부분은 position 으로
const TILE_IMAGES = {
  performance: { file: '공연', position: '50% 50%' },
  play: { file: '연극', position: '50% 45%' },
  film: { file: '영화', position: '50% 45%' },
  exhibition: { file: '전시', position: '65% 50%' },
  festival: { file: '축제', position: '50% 55%' },
  classic: { file: '클래식', position: '50% 60%' },
}

/** 취향 고르기 — 음악 앱 첫 화면처럼 카테고리 타일을 눌러 여러 개 고름. value 는 카테고리 키 배열 */
export default function TastePicker({ value, onChange }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <div className="taste-picker">
      {CATEGORIES.map((category) => {
        const on = value.includes(category.key)
        const image = TILE_IMAGES[category.key]
        return (
          <button
            key={category.key}
            type="button"
            className={`taste-tile${on ? ' is-on' : ''}`}
            aria-pressed={on}
            onClick={() => toggle(category.key)}
          >
            <img
              className="taste-tile__img"
              src={assetUrl(`/images/category/${image.file}.jpg`)}
              alt=""
              style={{ objectPosition: image.position }}
            />
            <span className="taste-tile__eng">{category.key}</span>
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

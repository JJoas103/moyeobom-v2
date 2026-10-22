import { CATEGORIES } from '../../data/constants'

/** 전체 + 카테고리 칩. value 는 카테고리 key ('' = 전체) */
export default function CategoryChips({ value, onChange, label = '분류' }) {
  const items = [{ key: '', label: '전체' }, ...CATEGORIES]
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {items.map((c) => (
        <button
          key={c.key || 'all'}
          type="button"
          className={`chip${value === c.key ? ' is-active' : ''}`}
          aria-pressed={value === c.key}
          onClick={() => onChange(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

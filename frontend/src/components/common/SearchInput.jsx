import { useId } from 'react'
import { SearchIcon } from './Icons'

/** 둥근 검색창 */
export default function SearchInput({ value, onChange, placeholder, label = '검색', width = 360 }) {
  const id = useId()
  return (
    <div className="search-input" style={{ width }}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="search-input__icon">
        <SearchIcon />
      </span>
      <input id={id} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

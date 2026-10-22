import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDownIcon } from './Icons'

/**
 * 필터 드롭다운 — '지역 ⌄' 버튼으로 선택지 열기
 * options: [{ value, label }] / value: 현재 값 ('' = 선택 안 함)
 * disabledNote: 있으면 메뉴 대신 안내 문구만 (미결정 필터용)
 */
export default function FilterMenu({ label, value = '', options = [], onChange, disabledNote }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value && o.value !== '')
  const active = Boolean(selected)

  return (
    <div className="filter-menu" ref={wrapRef}>
      <button
        type="button"
        className={`chip chip--outline filter-menu__trigger${active ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? selected.label : label}
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="filter-menu__panel" id={menuId}>
          {disabledNote ? (
            <p className="filter-menu__note">{disabledNote}</p>
          ) : (
            <ul>
              {options.map((o) => (
                <li key={o.value || 'all'}>
                  <button
                    type="button"
                    className={`filter-menu__option${o.value === value ? ' is-selected' : ''}`}
                    aria-pressed={o.value === value}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

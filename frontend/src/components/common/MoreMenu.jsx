import { useEffect, useRef, useState } from 'react'
import { MoreIcon } from './Icons'

/**
 * ⋯ 버튼 + 작은 메뉴 — 바깥 클릭 · Esc 로 닫힘
 *   items: [{ label, onSelect, danger? }]
 */
export default function MoreMenu({ label, items, size = 40 }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="more-menu" ref={boxRef}>
      <button
        type="button"
        className={`more-menu__btn${open ? ' is-open' : ''}`}
        style={{ width: size, height: size }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="more-menu__panel" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`more-menu__item${item.danger ? ' is-danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import { Fragment } from 'react'

/** 짧은 정보 나열 — 가운뎃점 대신 간격으로 나눔. 빈 값은 건너뜀 */
export default function MetaLine({ items }) {
  return items.filter(Boolean).map((item, i) => (
    <Fragment key={i}>
      {i > 0 && ' '}
      <span className="meta-item">{item}</span>
    </Fragment>
  ))
}

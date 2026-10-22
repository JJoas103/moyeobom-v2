/** 필터 결과 없음 — DataState 의 emptyText 로 사용 */
export default function EmptyResult({ title, hint = '필터를 줄이거나 기간을 넓혀 보세요.', onReset, action }) {
  return (
    <>
      <strong>{title}</strong>
      {hint}
      <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
        {onReset && (
          <button type="button" className="btn btn--line" onClick={onReset}>
            필터 초기화
          </button>
        )}
        {action}
      </div>
    </>
  )
}

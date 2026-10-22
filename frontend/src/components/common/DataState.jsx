// useAsync 의 loading / error 상태를 화면마다 같은 모양으로 표시
export default function DataState({ loading, error, empty, emptyText = '아직 내용이 없어요', children }) {
  if (loading) return <div className="state-box">불러오는 중...</div>
  if (error)
    return (
      <div className="state-box" role="alert">
        <strong>불러오지 못했어요</strong>
        {error.message}
      </div>
    )
  if (empty) return <div className="state-box">{emptyText}</div>
  return children
}

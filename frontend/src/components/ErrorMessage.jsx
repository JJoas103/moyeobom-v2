import { Link } from 'react-router-dom'

export default function ErrorMessage({ title = '페이지를 찾을 수 없어요', message = '주소가 바뀌었거나 없는 페이지예요.' }) {
  return (
    <div className="state-box">
      <strong>{title}</strong>
      <p>{message}</p>
      <Link to="/" className="btn btn--line" style={{ marginTop: 24 }}>
        홈으로
      </Link>
    </div>
  )
}

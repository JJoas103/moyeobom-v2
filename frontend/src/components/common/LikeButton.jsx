import { useLocation, useNavigate } from 'react-router-dom'
import { HeartIcon } from './Icons'
import { useAuth } from '../../context/AuthContext'
import { useLikes } from '../../context/LikesContext'

/**
 * 찜 하트 — 로그인 전이면 로그인 화면으로
 *   type: 'event' | 'meetup' · variant: 'card'(포스터 위 동그라미) | 'box'(글자 있는 네모 버튼)
 */
export default function LikeButton({ type, id, variant = 'card' }) {
  const { user } = useAuth()
  const { isLiked, toggle } = useLikes()
  const navigate = useNavigate()
  const location = useLocation()
  const liked = isLiked(type, id)

  const onClick = () => {
    if (!user) {
      navigate('/member/login', { state: { from: location.pathname + location.search } })
      return
    }
    toggle(type, id, !liked)
  }

  const common = { type: 'button', 'aria-label': liked ? '찜 해제' : '찜하기', 'aria-pressed': liked, onClick }

  return variant === 'box' ? (
    <button {...common} className={`like-btn${liked ? ' is-on' : ''}`}>
      <HeartIcon size={20} filled={liked} />
      <span>찜</span>
    </button>
  ) : (
    <button {...common} className="card__like">
      <span className={`card__like-circle${liked ? ' is-on' : ''}`}>
        <HeartIcon filled={liked} />
      </span>
    </button>
  )
}

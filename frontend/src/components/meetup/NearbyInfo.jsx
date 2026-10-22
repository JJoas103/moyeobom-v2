import SectionHead from '../common/SectionHead'
import { RestroomIcon, TrainIcon } from '../common/Icons'
import { useAsync } from '../../utils/useAsync'
import { fetchNearby } from '../../data/nearby'

// 모임 상세 '행사장 근처' — 가까운 역 · 화장실. 행사장 좌표 기준 (이야기 자리는 승인 후 공개라 사용 안 함)
export default function NearbyInfo({ event }) {
  const lat = event?.location?.lat
  const lng = event?.location?.lng
  const { data, loading, error } = useAsync(
    () => (lat == null || lng == null ? Promise.resolve(null) : fetchNearby({ lat, lng })),
    [lat, lng],
  )

  // 좌표 없는 행사(영화 등) · 불러오기 실패는 섹션째 숨김 (부가 정보라 오류 표시 안 함)
  if (lat == null || lng == null || error) return null

  return (
    <section className="detail-section">
      <SectionHead title="행사장 근처" />
      {loading && !data ? (
        <div className="state-box">불러오는 중...</div>
      ) : (
        <div className="nearby">
          <div className="nearby__col">
            <h3 className="nearby__head">
              <TrainIcon />
              가까운 역
            </h3>
            {data.stations.length === 0 ? (
              <p className="nearby__empty">걸어갈 만한 거리에 역이 없어요</p>
            ) : (
              <ul className="nearby__list">
                {data.stations.map((s) => (
                  <li key={s.name} className="nearby__item">
                    <span className="nearby__name">{s.name}</span>
                    <span className="nearby__meta">
                      {s.lines.join(' · ')} · 도보 약 {s.walkMinutes}분
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="nearby__col">
            <h3 className="nearby__head">
              <RestroomIcon />
              공중화장실
            </h3>
            {data.toilets.length === 0 ? (
              <p className="nearby__empty">가까운 공중화장실 정보가 없어요</p>
            ) : (
              <ul className="nearby__list">
                {data.toilets.map((t) => (
                  <li key={t._id} className="nearby__item">
                    <span className="nearby__name">{t.name}</span>
                    <span className="nearby__meta">
                      도보 약 {t.walkMinutes}분 · {t.is24h ? '24시간' : t.hoursText || '개방 시간 정보 없음'}
                    </span>
                    {(t.emergencyBell || t.cctv) && (
                      <span className="nearby__tags">
                        {t.emergencyBell && <span className="tag">비상벨</span>}
                        {t.cctv && <span className="tag">CCTV</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <p className="detail-note">행사장 기준 직선거리예요. 출처: 서울 열린데이터광장</p>
    </section>
  )
}

// 좌표 근처 화장실 · 지하철역 — 공공데이터를 DB에 받아 둔 것이라 목업 없이 항상 실제 API
//
// 응답 모양 (GET /api/nearby?lat=&lng=):
//   stations: [{ name: '혜화역', lines: ['4호선'], distance(m), walkMinutes }]           — 가까운 순 최대 3곳 (1.5km 안)
//   toilets:  [{ _id, name, address, lat, lng, distance(m), walkMinutes, openType, hoursText,
//                is24h, emergencyBell, cctv, diaperTable, placeType }]                    — 공공개방만, 가까운 순 최대 3곳 (800m 안)
//   distance · walkMinutes 는 직선거리 기준
import { apiGet } from '../api'

export async function fetchNearby({ lat, lng }) {
  const { toilets, stations } = await apiGet('/api/nearby', { params: { lat, lng } })
  return { toilets, stations }
}

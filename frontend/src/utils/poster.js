import { POSTER_TONES } from '../data/constants'

/** 포스터 이미지가 없을 때 _id 기준 고정 톤 → { bg, ink } */
export function posterTone(id = '') {
  let hash = 0
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const [bg, ink] = POSTER_TONES[hash % POSTER_TONES.length]
  return { bg, ink }
}

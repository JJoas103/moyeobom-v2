const { PAGE_SIZE, fetchPage } = require('./seoulOpenApi');

// 서울시 문화행사 정보 (서울 열린데이터광장 culturalEventInfo) → Event 모양으로 변환
// 실제 응답 필드는 scripts/checkSeoulCulture.js 로 확인한 것 기준.

const SERVICE = 'culturalEventInfo';

// CODENAME → { category, subtitle, genre? }
// genre 가 비면 CODENAME 그대로 사용. null = 저장 안 하는 분류
// 교육/체험 · 기타 — 참여형 수업·신청제·어린이 대상·장터/포럼이 대부분이라 '보고 이야기하는 모임'과 맞지 않아 제외
const CATEGORY_MAP = {
  콘서트: { category: 'performance', subtitle: 'CONCERT' },
  '뮤지컬/오페라': { category: 'performance', subtitle: 'MUSICAL' },
  무용: { category: 'performance', subtitle: 'DANCE' },
  연극: { category: 'play', subtitle: 'PLAY' },
  영화: { category: 'film', subtitle: 'FILM' },
  '전시/미술': { category: 'exhibition', subtitle: 'EXHIBITION' },
  클래식: { category: 'classic', subtitle: 'CLASSIC' },
  국악: { category: 'classic', subtitle: 'GUGAK' },
  '독주/독창회': { category: 'classic', subtitle: 'RECITAL' },
  // 축제-문화/예술 · 축제-기타 · 축제-전통/역사 ... 는 아래 mapCategory 에서 처리
  '교육/체험': null,
  기타: null,
};

const RUN_TYPE = {
  performance: 'session',
  play: 'session',
  classic: 'session',
  film: 'screening',
  exhibition: 'period',
  festival: 'period',
};

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function mapCategory(codeName) {
  const code = clean(codeName);
  if (code.startsWith('축제')) {
    const genre = code.replace(/^축제-?/, '');
    return { category: 'festival', subtitle: 'FESTIVAL', genre: genre && genre !== '기타' ? genre : '축제' };
  }
  const mapped = CATEGORY_MAP[code];
  if (!mapped) return null;
  return { ...mapped, genre: mapped.genre || code };
}

// 좌표 — 표기가 섞여 있다: '37.5512' · '37.5718961547884~2' · '37°32'05.0"N' · '45.4215°N' · '-' · ''
function parseCoord(value) {
  const s = clean(value);
  if (!s || s === '-') return null;

  const dms = s.match(/^(\d+)°\s*(\d+)['′]\s*([\d.]+)["″]?\s*([NSEW])?$/i);
  if (dms) {
    const deg = Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600;
    return /[SW]/i.test(dms[4] || '') ? -deg : deg;
  }
  const decimal = s.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?/i); // 뒤에 붙은 '~2' 같은 꼬리 제거
  if (!decimal) return null;
  const num = Number(decimal[1]);
  return /[SW]/i.test(decimal[2] || '') ? -num : num;
}

// 국내 범위 밖 · 파싱 실패면 null (지도 미표시)
function parseLocation(latRaw, lngRaw) {
  let lat = parseCoord(latRaw);
  let lng = parseCoord(lngRaw);
  if (lat === null || lng === null) return null;
  if (lat > 100 && lng < 100) [lat, lng] = [lng, lat]; // 혹시 뒤바뀐 경우
  const inKorea = lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
  return inKorea ? { lat, lng } : null;
}

// 'YYYY-MM-DD 00:00:00.0' — 날짜만 의미 있음 (시각은 항상 0시). 서울 시간 기준 저장
function parseDate(value, { endOfDay = false } = {}) {
  const m = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${time}+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// PRO_TIME — '19:00~20:30' · '10:00 ~ 19:00' · '19:00-20:30' → '19:00 – 20:30' 으로 통일
function normalizeTimeText(value) {
  return clean(value)
    .replace(/(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})/g, '$1 – $2')
    .replace(/\s+/g, ' ');
}

// 회차형 + 시간이 '19:00 – 20:30' 하나뿐일 때만 러닝타임(분)으로 계산
function runningTimeFrom(timeText) {
  const m = timeText.match(/^(\d{1,2}):(\d{2}) – (\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const minutes = Number(m[3]) * 60 + Number(m[4]) - (Number(m[1]) * 60 + Number(m[2]));
  return minutes > 0 && minutes <= 300 ? minutes : null;
}

function priceTextOf(row) {
  const fee = clean(row.USE_FEE);
  if (fee) return fee;
  const isFree = clean(row.IS_FREE);
  return isFree === '무료' || isFree === '유료' ? isFree : '';
}

// 출처 ID — 응답에 따로 없음 → 상세 링크(HMPG_ADDR)의 cultcode 사용 (행사마다 고유)
const sourceIdOf = (row) => (clean(row.HMPG_ADDR).match(/cultcode=(\d+)/) || [])[1] || null;

/**
 * 응답 1건 → Event 필드. 저장하지 않을 건이면 { skip: '이유' }
 * 이미 끝난 행사(종료일 < 가져오는 날)는 제외. 종료일 당일까지는 포함
 */
function toEvent(row, { now = new Date() } = {}) {
  const id = sourceIdOf(row);
  if (!id) return { skip: 'no-id' };

  const mapped = mapCategory(row.CODENAME);
  if (!mapped) return { skip: 'category' };

  const title = clean(row.TITLE);
  const startDate = parseDate(row.STRTDATE);
  if (!title || !startDate) return { skip: 'invalid' };

  const endDate = parseDate(row.END_DATE, { endOfDay: true }); // 종료일 23:59:59 (서울)
  if (endDate && endDate < now) return { skip: 'ended' };

  const runType = RUN_TYPE[mapped.category];
  const sessionsText = normalizeTimeText(row.PRO_TIME);

  return {
    event: {
      title,
      subtitle: mapped.subtitle,
      category: mapped.category,
      genre: mapped.genre,
      runType,
      startDate,
      endDate,
      sessionsText,
      runningTime: runType === 'session' ? runningTimeFrom(sessionsText) : null,
      venue: clean(row.PLACE),
      address: '', // 응답에 주소 필드 없음
      district: clean(row.GUNAME),
      area: '',
      location: parseLocation(row.LAT, row.LOT),
      priceText: priceTextOf(row),
      posterUrl: clean(row.MAIN_IMG),
      bookingUrl: /^https?:\/\//.test(clean(row.ORG_LINK)) ? clean(row.ORG_LINK) : '',
      ageLimit: clean(row.USE_TRGT),
      cast: clean(row.PLAYER),
      description: clean(row.PROGRAM),
      source: { name: 'SEOUL', id, url: clean(row.HMPG_ADDR) },
    },
  };
}

module.exports = {
  PAGE_SIZE,
  toEvent,
  fetchPage: (start, end) => fetchPage(SERVICE, start, end),
};

const { PAGE_SIZE, fetchPage, inSeoulArea, clean } = require('./seoulOpenApi');

// 서울시 공중화장실 위치정보 (mgisToiletPoi) → Toilet 모양
// 실제 응답 확인: COORD_X = 경도, COORD_Y = 위도 (숫자). VALUE_* 는 '값|값|' 처럼 | 로 끝나는 목록
const SERVICE = 'mgisToiletPoi';

// '비상벨(남)|비상벨(여)|' → ['비상벨(남)', '비상벨(여)']
const listOf = (value) => clean(value).split('|').map((s) => s.trim()).filter(Boolean);

function toToilet(row) {
  const id = clean(row.OBJECTID);
  const name = clean(row.CONTS_NAME);
  const lat = Number(row.COORD_Y);
  const lng = Number(row.COORD_X);
  if (!id || !name || !inSeoulArea(lat, lng)) return { skip: 'invalid' };

  // '기타|06:00~24:00|' → '06:00~24:00' (구분용 '기타' 제외)
  const hourParts = listOf(row.VALUE_02);
  const hours = (hourParts.length > 1 ? hourParts.filter((p) => p !== '기타') : hourParts).join(' ');
  const safety = clean(row.VALUE_07);

  return {
    doc: {
      name,
      address: clean(row.ADDR_NEW) || clean(row.ADDR_OLD),
      district: clean(row.GU_NAME),
      location: { type: 'Point', coordinates: [lng, lat] },
      openType: listOf(row.VALUE_01)[0] || '',
      hoursText: hours,
      is24h: /24시간/.test(hours),
      emergencyBell: /비상벨/.test(safety),
      cctv: /CCTV/i.test(safety),
      diaperTable: /기저귀/.test(clean(row.VALUE_06)),
      placeType: listOf(row.VALUE_08)[0] || '',
      source: { name: 'SEOUL', id },
    },
  };
}

module.exports = {
  SERVICE,
  PAGE_SIZE,
  fetchPage: (start, end) => fetchPage(SERVICE, start, end),
  toToilet,
};

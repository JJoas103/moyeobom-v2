const { PAGE_SIZE, fetchPage, clean } = require('./seoulOpenApi');

// 서울시 역사마스터 정보 (subwayStationMaster) → Station 모양
// 실제 응답 확인: LAT = 위도, LOT = 경도 (문자열). 수도권 전체 784건 — 서울 밖 역도 유지
const SERVICE = 'subwayStationMaster';

function toStation(row) {
  const id = clean(row.BLDN_ID);
  const name = clean(row.BLDN_NM);
  const line = clean(row.ROUTE);
  const lat = Number(row.LAT);
  const lng = Number(row.LOT);
  const inKorea = lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
  if (!id || !name || !line || !inKorea) return { skip: 'invalid' };

  return {
    doc: {
      name,
      line,
      location: { type: 'Point', coordinates: [lng, lat] },
      source: { name: 'SEOUL', id },
    },
  };
}

module.exports = {
  SERVICE,
  PAGE_SIZE,
  fetchPage: (start, end) => fetchPage(SERVICE, start, end),
  toStation,
};

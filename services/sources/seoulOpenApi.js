const axios = require('axios');

// 서울 열린데이터광장 공통 호출 — http://openapi.seoul.go.kr:8088/{KEY}/json/{SERVICE}/{start}/{end}/
const PAGE_SIZE = 1000; // 한 번 호출에 최대 1000건

/** start ~ end 번째 행 (1부터) → { total, rows } */
async function fetchPage(service, start, end) {
  const key = process.env.SEOUL_OPEN_API;
  if (!key) throw new Error('.env 에 SEOUL_OPEN_API 가 없습니다');
  const { data } = await axios.get(`http://openapi.seoul.go.kr:8088/${key}/json/${service}/${start}/${end}/`, {
    timeout: 30000,
  });
  const body = data[service];
  if (!body) {
    // 결과 없음 등은 최상위 RESULT 로 옴 — 메시지에 키가 섞이지 않게 코드만
    throw new Error(`서울시 API 응답 오류 (${service}): ${data.RESULT?.CODE || '알 수 없음'}`);
  }
  return { total: body.list_total_count, rows: body.row || [] };
}

// 서울 근처인지 — 빈 좌표 · 뒤바뀐 좌표 거르기
const inSeoulArea = (lat, lng) => lat > 37.3 && lat < 37.8 && lng > 126.6 && lng < 127.3;

const clean = (value) => (value == null ? '' : String(value).trim());

module.exports = { PAGE_SIZE, fetchPage, inSeoulArea, clean };

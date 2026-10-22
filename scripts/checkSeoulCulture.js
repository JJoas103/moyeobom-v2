// 서울시 문화행사 정보 API 1회 호출 — 실제 응답 확인용 (DB 저장 안 함)
// 실행: node scripts/checkSeoulCulture.js [가져올 건수, 기본 1000]
require('dotenv').config();
const axios = require('axios');

const KEY = process.env.SEOUL_OPEN_API;
const SERVICE = 'culturalEventInfo';
const LIMIT = Math.min(Number(process.argv[2]) || 1000, 1000); // 한 번에 최대 1000건

// 값의 표기 방식을 대략 분류 — 같은 컬럼에 형식이 섞여 있는지 보려고
function shapeOf(value) {
  if (value === null || value === undefined) return 'null';
  const s = String(value).trim();
  if (s === '') return '(빈 값)';
  return s
    .replace(/[0-9]/g, '9')
    .replace(/[가-힣]+/g, '가')
    .replace(/[A-Za-z]+/g, 'a')
    .slice(0, 40);
}

async function main() {
  if (!KEY) throw new Error('.env 에 SEOUL_OPEN_API 가 없습니다');

  const url = `http://openapi.seoul.go.kr:8088/${KEY}/json/${SERVICE}/1/${LIMIT}/`;
  const { data } = await axios.get(url, { timeout: 20000 });
  const body = data[SERVICE];
  if (!body) {
    console.log('예상과 다른 응답:', JSON.stringify(data).slice(0, 500));
    return;
  }

  const rows = body.row || [];
  console.log('결과 코드:', body.RESULT?.CODE, body.RESULT?.MESSAGE);
  console.log('전체 건수(list_total_count):', body.list_total_count);
  console.log('이번에 받은 건수:', rows.length);
  if (!rows.length) return;

  console.log('\n── 필드 이름 ──');
  console.log(Object.keys(rows[0]).join(', '));

  console.log('\n── 샘플 1건 ──');
  console.log(JSON.stringify(rows[0], null, 2));

  // 컬럼별 표기 방식 분포 (상위 5개 + 예시 값)
  console.log(`\n── 컬럼별 표기 방식 (${rows.length}건 기준) ──`);
  for (const field of Object.keys(rows[0])) {
    const shapes = new Map();
    for (const row of rows) {
      const shape = shapeOf(row[field]);
      const entry = shapes.get(shape) || { count: 0, example: row[field] };
      entry.count += 1;
      shapes.set(shape, entry);
    }
    const top = [...shapes.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    console.log(`\n${field}  (형식 ${shapes.size}종)`);
    for (const [shape, { count, example }] of top) {
      console.log(`  ${String(count).padStart(5)}  ${shape.padEnd(42)} 예: ${String(example).slice(0, 60)}`);
    }
  }

  // 분류 값 전체 목록 — category 매핑표용
  const codeField = Object.keys(rows[0]).find((k) => k === 'CODENAME');
  if (codeField) {
    const counts = {};
    for (const row of rows) counts[row[codeField]] = (counts[row[codeField]] || 0) + 1;
    console.log('\n── 분류(CODENAME) 값 ──');
    console.log(counts);
  }
}

main().catch((err) => {
  // axios 에러 메시지에 URL(인증키 포함)이 섞이지 않게 상태만 출력
  console.error('호출 실패:', err.response?.status || err.code || err.message);
  process.exit(1);
});

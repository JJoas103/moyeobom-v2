/**
 * MongoDB 검색 조건(객체) 만들기 연습
 *
 * 실행:  node practice-mongo-filter.js
 *
 * 푸는 법
 * - 각 문제 함수 안의 `return undefined;` 를 지우고 답을 써요.
 * - 저장하고 다시 실행하면 [통과] / [틀림] 이 나와요.
 * - 통과하면 "이 조건에 맞는 행사"도 같이 보여줘요. MongoDB가 실제로 해 주는 일을 흉내 낸 거예요.
 * - 막히면 파일 맨 아래 정답을 봐요. (먼저 직접 풀어 보기!)
 *
 * 난이도
 * - 1단계 매우 쉬움: 객체 그대로 쓰기
 * - 2단계 쉬움:      if 로 객체 · 배열 채우기
 * - 3단계 보통:      비교 연산자 ($gte, $lte, $or, $in, $regex)
 * - 4단계 실전:      listEvents 미니 버전 만들기
 */

const assert = require('assert');

// 연습용 "지금" 시각과 날짜 만들기 도우미
const NOW = new Date('2026-10-16T00:00:00+09:00');
const d = (s) => new Date(`${s}T00:00:00+09:00`);

// 연습용 행사 데이터 — DB(Event 컬렉션)에 이런 문서가 저장돼 있다고 생각해요
const EVENTS = [
  { title: '햄릿', category: 'play', district: '종로구', startDate: d('2026-10-01'), endDate: d('2026-10-30') },
  { title: '레미제라블', category: 'performance', district: '중구', startDate: d('2026-09-01'), endDate: d('2026-10-10') },
  { title: '가을 사진전', category: 'exhibition', district: '종로구', startDate: d('2026-10-20'), endDate: d('2026-11-30') },
  { title: '영화 햄릿 상영회', category: 'film', district: '마포구', startDate: d('2026-10-16'), endDate: d('2026-10-17') },
  { title: '상설 한국 미술展', category: 'exhibition', district: '용산구', startDate: d('2025-01-01'), endDate: null },
];

// =====================================================================
// 1단계 — 매우 쉬움: 객체 그대로 쓰기
// =====================================================================

/**
 * 문제 1. 아무 조건도 없는 필터를 만들어요. (= 전체 조회)
 * 결과 예: {}
 */
function q1() {
  return {}
}

/**
 * 문제 2. 카테고리가 'play' 인 행사를 찾는 필터를 만들어요.
 * 결과 예: { category: 'play' }
 */
function q2() {
  return { category: 'play'}
}

/**
 * 문제 3. 카테고리가 'play' 이고, 구가 '종로구' 인 행사를 찾는 필터를 만들어요.
 * 키 두 개를 한 객체에 넣으면 "둘 다 만족"이라는 뜻이에요.
 */
function q3() {
  return { category: 'play', district: '종로구'}
}

/**
 * 문제 4. 받은 category 로 필터를 만들어요.
 * 힌트: 변수 이름과 키 이름이 같으면 { category: category } 를 { category } 로 줄여 쓸 수 있어요.
 * q4('film') → { category: 'film' }
 */
function q4(category) {
  return {category}
}

// =====================================================================
// 2단계 — 쉬움: if 로 객체 · 배열 채우기
// =====================================================================

/**
 * 문제 5. category 가 있을 때만 조건을 넣어요.
 * q5('film') → { category: 'film' }
 * q5('')     → {}
 * 힌트: 빈 문자열 '' 은 if 에서 거짓이에요.
 */
function q5(category) {
  if(!category) return {}
  return {category}
}

/**
 * 문제 6. category, district 중 값이 있는 것만 필터 객체에 넣어요.
 * q6({ category: 'play', district: '종로구' }) → { category: 'play', district: '종로구' }
 * q6({ category: '', district: '종로구' })     → { district: '종로구' }
 * q6({ category: '', district: '' })           → {}
 * 힌트: const filter = {}; 로 시작해서 filter.category = ... 처럼 넣어요.
 */
function q6({ category, district }) {
  /*
  if(!category && !district) return {}
  if(!category) return {district}
  return {category, district}  
  */
  const filter = {};
  if (category) filter.category = category;
  if (district) filter.district = district;
  return filter;
  }

/**
 * 문제 7. 문제 6과 같은데, 이번엔 객체가 아니라 "조건 배열"로 만들어요. (listEvents 의 and 배열 방식)
 * 순서: category 먼저, 그다음 district
 * q7({ category: 'play', district: '종로구' }) → [{ category: 'play' }, { district: '종로구' }]
 * q7({ category: '', district: '종로구' })     → [{ district: '종로구' }]
 * q7({ category: '', district: '' })           → []
 * 힌트: const and = []; 로 시작해서 and.push({ ... }) 해요.
 */
function q7({ category, district }) {
  
  const and = [];
  if(category) and.push({category});
  if(district) and.push({district});
  return and;
}

// =====================================================================
// 3단계 — 보통: 비교 연산자
//   { 필드: { $연산자: 값 } } 모양이에요.
//   $gte 이상(>=) · $lte 이하(<=) · $gt 초과(>) · $lt 미만(<)
// =====================================================================

/**
 * 문제 8. 종료일(endDate)이 now 이상인 행사 = 아직 안 끝난 행사.
 * 결과 예: { endDate: { $gte: now } }
 */
function q8(now) {
  
  return undefined;
}

/**
 * 문제 9. 시작일(startDate)이 from 이상, to 이하인 행사.
 * 힌트: 한 필드에 연산자 두 개를 같이 넣을 수 있어요. { startDate: { $gte: ..., $lte: ... } }
 */
function q9(from, to) {
  return undefined;
}

/**
 * 문제 10. "종료일이 없거나(null) 종료일이 now 이상"인 행사.
 * '또는'은 $or 에 조건 배열을 넣어요. 순서: null 조건 먼저.
 * 결과 예: { $or: [ {조건1}, {조건2} ] }
 * (listEvents 100줄과 같은 조건이에요)
 */
function q10(now) {
  return undefined;
}

/**
 * 문제 11. 카테고리가 list 안에 있는 것 중 하나인 행사.
 * q11(['play', 'film']) → { category: { $in: ['play', 'film'] } }
 */
function q11(list) {
  return undefined;
}

/**
 * 문제 12. 제목에 word 가 들어간 행사 (대소문자 무시).
 * 결과 예: { title: { $regex: word, $options: 'i' } }
 */
function q12(word) {
  return undefined;
}

// =====================================================================
// 4단계 — 실전: listEvents 미니 버전
// =====================================================================

/**
 * 문제 13. 조건 배열을 받아 최종 필터로 바꿔요.
 * - 배열이 비었으면 {}
 * - 아니면 { $and: 배열 }
 * q13([])                      → {}
 * q13([{ category: 'play' }])  → { $and: [{ category: 'play' }] }
 * 힌트: 삼항 연산자  조건 ? 참일 때 : 거짓일 때
 */
function q13(and) {
  return undefined;
}

/**
 * 문제 14. 함정 문제 — 아래 두 조건을 "둘 다" 만족하는 필터를 만들어요.
 *   조건 A: 종료일이 없거나, now 이상    (안 끝난 행사)
 *   조건 B: 종료일이 없거나, from 이상   (기간 필터)
 *
 * 이렇게 하면 틀려요. 왜 그런지 생각해 봐요:
 *   const filter = {};
 *   filter.$or = [ ...조건 A... ];
 *   filter.$or = [ ...조건 B... ];   // ← 같은 키라서 A를 덮어써요!
 *
 * 그래서 $and 배열에 A, B 를 따로 넣어요. 순서: A 먼저.
 * 결과 예: { $and: [ { $or: [...] }, { $or: [...] } ] }
 */
function q14(now, from) {
  return undefined;
}

/**
 * 문제 15. 최종 — listEvents 미니 버전.
 * 받은 값으로 조건 배열을 만들고, 문제 13처럼 최종 필터로 바꿔요.
 * 조건을 넣는 순서:
 *   1) includeEnded 가 false 면 → "종료일이 없거나 now 이상" ($or, 문제 10)
 *   2) category 가 있으면 → { category }
 *   3) district 가 있으면 → { district }
 *   4) q 가 있으면 → 제목 검색 (문제 12)
 *
 * q15({ includeEnded: true }, now)                         → {}
 * q15({ includeEnded: false }, now)                        → { $and: [ {$or 조건} ] }
 * q15({ category: 'play', q: '햄릿', includeEnded: false }, now)
 *   → { $and: [ {$or 조건}, { category: 'play' }, { title: { $regex: '햄릿', $options: 'i' } } ] }
 */
function q15({ category = '', district = '', q = '', includeEnded = false }, now) {
  return undefined;
}

// =====================================================================
// 여기부터는 채점 코드예요. 고치지 않아도 돼요.
// =====================================================================

const notEnded = (now) => ({ $or: [{ endDate: null }, { endDate: { $gte: now } }] });

const EXERCISES = [
  { no: 1, level: 1, run: () => q1(), expected: {} },
  { no: 2, level: 1, run: () => q2(), expected: { category: 'play' } },
  { no: 3, level: 1, run: () => q3(), expected: { category: 'play', district: '종로구' } },
  { no: 4, level: 1, run: () => q4('film'), expected: { category: 'film' } },

  { no: 5, level: 2, run: () => q5('film'), expected: { category: 'film' } },
  { no: 5, level: 2, run: () => q5(''), expected: {} },
  { no: 6, level: 2, run: () => q6({ category: 'play', district: '종로구' }), expected: { category: 'play', district: '종로구' } },
  { no: 6, level: 2, run: () => q6({ category: '', district: '종로구' }), expected: { district: '종로구' } },
  { no: 6, level: 2, run: () => q6({ category: '', district: '' }), expected: {} },
  { no: 7, level: 2, run: () => q7({ category: 'play', district: '종로구' }), expected: [{ category: 'play' }, { district: '종로구' }], notFilter: true },
  { no: 7, level: 2, run: () => q7({ category: '', district: '종로구' }), expected: [{ district: '종로구' }], notFilter: true },
  { no: 7, level: 2, run: () => q7({ category: '', district: '' }), expected: [], notFilter: true },

  { no: 8, level: 3, run: () => q8(NOW), expected: { endDate: { $gte: NOW } } },
  { no: 9, level: 3, run: () => q9(d('2026-10-15'), d('2026-10-21')), expected: { startDate: { $gte: d('2026-10-15'), $lte: d('2026-10-21') } } },
  { no: 10, level: 3, run: () => q10(NOW), expected: notEnded(NOW) },
  { no: 11, level: 3, run: () => q11(['play', 'film']), expected: { category: { $in: ['play', 'film'] } } },
  { no: 12, level: 3, run: () => q12('햄릿'), expected: { title: { $regex: '햄릿', $options: 'i' } } },

  { no: 13, level: 4, run: () => q13([]), expected: {} },
  { no: 13, level: 4, run: () => q13([{ category: 'play' }]), expected: { $and: [{ category: 'play' }] } },
  {
    no: 14,
    level: 4,
    run: () => q14(NOW, d('2026-10-20')),
    expected: { $and: [notEnded(NOW), { $or: [{ endDate: null }, { endDate: { $gte: d('2026-10-20') } }] }] },
  },
  { no: 15, level: 4, run: () => q15({ includeEnded: true }, NOW), expected: {} },
  { no: 15, level: 4, run: () => q15({ includeEnded: false }, NOW), expected: { $and: [notEnded(NOW)] } },
  {
    no: 15,
    level: 4,
    run: () => q15({ category: 'play', q: '햄릿', includeEnded: false }, NOW),
    expected: { $and: [notEnded(NOW), { category: 'play' }, { title: { $regex: '햄릿', $options: 'i' } }] },
  },
];

/** MongoDB 가 문서 하나가 조건에 맞는지 보는 일을 아주 단순하게 흉내 내요 */
function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$and') return cond.every((f) => matches(doc, f));
    if (key === '$or') return cond.some((f) => matches(doc, f));

    const value = doc[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (typeof cond !== 'object') return value === cond;

    // { $gte: ..., $lte: ... } 같은 연산자 객체
    return Object.entries(cond).every(([op, arg]) => {
      if (op === '$options') return true;
      if (value === null || value === undefined) return false;
      switch (op) {
        case '$gte': return value >= arg;
        case '$lte': return value <= arg;
        case '$gt': return value > arg;
        case '$lt': return value < arg;
        case '$in': return arg.includes(value);
        case '$regex': return new RegExp(arg, cond.$options || '').test(value);
        default: throw new Error(`연습용 채점기는 ${op} 를 몰라요`);
      }
    });
  });
}

const show = (v) => JSON.stringify(v, (k, val) => (val === undefined ? '(undefined)' : val));

let passed = 0;
let todo = 0;
let lastLevel = 0;
for (const ex of EXERCISES) {
  if (ex.level !== lastLevel) {
    console.log(`\n===== ${ex.level}단계 =====`);
    lastLevel = ex.level;
  }

  let result;
  try {
    result = ex.run();
  } catch (err) {
    console.log(`[에러]  문제 ${ex.no}: ${err.message}`);
    continue;
  }

  if (result === undefined) {
    console.log(`[  -  ]  문제 ${ex.no}: 아직 안 풀었어요`);
    todo += 1;
    continue;
  }

  try {
    assert.deepStrictEqual(result, ex.expected);
    passed += 1;
    let line = `[통과]  문제 ${ex.no}: ${show(result)}`;
    if (!ex.notFilter) {
      const titles = EVENTS.filter((e) => matches(e, result)).map((e) => e.title);
      line += `\n          → 맞는 행사: ${titles.length ? titles.join(', ') : '(없음)'}`;
    }
    console.log(line);
  } catch {
    console.log(`[틀림]  문제 ${ex.no}\n          내 답: ${show(result)}\n          정답: ${show(ex.expected)}`);
  }
}

console.log(`\n${EXERCISES.length}개 중 ${passed}개 통과 · ${todo}개 남음\n`);

/* =====================================================================
   정답 (먼저 직접 풀어 보고 봐요!)
   =====================================================================

function q1() { return {}; }
function q2() { return { category: 'play' }; }
function q3() { return { category: 'play', district: '종로구' }; }
function q4(category) { return { category }; }

function q5(category) {
  if (category) return { category };
  return {};
}

function q6({ category, district }) {
  const filter = {};
  if (category) filter.category = category;
  if (district) filter.district = district;
  return filter;
}

function q7({ category, district }) {
  const and = [];
  if (category) and.push({ category });
  if (district) and.push({ district });
  return and;
}

function q8(now) { return { endDate: { $gte: now } }; }
function q9(from, to) { return { startDate: { $gte: from, $lte: to } }; }
function q10(now) { return { $or: [{ endDate: null }, { endDate: { $gte: now } }] }; }
function q11(list) { return { category: { $in: list } }; }
function q12(word) { return { title: { $regex: word, $options: 'i' } }; }

function q13(and) { return and.length ? { $and: and } : {}; }

function q14(now, from) {
  return {
    $and: [
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: from } }] },
    ],
  };
}

function q15({ category = '', district = '', q = '', includeEnded = false }, now) {
  const and = [];
  if (!includeEnded) and.push({ $or: [{ endDate: null }, { endDate: { $gte: now } }] });
  if (category) and.push({ category });
  if (district) and.push({ district });
  if (q) and.push({ title: { $regex: q, $options: 'i' } });
  return and.length ? { $and: and } : {};
}

===================================================================== */

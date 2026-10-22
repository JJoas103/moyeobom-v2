const Toilet = require('../models/Toilet');
const Station = require('../models/Station');

// 좌표 근처 화장실 · 지하철역 — 모임 상세에서 행사장 좌표로 호출 (정확한 모임 장소는 사용 안 함)

const TOILET_RADIUS_M = 800;
const TOILET_LIMIT = 3;
const STATION_RADIUS_M = 1500;
const STATION_LIMIT = 3;
const DUPLICATE_M = 50; // 이름(공백 무시)이 같고 이 거리 안이면 같은 화장실 (출처 중복 등록 대응)
const WALK_M_PER_MIN = 67; // 시속 약 4km

// 직선거리 기준 도보 시간 (실제 길은 더 걸릴 수 있음)
const walkMinutes = (meters) => Math.max(1, Math.round(meters / WALK_M_PER_MIN));

// 출처 노선 이름 → 사람들이 부르는 이름 (같은 역이 여러 이름으로 나뉘지 않게)
const LINE_ALIAS = {
  경부선: '1호선',
  경원선: '1호선',
  경인선: '1호선',
  장항선: '1호선',
  일산선: '3호선',
  과천선: '4호선',
  안산선: '4호선',
  진접선: '4호선',
  별내선: '8호선',
  '7호선(인천)': '7호선',
  '9호선(연장)': '9호선',
  '신분당선(연장)': '신분당선',
  '신분당선(연장2)': '신분당선',
  중앙선: '경의중앙선',
  공항철도1호선: '공항철도',
  '수도권 광역급행철도': 'GTX-A',
};
const lineName = (line) => LINE_ALIAS[line] || line;

// '서울역' · '서울' → 같은 역. 화면에는 '○○역'
const stationKey = (name) => name.replace(/역$/, '');
const stationLabel = (name) => `${stationKey(name)}역`;

const near = (lat, lng, maxDistance, query) => ({
  $geoNear: {
    near: { type: 'Point', coordinates: [lng, lat] },
    distanceField: 'distance',
    maxDistance,
    spherical: true,
    ...(query && { query }),
  },
});

// 공공개방만 — 민간개방(가게 · 주유소 등)은 중복 등록 · 개방 시간 불일치가 많아 제외
const TOILET_QUERY = { openType: '공공개방' };

// 두 GeoJSON 점 사이 거리(m) — 짧은 거리라 평면 근사로 충분
function metersBetween(a, b) {
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const dy = (lat1 - lat2) * 111320;
  const dx = (lng1 - lng2) * 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(dx, dy);
}

// 'KFC대학로점' · 'KFC 대학로점' 같은 중복 등록 — 가까운 쪽 하나만 유지
function dropDuplicates(rows) {
  const kept = [];
  for (const row of rows) {
    const key = row.name.replace(/\s+/g, '').toLowerCase();
    const dup = kept.some((k) => k._key === key && metersBetween(k.location, row.location) < DUPLICATE_M);
    if (!dup) kept.push({ ...row, _key: key });
  }
  return kept.map(({ _key, ...row }) => row);
}

async function findToilets(lat, lng) {
  const rows = await Toilet.aggregate([
    near(lat, lng, TOILET_RADIUS_M, TOILET_QUERY),
    { $limit: TOILET_LIMIT * 4 }, // 중복을 빼고도 3곳이 남도록 넉넉히
    { $project: { source: 0, createdAt: 0, updatedAt: 0, __v: 0, district: 0 } },
  ]);
  return dropDuplicates(rows).slice(0, TOILET_LIMIT).map(({ location, distance, ...t }) => ({
    ...t,
    lat: location.coordinates[1],
    lng: location.coordinates[0],
    distance: Math.round(distance),
    walkMinutes: walkMinutes(distance),
  }));
}

// 역은 호선마다 1건 → 이름으로 묶음 (가장 가까운 거리 사용)
async function findStations(lat, lng) {
  const rows = await Station.aggregate([near(lat, lng, STATION_RADIUS_M), { $limit: 30 }]);
  const byName = new Map();
  for (const row of rows) {
    const key = stationKey(row.name);
    const entry = byName.get(key) || { name: stationLabel(row.name), lines: [], distance: row.distance };
    const line = lineName(row.line);
    if (!entry.lines.includes(line)) entry.lines.push(line);
    entry.distance = Math.min(entry.distance, row.distance);
    byName.set(key, entry);
  }
  return [...byName.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, STATION_LIMIT)
    .map((s) => ({ ...s, distance: Math.round(s.distance), walkMinutes: walkMinutes(s.distance) }));
}

/** { toilets: [...], stations: [...] } — 반경 안에 없으면 빈 배열 */
async function findNearby({ lat, lng }) {
  const [toilets, stations] = await Promise.all([findToilets(lat, lng), findStations(lat, lng)]);
  return { toilets, stations };
}

module.exports = { findNearby };

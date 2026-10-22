const Toilet = require('../models/Toilet');
const Station = require('../models/Station');
const seoulToilet = require('./sources/seoulToilet');
const seoulStation = require('./sources/seoulStation');
const { runSync } = require('./syncRunner');

// 행사장 근처 안내용 장소 데이터 — 공중화장실 · 지하철역 (거의 안 바뀜 · 월 1회)
// 행사와 달리 출처에서 사라진 곳(폐쇄 등)은 삭제

const syncToilets = ({ trigger = 'manual' } = {}) =>
  runSync({
    logSource: 'SEOUL_TOILET',
    sourceName: 'SEOUL',
    trigger,
    Model: Toilet,
    pageSize: seoulToilet.PAGE_SIZE,
    fetchPage: seoulToilet.fetchPage,
    transform: (row) => seoulToilet.toToilet(row),
    removeMissing: true,
  });

const syncStations = ({ trigger = 'manual' } = {}) =>
  runSync({
    logSource: 'SEOUL_STATION',
    sourceName: 'SEOUL',
    trigger,
    Model: Station,
    pageSize: seoulStation.PAGE_SIZE,
    fetchPage: seoulStation.fetchPage,
    transform: (row) => seoulStation.toStation(row),
    removeMissing: true,
  });

module.exports = { syncToilets, syncStations };

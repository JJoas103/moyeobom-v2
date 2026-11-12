// 관리자 — 신고 처리 · 회원 열람. 화면은 pages/admin/ (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/adminService.js 와 같음):
//   user     = { _id, nickname, profileImage, email, role, manner: { score }, createdAt }
//   reportRow= { _id, reporter(user), target(user), reason, detail, isMessage,
//                roomType('meetup'|'direct'|''), meetupTitle,
//                status('pending'|'accepted'|'rejected'|'done'), createdAt, resolvedAt }
//   report   = reportRow + { roomClosed, roomGone, meetup: { _id, title, status, startAt }|null,
//                isTargetHost, evidence, evidenceAt, evidenceFromSnapshot,
//                recentMessages: [{ text, createdAt }], targetReportCount, targetAcceptedCount,
//                resolvedBy: { _id, nickname }|null, adminNote(제재·기각 사유), revertNote(취소 사유),
//                preview: { action: 'sanction'|'revert', scoreNow, scoreAfter, requested, applied }|null }
//
// ⚠ preview 는 **서버가 계산한다** — 누르면 점수가 몇 점에서 몇 점이 되는지. 화면에서 빼기를 하면
//   0~100 클램프까지 베껴야 하고 서버 값이 바뀌면 화면이 조용히 거짓말을 한다.
//   applied < requested 면 경계에 걸린 것(예: 5점 → 0점, 5점만 깎임)
//   member   = user + { provider, tastes, districts }
//   → getMember = { member, manner: { score, logs, logSum, logLimit }, reports: { received, filed },
//                   meetups: { hosted, joined } }
//
// ⚠ 'done' 은 관리자 화면이 없던 동안 DB 에서 손으로 바꿔 둔 값이다 — 인정인지 기각인지 모른다.
//   새로 만들어지지 않고 화면에서 '예전 처리'로만 보인다 (models/Report.js 주석).
import { apiGet, apiPost } from '../api'
import { REPORT_REASONS_WITH_NOSHOW } from './constants'

export const ADMIN_NOTE_MAX = 200 // 관리자 메모 — models/Report.js NOTE_MAX

// 신고 이유 라벨은 **접수 화면과 같은 것을 쓴다** — 여기서 새로 쓰면 둘이 갈린다
export const REPORT_REASON_LABEL = Object.fromEntries(REPORT_REASONS_WITH_NOSHOW.map((r) => [r.value, r.label]))

// 화면에서는 '제재' 한 말로 부른다 — 제재당한 회원이 마이페이지에서 보는 말이
// `신고로 제재를 받았어요`(utils/manner.js MANNER_RULES)라, 관리자 화면만 '인정' 이면 두 말이 갈린다.
// **DB 값(accepted)은 그대로다** — 라벨만 바꾼다.
//
// 'rejected'(처음부터 기각)와 'reverted'(제재했다가 취소)를 갈라 쓴다 — 둘 다 지금 제재가 없지만
// 점수가 움직인 적이 있는지가 달라서, 한 말로 묶으면 화면이 거짓말을 한다 (models/Report.js 주석)
// 'appealed' 는 상태가 아니라 **이의가 들어와 있는 것**이다 (상태는 여전히 accepted).
// 먼저 봐야 할 줄이라 칩 하나를 내준다
export const REPORT_STATUS = [
  { value: 'pending', label: '대기 중' },
  { value: 'appealed', label: '이의제기' },
  { value: 'accepted', label: '제재' },
  { value: 'rejected', label: '기각' },
  { value: 'reverted', label: '제재 취소' },
  { value: 'all', label: '전체' },
]
export const REPORT_STATUS_LABEL = {
  pending: '대기 중',
  accepted: '제재',
  rejected: '기각',
  reverted: '제재 취소',
  done: '예전 처리',
}

/** → { reports, total, counts, page, limit } */
export const fetchReports = (params) => apiGet('/api/admin/reports', { params })

/** → { report } */
export const fetchReport = (id) => apiGet(`/api/admin/reports/${id}`)

/** 제재 · 기각 — 대기 중인 신고만. action 은 'accept'(제재) | 'reject'(기각). → { report } */
export const resolveReport = (id, action, note) => apiPost(`/api/admin/reports/${id}/resolve`, { action, note })

/** 이의제기 판정 — 'accept'(무효처리: 점수 복구) | 'reject'(이의 기각). → { report } */
export const decideAppeal = (id, action, reply) => apiPost(`/api/admin/reports/${id}/appeal`, { action, reply })


/** 제재 취소 — 제재한 신고만. 점수는 그때 깎인 만큼 돌아간다. → { report } */
export const revertReport = (id, note) => apiPost(`/api/admin/reports/${id}/revert`, { note })

/** → { members, total, page, limit } */
export const fetchMembers = (params) => apiGet('/api/admin/members', { params })

/** → { member, manner, reports, meetups } */
export const fetchMember = (id) => apiGet(`/api/admin/members/${id}`)

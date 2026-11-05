// 신고 입력값 — { reason, detail }
export const EMPTY_REPORT = { reason: '', detail: '' }

/** 이유를 골랐고, 기타면 내용도 적었는지 */
export const isReportReady = ({ reason, detail }) => Boolean(reason) && (reason !== 'other' || detail.trim().length > 0)

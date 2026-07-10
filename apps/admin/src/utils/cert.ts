import { addYears, subDays, differenceInCalendarDays, parseISO, isValid, format } from 'date-fns'

// ── 장기요양인정서 도메인 타입 ──────────────────────────────
export interface Benefit { type: string; from?: string | null }        // type: '재가' | '시설'
export interface Certification {
  grade?: string | null                                                 // '1'~'5' | '등급외'
  cert_no?: string | null                                               // 인정번호(선택)
  start?: string | null                                                 // 인정 시작일 ISO
  end?: string | null                                                   // 인정 종료일 ISO
  benefits?: Benefit[]                                                  // 재가/시설 급여(각 적용일)
}

const RENEWAL_LEAD_DAYS = 90                                            // 종료 90일 전 갱신 신청

export const pd = (s?: string | null): Date | null => {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}
const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

// 시작일 + N년 - 1일 = 종료일 (예: 24.04.01 +2년 → 26.03.31)
export const endFromStart = (start?: string | null, years = 2): string => {
  const d = pd(start)
  return d ? fmt(subDays(addYears(d, years), 1)) : ''
}
// 갱신 신청 기준일 = 종료일 - 90일
export const renewalDue = (end?: string | null): string => {
  const d = pd(end)
  return d ? fmt(subDays(d, RENEWAL_LEAD_DAYS)) : ''
}
export const daysUntil = (iso?: string | null): number | null => {
  const d = pd(iso)
  return d ? differenceInCalendarDays(d, new Date()) : null
}
// 표시: 'YY.MM.DD'
export const fmtD = (iso?: string | null): string => {
  const d = pd(iso)
  return d ? format(d, 'yy.MM.dd') : ''
}

// 여러 인정서 중 현재(가장 최신 종료일) 인정서
export const currentCert = (certs: Certification[]): Certification | null => {
  if (!certs?.length) return null
  return [...certs].sort((a, b) => (a.end || a.start || '').localeCompare(b.end || b.start || '')).slice(-1)[0]
}

export type CertStatus = 'none' | 'ok' | 'renew' | 'expired'
export interface CertState { status: CertStatus; daysToEnd: number | null; due: string }

export const certState = (c?: Certification | null): CertState => {
  if (!c || !c.end) return { status: 'none', daysToEnd: null, due: '' }
  const due = renewalDue(c.end)
  const dEnd = daysUntil(c.end)
  const dDue = daysUntil(due)
  if (dEnd !== null && dEnd < 0) return { status: 'expired', daysToEnd: dEnd, due }
  if (dDue !== null && dDue <= 0) return { status: 'renew', daysToEnd: dEnd, due }   // 종료 90일 이내
  return { status: 'ok', daysToEnd: dEnd, due }
}

export const gradeLabel = (c?: Certification | null): string =>
  !c ? '' : c.grade === '등급외' ? '등급외' : c.grade ? `${c.grade}등급` : ''
export const benefitLabel = (c?: Certification | null): string =>
  !c ? '' : (c.benefits || []).map(b => b.type).filter(Boolean).join('·')

// 등급/급여 요약 문자열(표·필터 호환): 현재 인정서 기준 "3/재가\n3/시설"
export const gradeSummary = (certs: Certification[]): string => {
  const cur = currentCert(certs)
  if (!cur) return ''
  const g = cur.grade
  const seen = new Set<string>(); const out: string[] = []
  for (const b of (cur.benefits || [])) {
    const key = g === '등급외' ? '등급외' : `${g}/${b.type}`
    if (seen.has(key)) continue; seen.add(key)
    out.push(g === '등급외' ? '등급외' : `${g}/${b.type}`)
  }
  if (!(cur.benefits || []).length && g) out.push(g === '등급외' ? '등급외' : `${g}`)
  return out.join('\n')
}

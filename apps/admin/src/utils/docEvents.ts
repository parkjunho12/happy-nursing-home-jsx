// 어르신 서류 일시(계약서·급여제공계획서·결과평가) — 구조화 이벤트
export interface DocEvent { date?: string | null; memo?: string | null; kind?: string | null }
export type DocType = 'contract' | 'plan' | 'eval'

export interface KindMeta { v: string; label: string; text: string; dot: string }

// 구분별 색상 (요청 사양)
export const KINDS: Record<DocType, KindMeta[]> = {
  // 계약서: 입소=검정, 나머지=녹색
  contract: [
    { v: '입소', label: '입소', text: 'text-gray-800', dot: 'bg-gray-700' },
    { v: '변경', label: '변경(등급)', text: 'text-green-600', dot: 'bg-green-500' },
    { v: '변경계약', label: '변경계약', text: 'text-green-600', dot: 'bg-green-500' },
    { v: '갱신', label: '갱신계약', text: 'text-green-600', dot: 'bg-green-500' },
  ],
  // 계획서: 입소=검정, 6개월 기준=연두, 변화=노랑
  plan: [
    { v: '입소', label: '입소', text: 'text-gray-800', dot: 'bg-gray-700' },
    { v: '기준', label: '기준일(6개월)', text: 'text-lime-600', dot: 'bg-lime-500' },
    { v: '변화', label: '변화', text: 'text-amber-500', dot: 'bg-amber-400' },
  ],
  // 평가: 기준=초록, 변화=노랑, 퇴소=검정
  eval: [
    { v: '기준', label: '기준일(6개월)', text: 'text-green-600', dot: 'bg-green-500' },
    { v: '변화', label: '변화', text: 'text-amber-500', dot: 'bg-amber-400' },
    { v: '퇴소', label: '퇴소', text: 'text-gray-800', dot: 'bg-gray-700' },
  ],
}

export const kindMeta = (type: DocType, kind?: string | null): KindMeta | null =>
  KINDS[type].find(k => k.v === kind) ?? null

export const defaultKind = (type: DocType): string => KINDS[type][0].v

// 문자열/객체 혼재(레거시) → DocEvent 정규화
export const asEvent = (x: any): DocEvent =>
  typeof x === 'string' ? { date: null, memo: x, kind: null } : (x ?? {})

export const todayISO = (): string => {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// 'YY.MM.DD'
export const fmtYMD = (s?: string | null): string => {
  if (!s) return ''
  const p = s.split('-'); return p.length === 3 ? `${p[0].slice(2)}.${p[1]}.${p[2]}` : s
}
// 'MM.DD' (기준일용 — 연도 생략)
export const fmtMD = (s?: string | null): string => {
  if (!s) return ''
  const p = s.split('-'); return p.length === 3 ? `${p[1]}.${p[2]}` : s
}

// ── 인정서 기반 자동 일시 생성 ─────────────────────────────
import { addMonths, parseISO, isValid, format } from 'date-fns'
import { type Certification, currentCert } from './cert'

const _pd = (s?: string | null) => { if (!s) return null; const d = parseISO(s); return isValid(d) ? d : null }
const _f = (d: Date) => format(d, 'yyyy-MM-dd')
const _dedupe = (arr: DocEvent[]) => {
  const seen = new Set<string>(); const out: DocEvent[] = []
  for (const e of arr) { const k = `${e.date}|${e.kind}`; if (e.date && seen.has(k)) continue; if (e.date) seen.add(k); out.push(e) }
  return out
}

/**
 * 인정서(유효기간)를 바탕으로 계약서·계획서·평가의 '정기' 일시를 자동 생성.
 * - 계약서: 첫 인정서=입소, 이후 인정서 시작=갱신, 매년 1/1=정기
 * - 계획서: 입소 1회 + 기준일(6개월)마다
 * - 평가:   입소 후 첫 기준일부터 6개월마다
 * 변화(변경) 항목은 수동으로만 추가한다.
 */
export function autoDocEvents(certs: Certification[], admissionDate?: string | null): { contract: DocEvent[]; plan: DocEvent[]; eval: DocEvent[] } {
  const contract: DocEvent[] = [], plan: DocEvent[] = [], evl: DocEvent[] = []
  const valid = [...(certs || [])].filter(c => c.start)
  const earliest = [...valid].sort((a, b) => (a.start || '').localeCompare(b.start || ''))[0]
  const cur = currentCert(valid)                    // 현재(최신) 인정서
  const admDate = admissionDate || earliest?.start || cur?.start || null

  // 입소: 인정서와 무관하게 입소일 기준으로 항상 생성 (검정)
  if (admDate) {
    contract.push({ date: admDate, kind: '입소', memo: null })
    plan.push({ date: admDate, kind: '입소', memo: null })
  }

  // 그 외 정기 일시는 현재(최신) 인정서 기준으로만 생성. 이전 인정서는 사용 안 함.
  if (cur && cur.start) {
    const S = _pd(cur.start)!, E = _pd(cur.end)
    const isRenewal = valid.length > 1              // 이전 인정서가 있으면 현재는 갱신 인정서
    // 갱신 인정서면 시작일에 체결한 갱신계약을 남긴다
    if (isRenewal) contract.push({ date: cur.start!, kind: '갱신', memo: '갱신계약' })
    // 계약서: 매년 1/1=변경계약
    if (E) {
      for (let y = S.getFullYear() + 1; y <= E.getFullYear(); y++) {
        const jan = `${y}-01-01`, jd = _pd(jan)!
        if (jd > S && jd <= E) contract.push({ date: jan, kind: '변경계약', memo: '변경계약' })
      }
    }
    // 유효기간 종료일 = 갱신계약 (다음 갱신 준비)
    if (cur.end) contract.push({ date: cur.end, kind: '갱신', memo: '갱신계약' })
    // 6개월 기준 사이클 [S, S+6, ...] ≤ E
    const cycle: string[] = []
    let c2 = S
    while (!E || c2 <= E) { cycle.push(_f(c2)); c2 = addMonths(c2, 6); if (cycle.length > 40) break; if (!E) break }
    // 계획서 기준: 신규=입소(S) 다음부터, 갱신=새 기준일(S)부터
    cycle.slice(isRenewal ? 0 : 1).forEach(d => plan.push({ date: d, kind: '기준', memo: null }))
    // 평가: 입소/갱신 후 첫 기준일부터 6개월마다
    cycle.slice(1).forEach(d => evl.push({ date: d, kind: '기준', memo: null }))
  }
  const bydate = (a: DocEvent, b: DocEvent) => (a.date || '9999').localeCompare(b.date || '9999')
  return {
    contract: _dedupe(contract).sort(bydate),
    plan: _dedupe(plan).sort(bydate),
    eval: _dedupe(evl).sort(bydate),
  }
}

// 자동 생성분과 기존 수동(변화·퇴소) 항목 병합 (routine은 새로 대체, 수동은 보존)
export function mergeAuto(existing: DocEvent[] | undefined, auto: DocEvent[], keepKinds: string[]): DocEvent[] {
  const manual = (existing ?? []).map(asEvent).filter(e => (e.kind && keepKinds.includes(e.kind)) || (!e.kind && (e.memo || e.date)))
  return _dedupe([...auto, ...manual]).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
}

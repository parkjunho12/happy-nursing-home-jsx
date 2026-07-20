export const todayISO = (): string => {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 어르신 서류 일시(계약서·급여제공계획서·결과평가) — 구조화 이벤트
export interface DocEvent {
  date?: string | null
  memo?: string | null
  kind?: string | null
  done?: boolean                 // (레거시) 완료 여부 — status와 자동 동기화된다
  status?: EventStatus | null    // 서류 상태 — 기존 시트의 셀 색상 범례
}
export type DocType = 'contract' | 'plan' | 'eval'

// ── 서류 상태 ────────────────────────────────────────────────
// 기존 엑셀 시트에서 셀 색으로 표시하던 4가지를 그대로 옮긴 것.
export type EventStatus = '완료' | '미비' | '서명미비' | '챙길것'

export interface StatusMeta {
  v: EventStatus
  label: string          // 편집기 선택지
  short: string          // 표 배지
  text: string           // 글자색
  chip: string           // 배지/범례 색
  dot: string
  alert: boolean         // 조치가 필요한 상태인지 (집계 대상)
}

export const STATUSES: StatusMeta[] = [
  { v: '완료',     label: '완료 서류',        short: '완료',   alert: false,
    text: 'text-gray-400',    chip: 'bg-green-100 text-green-700 border-green-200',    dot: 'bg-green-500' },
  { v: '미비',     label: '미비 서류',        short: '미비',   alert: true,
    text: 'text-red-600',     chip: 'bg-red-100 text-red-700 border-red-200',          dot: 'bg-red-500' },
  { v: '서명미비', label: '보호자 서명 미비',  short: '서명',   alert: true,
    text: 'text-orange-600',  chip: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { v: '챙길것',   label: '챙겨야 하는 서류',  short: '챙길것', alert: true,
    text: 'text-yellow-700',  chip: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400' },
]

export const statusMeta = (v?: string | null): StatusMeta | null =>
  STATUSES.find(s => s.v === v) ?? null

/** 사용자가 직접 '완료'로 표시했는지 */
export const isExplicitDone = (e: DocEvent): boolean => e.status === '완료' || (!e.status && !!e.done)

/**
 * 상태 해석.
 * 기존 시트에서는 날짜가 지난 칸은 '이미 작성한 기록'이고, 문제가 있는 것만 색을 칠했다.
 * 그래서 여기서도 날짜가 지났는데 아무 표시가 없으면 완료로 본다.
 * 안 된 것은 미비·서명미비·챙길것으로 명시해야 한다.
 */
export const effStatus = (e: DocEvent): EventStatus | null => {
  if (e.status) return e.status
  if (e.done) return '완료'
  if (e.date && e.date < todayISO()) return '완료'   // 지난 기록 = 작성 완료로 간주
  return null
}

/** 지난 날짜라서 완료로 간주된 것 (직접 체크한 건 아님) */
export const isImplicitDone = (e: DocEvent): boolean =>
  !e.status && !e.done && !!e.date && e.date < todayISO()

/** 조치가 필요한 항목인지 (미비·서명미비·챙길것) */
export const isAlert = (e: DocEvent): boolean => {
  const m = statusMeta(effStatus(e))
  return !!m?.alert
}

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
export const asEvent = (x: any): DocEvent => {
  const e: DocEvent = typeof x === 'string' ? { date: null, memo: x, kind: null } : (x ?? {})
  // 레거시 done만 있는 기록도 '완료'로 읽히도록
  if (!e.status && e.done) return { ...e, status: '완료' }
  return e
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
  // 입소일에 작성하는 서류는 입소 절차에서 이미 받으므로 완료로 둔다.
  // 단 입소일이 아직 오지 않았다면(입소 예정자) 완료로 볼 수 없다.
  if (admDate) {
    const doneIfPast: Partial<DocEvent> = admDate <= todayISO() ? { status: '완료', done: true } : {}
    contract.push({ date: admDate, kind: '입소', memo: null, ...doneIfPast })
    plan.push({ date: admDate, kind: '입소', memo: null, ...doneIfPast })
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

/**
 * 자동 생성분을 기존 목록에 '더하기만' 한다.
 * 갱신 인정서를 추가했을 때 이미 적어둔 일시를 지우거나 고치면 안 되므로,
 * 같은 날짜가 이미 있으면 건너뛰고 없는 날짜만 새로 넣는다.
 */
export function appendAuto(existing: DocEvent[] | undefined, auto: DocEvent[]): { next: DocEvent[]; added: number } {
  const cur = (existing ?? []).map(asEvent)
  const have = new Set(cur.filter(e => e.date).map(e => e.date as string))
  const add = auto.filter(e => e.date && !have.has(e.date as string))
  const next = [...cur, ...add].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  return { next, added: add.length }
}

// 자동 생성분과 기존 수동(변화·퇴소) 항목 병합 (routine은 새로 대체, 수동은 보존)
export function mergeAuto(existing: DocEvent[] | undefined, auto: DocEvent[], keepKinds: string[]): DocEvent[] {
  const manual = (existing ?? []).map(asEvent).filter(e => (e.kind && keepKinds.includes(e.kind)) || (!e.kind && (e.memo || e.date)))
  return _dedupe([...auto, ...manual]).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
}

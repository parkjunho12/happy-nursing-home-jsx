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
 *
 * 완료로 표시하지 않은 채 날짜가 지났다면 '미비 서류'다.
 * 예전에는 지난 날짜를 '이미 작성한 기록'으로 보고 완료 처리했는데,
 * 그러면 정말 빠뜨린 서류가 조용히 완료로 묻혀 아무도 모른다.
 * 완료는 사람이 표시해야 완료다.
 *
 * 아직 오지 않은 일시는 '챙겨야 하는 서류'다.
 */
export const effStatus = (e: DocEvent): EventStatus | null => {
  if (e.status === '완료' || e.done) return '완료'
  const late = !!e.date && e.date < todayISO()
  // 사람이 미비·서명미비로 표시한 것은 무슨 일이 있어도 그대로 둔다.
  // ('챙길것' 은 자동으로 붙는 시작 상태라 사람의 판단이 아니다)
  if (e.status && e.status !== '챙길것') return e.status
  // 입소일에 쓰는 서류는 입소 절차에서 그 자리에 받는다.
  // 예전에 상태 없이 저장된 것도 날짜가 지났으면 받은 것으로 본다.
  if (e.kind === '입소' && late) return '완료'
  if (!e.date) return null                          // 날짜 미정은 아직 판단할 수 없다
  return late ? '미비' : '챙길것'
}

/** 지난 날짜라서 완료로 간주된 것 — 이제는 그렇게 보지 않는다(항상 false).
 *  화면 쪽 호출부를 한 번에 지우지 않으려고 남겨 둔다. */
export const isImplicitDone = (_e: DocEvent): boolean => false

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
import { addMonths, addDays, parseISO, isValid, format } from 'date-fns'
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
  // 입소일에 쓰는 계약서·계획서는 입소 절차에서 그 자리에 받는 서류다.
  // 그래서 완료로 둔다 — 입소 예정자도 마찬가지다. 입소하면 받게 되어 있고,
  // 안 그러면 입소일이 지나자마자 전부 '미비'로 뜬다.
  if (admDate) {
    const done: Partial<DocEvent> = { status: '완료', done: true }
    contract.push({ date: admDate, kind: '입소', memo: null, ...done })
    plan.push({ date: admDate, kind: '입소', memo: null, ...done })
  }

  // 그 외 정기 일시는 현재(최신) 인정서 기준으로만 생성. 이전 인정서는 사용 안 함.
  // 앞으로 챙겨야 할 일시는 '챙겨야 하는 서류'로 만든다.
  // 상태를 비워두면 목록에서 아무 색도 없어 무엇을 해야 하는지 보이지 않는다.
  const TODO: Partial<DocEvent> = { status: '챙길것' }

  if (cur && cur.start) {
    const S = _pd(cur.start)!, E = _pd(cur.end)
    const isRenewal = valid.length > 1              // 이전 인정서가 있으면 현재는 갱신 인정서
    // 갱신 인정서면 시작일에 체결한 갱신계약을 남긴다
    if (isRenewal) contract.push({ date: cur.start!, kind: '갱신', memo: '갱신계약', ...TODO })
    // 계약서: 매년 1/1=변경계약
    if (E) {
      for (let y = S.getFullYear() + 1; y <= E.getFullYear(); y++) {
        const jan = `${y}-01-01`, jd = _pd(jan)!
        if (jd > S && jd <= E) contract.push({ date: jan, kind: '변경계약', memo: '변경계약', ...TODO })
      }
    }
    // 갱신은 인정서 마지막 날이 아니라 '그 다음 날'이다.
    // 마지막 날까지는 기존 인정서가 살아 있고, 새 인정서·새 계약은 하루도 비지 않게 그 다음 날부터 시작한다.
    // 그날 계약서만 쓰는 게 아니라 급여제공계획서·결과평가도 새 기준으로 함께 작성한다.
    if (E) {
      const renewAt = _f(addDays(E, 1))
      contract.push({ date: renewAt, kind: '갱신', memo: '갱신계약', ...TODO })
      // 계획서·평가에는 '갱신' 구분이 없다 — 새 인정서의 첫 기준일이므로 '기준'으로 남긴다
      plan.push({ date: renewAt, kind: '기준', memo: '갱신 기준일', ...TODO })
      evl.push({ date: renewAt, kind: '기준', memo: '갱신 기준일', ...TODO })
    }
    // 6개월 기준 사이클 [S, S+6, ...] ≤ E
    const cycle: string[] = []
    let c2 = S
    while (!E || c2 <= E) { cycle.push(_f(c2)); c2 = addMonths(c2, 6); if (cycle.length > 40) break; if (!E) break }
    // 계획서 기준: 신규=입소(S) 다음부터, 갱신=새 기준일(S)부터
    cycle.slice(isRenewal ? 0 : 1).forEach(d => plan.push({ date: d, kind: '기준', memo: null, ...TODO }))
    // 평가: 입소/갱신 후 첫 기준일부터 6개월마다
    cycle.slice(1).forEach(d => evl.push({ date: d, kind: '기준', memo: null, ...TODO }))
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
export function appendAuto(existing: DocEvent[] | undefined, auto: DocEvent[]): { next: DocEvent[]; added: number; moved: number } {
  const cur = (existing ?? []).map(asEvent)

  // 갱신계약 기준일이 '인정서 마지막 날'에서 '그 다음 날'로 바뀌었다.
  // 예전 기준으로 저장된 갱신 항목이 그대로 남아 있으면 하루 차이로 두 건이 된다.
  // 손대지 않은 항목이면 날짜만 옮기고, 이미 처리한 항목이면 건드리지 않는다.
  // '챙길것' 은 자동으로 붙는 시작 상태다 — 사람이 손댄 것으로 보면 안 된다
  const untouched = (e: DocEvent) =>
    !e.done && (!e.status || e.status === '챙길것') && (!e.memo || e.memo === '갱신계약')
  let moved = 0
  const skip = new Set<string>()          // 이관으로 해결돼 새로 넣을 필요가 없는 날짜
  for (const a of auto) {
    if (a.kind !== '갱신' || !a.date) continue
    const prevDay = _f(addDays(_pd(a.date)!, -1))
    const old = cur.find(e => e.kind === '갱신' && e.date === prevDay)
    if (!old) continue
    if (untouched(old)) { old.date = a.date; moved++ }   // 하루 뒤로 이동
    skip.add(a.date)                                     // 이미 처리한 건이면 새로 만들지 않는다
  }

  const have = new Set(cur.filter(e => e.date).map(e => e.date as string))
  const add = auto.filter(e => e.date && !have.has(e.date as string) && !skip.has(e.date as string))
  const next = [...cur, ...add].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  return { next, added: add.length, moved }
}

/**
 * 이미 저장된 갱신 일자를 새 기준(인정서 종료일 + 1일)으로 맞춘다 — 일괄 정리용.
 *
 * 「인정서 기준으로 일시 추가」와 달리 갱신 관련 항목만 건드린다.
 * 전체 자동 채움을 다시 돌리면 일부러 지운 6개월 기준일까지 되살아나기 때문이다.
 *
 * - 계약서: 종료일 당일의 갱신 → 다음 날로 이동 (손대지 않은 것만)
 * - 계획서·평가: 그날 항목이 없으면 '기준 · 갱신 기준일' 추가
 * - 이미 완료·상태 표시했거나 메모를 직접 쓴 갱신은 건드리지 않는다(skipped)
 */
export function fixRenewalDates(
  certs: Certification[] | undefined | null,
  lines: { contract?: DocEvent[] | null; plan?: DocEvent[] | null; eval?: DocEvent[] | null },
): { contract: DocEvent[]; plan: DocEvent[]; eval: DocEvent[]; moved: number; added: number; skipped: number; changed: boolean } {
  const contract = (lines.contract ?? []).map(asEvent)
  const plan = (lines.plan ?? []).map(asEvent)
  const evl = (lines.eval ?? []).map(asEvent)
  const out = { contract, plan, eval: evl, moved: 0, added: 0, skipped: 0, changed: false }

  const cur = currentCert([...(certs ?? [])].filter(c => c.start))
  const E = _pd(cur?.end)
  if (!E) return out                                  // 종료일이 없으면 갱신 시점도 없다
  const oldDay = _f(E), renewAt = _f(addDays(E, 1))

  // 계약서 — 종료일 당일에 있던 갱신을 하루 뒤로
  const already = contract.some(e => e.kind === '갱신' && e.date === renewAt)
  const old = contract.find(e => e.kind === '갱신' && e.date === oldDay)
  if (old) {
    const untouched = !old.done && !old.status && (!old.memo || old.memo === '갱신계약')
    if (untouched && !already) { old.date = renewAt; out.moved++; out.changed = true }
    else out.skipped++                                // 이미 처리했거나 새 날짜가 이미 있음
  }

  // 계획서·평가 — 갱신일에 아무것도 없으면 기준일을 넣어준다
  for (const list of [plan, evl]) {
    if (list.some(e => e.date === renewAt)) continue
    list.push({ date: renewAt, kind: '기준', memo: '갱신 기준일' })
    list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    out.added++; out.changed = true
  }
  return out
}

// 자동 생성분과 기존 수동(변화·퇴소) 항목 병합 (routine은 새로 대체, 수동은 보존)
export function mergeAuto(existing: DocEvent[] | undefined, auto: DocEvent[], keepKinds: string[]): DocEvent[] {
  const manual = (existing ?? []).map(asEvent).filter(e => (e.kind && keepKinds.includes(e.kind)) || (!e.kind && (e.memo || e.date)))
  return _dedupe([...auto, ...manual]).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
}

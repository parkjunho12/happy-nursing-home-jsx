import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Phone, Plus, Printer, Search, ArrowLeft, Trash2, Loader2, X,
  AlertCircle, CalendarClock, MessageSquareQuote, Check,
} from 'lucide-react'
import { consultAPI, type ConsultRow, type ConsultPatch } from '@/api/consultClient'
import { useAuthStore } from '@/store/auth'
import {
  CONSULT_SECTIONS, CONSULT_STATUS, STATUS_LABEL,
  consultMissing, consultTitle, hasChip, showValue, toggleChip,
  type ConsultField,
} from '@/utils/consultForm'

/**
 * 입소 상담 — 전화를 받으면서 그대로 채우는 한 장.
 *
 *  ■ 왜 자동으로 저장하는가
 *
 *    통화하면서 적는 화면이다. 전화가 끊기거나 창을 닫아 한 통화분을 잃으면
 *    다시 여쭐 수가 없다 — 보호자에게 또 전화해 같은 것을 묻게 된다.
 *    그래서 「새 상담」을 누르는 순간 서버에 한 줄을 만들고, 그 뒤로는
 *    손을 멈출 때마다 알아서 저장한다.
 *
 *  ■ 왜 멘트를 함께 두는가
 *
 *    상담 전화는 복지 선생님만 받지 않는다. 사무실에 있는 사람이 받는다.
 *    처음 받는 사람도 순서대로 읽으면 통화가 굴러가야 한다.
 */

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const nowHM = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16)
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

type Scope = 'open' | 'done' | 'all'

export default function ConsultPage() {
  const me = useAuthStore(st => st.user)
  const canDelete = me?.role === 'ADMIN' || ['시설장', '대표', '이사'].includes(me?.position ?? '')

  const [scope, setScope] = useState<Scope>('open')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<ConsultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [row, setRow] = useState<ConsultRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // 멘트를 접어둘 수 있다 — 익숙해지면 표만 보고 적는다. 고른 대로 기억한다.
  const [showScript, setShowScript] = useState(() => localStorage.getItem('cs.script') !== '0')
  useEffect(() => { localStorage.setItem('cs.script', showScript ? '1' : '0') }, [showScript])

  const load = useCallback(() => {
    setLoading(true)
    consultAPI.list(scope, q.trim() || undefined)
      .then(r => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [scope, q])

  // 검색은 조금 기다렸다 — 한 글자마다 요청을 보내면 목록이 깜빡인다
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  /** 아직 서버에 안 보낸 변경 — 자동 저장이 이걸 비운다 */
  const pending = useRef<ConsultPatch>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    const id = openId
    const patch = pending.current
    if (!id || Object.keys(patch).length === 0) return
    pending.current = {}
    setSaving(true)
    try {
      const saved = await consultAPI.update(id, patch)
      setRow(cur => (cur && cur.id === saved.id ? { ...cur, ...saved } : cur))
      setItems(list => list.map(x => (x.id === saved.id ? { ...x, ...saved } : x)))
      setSavedAt(hm(new Date()))
    } catch (e: any) {
      // 저장에 실패하면 되돌려 담는다 — 다음 기회에 다시 보낸다.
      // 통화 중에 알림창을 띄우면 그 순간 대화가 끊긴다.
      pending.current = { ...patch, ...pending.current }
      setSavedAt(null)
    } finally { setSaving(false) }
  }, [openId])

  /** 칸 하나가 바뀌었다 — 화면은 즉시, 서버는 손을 멈춘 뒤 */
  const patch = (key: string, value: any) => {
    setRow(cur => (cur ? { ...cur, [key]: value } as ConsultRow : cur))
    pending.current = { ...pending.current, [key]: value }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, 1200)
  }

  // 화면을 닫기 전에 한 번 더 — 남은 것이 있으면 보낸다
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', before)
    return () => window.removeEventListener('beforeunload', before)
  }, [])

  const open = async (id: string) => {
    await flush()
    setOpenId(id); setSavedAt(null)
    const found = items.find(x => x.id === id)
    if (found) setRow(found)
    try { setRow(await consultAPI.get(id)) } catch { /* 목록 값으로라도 연다 */ }
  }

  const back = async () => {
    await flush()
    setOpenId(null); setRow(null); setSavedAt(null)
    load()
  }

  const create = async () => {
    setCreating(true)
    try {
      // 누르는 순간 서버에 한 줄을 만든다 — 그래야 통화 중에 적는 것이
      // 곧바로 저장된다. 빈 줄이 남는 것보다 한 통화를 잃는 쪽이 훨씬 나쁘다.
      const made = await consultAPI.create({
        consulted_on: todayISO(), consulted_at: nowHM(),
        counselor: me?.name ?? '', method: '전화', route: '전화',
      })
      setItems(list => [made, ...list])
      setOpenId(made.id); setRow(made); setSavedAt(null)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '상담을 시작하지 못했습니다.')
    } finally { setCreating(false) }
  }

  const remove = async () => {
    if (!row) return
    if (!confirm(`${consultTitle(row)} 상담 기록을 지울까요?\n\n되돌릴 수 없습니다.`)) return
    try {
      await consultAPI.remove(row.id)
      pending.current = {}
      setOpenId(null); setRow(null); load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '삭제에 실패했습니다.')
    }
  }

  const missing = useMemo(() => consultMissing(row), [row])

  // ── 목록 ──
  if (!openId || !row) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Phone size={20} className="text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">입소 상담</h1>
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-bold border border-indigo-100">
            {items.length}건
          </span>
          <button onClick={create} disabled={creating}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 새 상담
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          전화를 받으면서 그대로 채우는 한 장입니다. 적는 대로 자동 저장되고, 통화가 끝나면 그대로 인쇄할 수 있습니다.
        </p>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          {([['open', '진행 중'], ['done', '끝난 것'], ['all', '전체']] as [Scope, string][]).map(([s, label]) => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
                scope === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="어르신 · 보호자 · 연락처"
              className="w-56 pl-8 pr-7 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-sm text-gray-400">
              {q ? `「${q}」으로 찾은 상담이 없습니다.` : '아직 적힌 상담이 없습니다. 전화를 받으시면 「새 상담」을 누르세요.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(c => {
              const miss = consultMissing(c).length
              const st = CONSULT_STATUS.find(s => s.key === c.status)
              const soon = c.followup_on && c.followup_on <= todayISO()
              return (
                <button key={c.id} onClick={() => open(c.id)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">{consultTitle(c)}</span>
                    {st && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>}
                    {miss > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle size={10} /> 덜 여쭌 것 {miss}
                      </span>
                    )}
                    {c.followup_on && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        soon ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        <CalendarClock size={10} /> 연락 {c.followup_on.slice(5).replace('-', '/')}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-gray-400">
                      {c.consulted_on.slice(5).replace('-', '/')}{c.consulted_at ? ` ${c.consulted_at}` : ''} · {c.counselor || '상담자 미상'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                    {[c.grade, c.benefit, c.copay].filter(Boolean).join(' · ') || <span className="text-gray-300">등급 미확인</span>}
                    {c.guardian_name && <span className="text-gray-400">· 보호자 {c.guardian_name}{c.guardian_relation ? `(${c.guardian_relation})` : ''} {c.guardian_phone ?? ''}</span>}
                    {c.wish_date && <span className="text-gray-400">· 희망 {c.wish_date.slice(5).replace('-', '/')}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── 상담 한 건 ──
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto print:p-0 print:max-w-none">
      <div className="print:hidden" data-print="off">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <button onClick={back} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
            <ArrowLeft size={14} /> 목록
          </button>
          <h1 className="text-lg font-bold text-gray-900">{consultTitle(row)}</h1>
          <span className="text-[11px] text-gray-400">
            {saving ? '저장 중…' : savedAt ? `자동 저장됨 ${savedAt}` : '적는 대로 저장됩니다'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setShowScript(v => !v)}
              title="통화에서 여쭐 말을 함께 보여줍니다"
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors ${
                showScript ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-400 border-gray-200'}`}>
              <MessageSquareQuote size={13} /> 멘트
            </button>
            <button onClick={async () => { await flush(); window.print() }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold">
              <Printer size={13} /> 인쇄
            </button>
            {canDelete && (
              <button onClick={remove} title="상담 기록 삭제"
                className="p-2 rounded-xl border border-gray-200 text-gray-300 hover:text-rose-600 hover:border-rose-200">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 진행 상태 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[11px] font-bold text-gray-400 mr-1">진행</span>
          {CONSULT_STATUS.map(s => (
            <button key={s.key} onClick={() => patch('status', s.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                row.status === s.key ? s.cls : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* 끊기 전에 여쭐 것 */}
        {missing.length > 0 && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-amber-900">끊기 전에 여쭐 것 {missing.length}가지</p>
                <p className="text-[11px] text-amber-800 mt-0.5">{missing.map(f => f.label).join(' · ')}</p>
                <p className="text-[10.5px] text-amber-700/80 mt-1">
                  비어 있어도 저장됩니다. 다만 등급·본인부담금을 안 여쭈면 입소 직전에 다시 연락드려야 합니다.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {CONSULT_SECTIONS.map(sec => (
            <section key={sec.key} className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <h2 className="text-sm font-bold text-gray-900 mb-1.5">{sec.title}</h2>
              {showScript && (
                <p className="mb-3 rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2 text-[12px] text-indigo-900 leading-relaxed">
                  <span className="font-bold text-indigo-600 mr-1">멘트</span>“{sec.script}”
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-3">
                {sec.fields.map(f => (
                  <Field key={f.key} f={f} value={(row as any)[f.key]} onChange={v => patch(f.key, v)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 mt-3">
          적은 사람 {row.created_by ?? '—'}
          {row.updated_by && row.updated_by !== row.created_by && ` · 마지막 수정 ${row.updated_by}`}
        </p>
      </div>

      {/* ── 인쇄 — 상담 기록지 한 장 ── */}
      <div className="hidden print:block cs-print">
        <div style={{ borderBottom: '2.5px solid #4338ca', paddingBottom: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 800, color: '#4338ca', letterSpacing: '0.2em', margin: 0 }}>
                행복한요양원 · 정성으로 모시겠습니다
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '2px 0 0', letterSpacing: '0.06em' }}>
                입소 상담 기록지
              </h1>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#6b7280' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>{consultTitle(row)}</div>
              <div>
                {row.consulted_on}{row.consulted_at ? ` ${row.consulted_at}` : ''} · 상담자 {row.counselor || '—'}
                {' · '}{STATUS_LABEL[row.status] ?? row.status}
              </div>
            </div>
          </div>
        </div>

        {CONSULT_SECTIONS.map(sec => (
          <div key={sec.key} style={{ marginBottom: 6, breakInside: 'avoid' }}>
            <div style={{
              background: '#eef2ff', border: '1px solid #c7d2fe', color: '#3730a3',
              fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, marginBottom: 3,
            }}>{sec.title}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              {/* 여섯 칸 — 이름칸·값칸이 세 쌍. 모든 줄이 정확히 여섯 칸을 채워야
                  줄마다 칸 너비가 달라지지 않는다. */}
              <colgroup>
                {['l0', 'v0', 'l1', 'v1', 'l2', 'v2'].map(k => (
                  <col key={k} style={{ width: k[0] === 'l' ? '13%' : '20.33%' }} />
                ))}
              </colgroup>
              <tbody>
                {rowsOf(sec.fields).map((line, li) => {
                  const used = line.reduce((n, f) => n + (f.span ?? 1), 0)
                  return (
                    <tr key={li}>
                      {line.map((f, fi) => (
                        <PrintCell key={f.key} f={f} row={row}
                          // 마지막 칸이 남은 자리를 메운다 — 안 그러면 줄이 짧게 끝나 표가 어긋난다
                          span={(f.span ?? 1) + (fi === line.length - 1 ? 3 - used : 0)} />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <p style={{ fontSize: 8.5, color: '#9ca3af', textAlign: 'right', margin: '6px 2px 0' }}>
          출력 {new Date().toLocaleDateString('ko-KR')} · 어르신 건강 상태와 보호자 연락처가 적힌 문서입니다 — 보관·폐기에 주의해 주세요.
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          .cs-print { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #111; }
          .cs-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cs-print table { break-inside: auto; }
          .cs-print tr { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

/** 인쇄 표를 세 칸짜리 줄로 나눈다 — 긴 칸(span 3)은 한 줄을 통째로 쓴다 */
function rowsOf(fields: ConsultField[]): ConsultField[][] {
  const out: ConsultField[][] = []
  let line: ConsultField[] = []
  let used = 0
  for (const f of fields) {
    const sp = f.span ?? 1
    if (used + sp > 3 && line.length) { out.push(line); line = []; used = 0 }
    line.push(f); used += sp
  }
  if (line.length) out.push(line)
  return out
}

/** 이름칸 + 값칸 한 쌍.
 *
 *  값칸에 높이를 준다. 빈 기록지를 뽑아 통화하면서 손으로 적는 일이 실제로
 *  있어서, 칸이 눌려 있으면 적을 자리가 없다. 긴 칸은 더 높게.
 */
function PrintCell({ f, row, span }: { f: ConsultField; row: ConsultRow; span: number }) {
  const b = '1px solid #cbd5e1'
  const tall = f.type === 'textarea' || f.type === 'chips'
  return (
    <>
      <td style={{
        border: b, background: '#f8fafc', fontSize: 9.5, fontWeight: 700, color: '#475569',
        padding: '3px 5px', verticalAlign: 'top', wordBreak: 'keep-all', lineHeight: 1.25,
      }}>{f.label}</td>
      <td colSpan={span * 2 - 1} style={{
        border: b, fontSize: 10.5, padding: '3px 6px', verticalAlign: 'top',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        height: tall ? '10mm' : '6.5mm', lineHeight: 1.3,
      }}>{showValue(row, f)}</td>
    </>
  )
}

/** 칸 하나 — 종류에 따라 다르게 그린다 */
function Field({ f, value, onChange }: {
  f: ConsultField
  value: any
  onChange: (v: any) => void
}) {
  const span = f.span ?? 1
  const colCls = span === 3 ? 'sm:col-span-3' : span === 2 ? 'sm:col-span-2' : ''
  const v = value === null || value === undefined ? '' : String(value)
  const inputCls = 'w-full px-2.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200'

  return (
    <div className={colCls}>
      <label className="block text-[11px] font-bold text-gray-500 mb-1">
        {f.label}
        {f.unit && <span className="font-normal text-gray-300 ml-1">({f.unit})</span>}
      </label>

      {f.type === 'choice' && (
        <div className="flex flex-wrap gap-1">
          {f.options!.map(o => (
            <button key={o} type="button"
              // 고른 것을 다시 누르면 지운다 — 잘못 누른 것을 되돌릴 길이 있어야 한다
              onClick={() => onChange(v === o ? '' : o)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                v === o ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {v === o && <Check size={10} className="inline mr-0.5 -mt-0.5" />}{o}
            </button>
          ))}
        </div>
      )}

      {f.type === 'chips' && (
        <>
          <div className="flex flex-wrap gap-1 mb-1">
            {f.options!.map(o => {
              const on = hasChip(v, o)
              return (
                <button key={o} type="button" onClick={() => onChange(toggleChip(v, o))}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {on && <Check size={10} className="inline mr-0.5 -mt-0.5" />}{o}
                </button>
              )
            })}
          </div>
          {/* 고른 것과 손으로 덧붙인 말이 한 줄에 함께 담긴다 — 종이에도 이대로 찍힌다 */}
          <input value={v} onChange={e => onChange(e.target.value)} placeholder="누르거나, 들으신 그대로 적으셔도 됩니다"
            className={inputCls} />
        </>
      )}

      {f.type === 'textarea' && (
        <textarea value={v} onChange={e => onChange(e.target.value)} rows={2} placeholder={f.placeholder}
          className={inputCls + ' resize-y min-h-[52px]'} />
      )}

      {(f.type === 'text' || f.type === 'number' || f.type === 'date' || f.type === 'time') && (
        <input
          type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
          inputMode={f.type === 'number' ? 'numeric' : undefined}
          value={v} placeholder={f.placeholder}
          onChange={e => onChange(e.target.value)}
          className={inputCls} />
      )}

      {f.hint && <p className="text-[10.5px] text-gray-400 mt-1 leading-snug">{f.hint}</p>}
    </div>
  )
}

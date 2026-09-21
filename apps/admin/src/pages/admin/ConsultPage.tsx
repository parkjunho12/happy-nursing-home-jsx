import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Phone, Plus, Printer, Search, ArrowLeft, Trash2, Loader2, X,
  AlertCircle, CalendarClock, MessageSquareQuote, Check, Users, Unlink, CornerDownLeft, PenLine,
} from 'lucide-react'
import { consultAPI, type ConsultRow, type ConsultPatch } from '@/api/consultClient'
import { useAuthStore } from '@/store/auth'
import {
  CONSULT_STATUS, STATUS_LABEL,
  appendNote, consultMissing, consultTitle, hasChip,
  isRequiredKey, sectionProgress, showValue, toggleChip, visibleSections,
  type ConsultField,
} from '@/utils/consultForm'

/**
 * 입소 상담 — 전화를 받으면서 그대로 채우는 한 장.
 *
 *  ■ 통화 중에 쓰는 화면이라는 것이 모든 결정의 근거다
 *
 *    ① 저장을 누를 손이 없다 → 손을 멈추면 알아서 저장한다.
 *    ② 보호자는 표 순서대로 말씀하지 않는다 → 아무 대목이나 한 번에 가고,
 *       맨 아래 '빠르게 적기' 에 들리는 대로 쌓았다가 나중에 옮긴다.
 *    ③ 끊고 나서 다시 전화하는 것이 가장 나쁘다 → 성함·등급·급여·본인부담·
 *       연락처를 맨 위에 붙박이로 두고, 안 여쭌 것 개수를 늘 띄운다.
 *       누르면 그 칸으로 데려간다.
 *    ④ 통화 중에 알림창이 뜨면 대화가 끊긴다 → 저장 실패도 조용히 다시 보낸다.
 *
 *  ■ 부부
 *
 *    한 통화에서 두 분을 상담하지만 기록은 한 분에 한 장이다. 등급·건강
 *    상태가 사람마다 다르고, 한 분만 입소하게 되는 경우가 잦아 한 장에 섞어
 *    적으면 그때 쪼갤 수 없다. 위에서 두 분을 한 번에 오가고, 인쇄하면
 *    두 장이 함께 나온다.
 */

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const nowHM = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16)
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const mmdd = (iso?: string | null) => (iso ? iso.slice(5).replace('-', '/') : '')

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
  /** 부부일 때 짝의 전체 기록 — 인쇄에 두 장을 함께 내려고 들고 있는다 */
  const [mate, setMate] = useState<ConsultRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)
  const [showScript, setShowScript] = useState(() => localStorage.getItem('cs.script') !== '0')
  useEffect(() => { localStorage.setItem('cs.script', showScript ? '1' : '0') }, [showScript])
  /**
   * 보는 방식. 기본은 '한 대목씩'.
   *
   * 통화는 차례로 흘러간다. 마흔 몇 칸을 한 화면에 펼쳐두면 어디를 적는
   * 중인지 놓치고, 그러면 같은 것을 두 번 여쭙게 된다. 지난 상담을 훑을
   * 때는 한 번에 보는 편이 나아서 '전체 보기' 를 남겨둔다.
   */
  const [mode, setMode] = useState<'step' | 'all'>(
    () => (localStorage.getItem('cs.mode') === 'all' ? 'all' : 'step'))
  useEffect(() => { localStorage.setItem('cs.mode', mode) }, [mode])
  const [step, setStep] = useState(0)

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
  // 저장 대상이 바뀌어도 같은 함수를 쓴다 — 부부를 오갈 때 옛 id 로 보내면 안 된다
  const openIdRef = useRef<string | null>(null)
  openIdRef.current = openId

  const flush = useCallback(async () => {
    const id = openIdRef.current
    const p = pending.current
    if (!id || Object.keys(p).length === 0) return
    pending.current = {}
    setSaving(true)
    try {
      const saved = await consultAPI.update(id, p)
      setRow(cur => (cur && cur.id === saved.id ? { ...cur, ...saved } : cur))
      setItems(list => list.map(x => (x.id === saved.id ? { ...x, ...saved } : x)))
      setSavedAt(hm(new Date()))
      // 부부 공통 칸은 서버가 짝에도 적는다 — 손에 든 짝도 같이 맞춘다
      if (saved.partner_id && ('couple_room' in p || 'cost_guided' in p)) {
        setMate(m => (m ? { ...m, couple_room: saved.couple_room, cost_guided: saved.cost_guided } : m))
      }
    } catch {
      // 통화 중에 알림창을 띄우면 그 순간 대화가 끊긴다. 되돌려 담고 다음에 보낸다.
      pending.current = { ...p, ...pending.current }
      setSavedAt(null)
    } finally { setSaving(false) }
  }, [])

  /** 칸 하나가 바뀌었다 — 화면은 즉시, 서버는 손을 멈춘 뒤 */
  const patch = (key: string, value: any) => {
    setRow(cur => (cur ? { ...cur, [key]: value } as ConsultRow : cur))
    pending.current = { ...pending.current, [key]: value }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, 1200)
  }

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
    setOpenId(id); setSavedAt(null); setMate(null); setQuick(''); setStep(0)
    const found = items.find(x => x.id === id)
    if (found) setRow(found)
    try {
      const full = await consultAPI.get(id)
      setRow(full)
      if (full.partner_id) consultAPI.get(full.partner_id).then(setMate).catch(() => setMate(null))
    } catch { /* 목록 값으로라도 연다 */ }
  }

  const back = async () => {
    await flush()
    setOpenId(null); setRow(null); setMate(null); setSavedAt(null)
    load()
  }

  const create = async () => {
    setBusy(true)
    try {
      // 누르는 순간 서버에 한 줄을 만든다 — 그래야 통화 중에 적는 것이 곧바로 저장된다
      const made = await consultAPI.create({
        consulted_on: todayISO(), consulted_at: nowHM(),
        counselor: me?.name ?? '', method: '전화', route: '전화',
      })
      setItems(list => [made, ...list])
      setOpenId(made.id); setRow(made); setMate(null); setSavedAt(null); setQuick(''); setStep(0)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '상담을 시작하지 못했습니다.')
    } finally { setBusy(false) }
  }

  const addPartner = async () => {
    if (!row) return
    await flush()
    setBusy(true)
    try {
      const made = await consultAPI.addPartner(row.id)
      const mine = await consultAPI.get(row.id)   // 이쪽에도 짝이 생겼다
      setRow(mine); setMate(made)
      setItems(list => [made, ...list.map(x => (x.id === mine.id ? mine : x))])
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '배우자 상담을 만들지 못했습니다.')
    } finally { setBusy(false) }
  }

  const unlink = async () => {
    if (!row) return
    if (!confirm('부부 묶음을 풀까요?\n\n두 장 모두 그대로 남고, 서로 연결만 끊어집니다.')) return
    await flush()
    setBusy(true)
    try {
      const mine = await consultAPI.unlink(row.id)
      setRow(mine); setMate(null); load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '묶음을 풀지 못했습니다.')
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!row) return
    if (!confirm(`${consultTitle(row)} 상담 기록을 지울까요?\n\n되돌릴 수 없습니다.`)) return
    try {
      await consultAPI.remove(row.id)
      pending.current = {}
      setOpenId(null); setRow(null); setMate(null); load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? '삭제에 실패했습니다.')
    }
  }

  const isCouple = !!row?.partner_id
  const sections = useMemo(() => visibleSections(isCouple), [isCouple])
  const missing = useMemo(() => consultMissing(row, isCouple), [row, isCouple])
  // 부부 묶음을 풀면 대목이 하나 줄어든다 — 보던 자리가 목록 밖으로 나가지 않게
  useEffect(() => { setStep(v => Math.min(v, sections.length)) }, [sections.length])

  /** 그 칸으로 데려간다 — '무엇이 비었다' 만 알려주면 찾으러 헤매야 한다.
   *  한 대목씩 보는 중이면 그 칸이 있는 대목으로 먼저 옮긴다. */
  const gotoField = (key: string) => {
    if (mode === 'step') {
      const i = sections.findIndex(s2 => s2.fields.some(f => f.key === key))
      if (i >= 0 && i !== step) {
        setStep(i)
        // 대목이 바뀌면 그 칸은 다음 그림에서야 생긴다
        setTimeout(() => gotoField(key), 60)
        return
      }
    }
    const el = document.getElementById(`cs-${key}`)
    if (!el) return
    // 부드럽게 굴리지 않는다. 이 화면은 스크롤되는 상자 안에 들어 있어
    // smooth 가 중간에 취소되는 일이 있었고(아무 데도 못 감), 통화 중에는
    // 기다릴 시간도 없다. 바로 데려다 놓고 노란 불로 어디인지 알린다.
    el.scrollIntoView({ block: 'center' })
    const first = el.querySelector('input, textarea, button') as HTMLElement | null
    first?.focus({ preventScroll: true })
    el.classList.add('cs-flash')
    setTimeout(() => el.classList.remove('cs-flash'), 1600)
  }

  const goSection = (key: string) =>
    document.getElementById(`cs-sec-${key}`)?.scrollIntoView({ block: 'start' })

  /** 들리는 대로 한 줄 — 특이사항 맨 뒤에 쌓는다 */
  const addQuick = () => {
    const line = quick.trim()
    if (!line || !row) return
    patch('notes', appendNote(row.notes, line))
    setQuick('')
    setQuickOpen(false)
  }

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
          <button onClick={create} disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 새 상담
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          전화를 받으면서 그대로 채우는 한 장입니다. 적는 대로 자동 저장되고, 통화가 끝나면 그대로 인쇄할 수 있습니다.
          부부를 함께 상담하실 때는 상담을 연 뒤 「배우자 상담 추가」를 누르세요.
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
              const miss = consultMissing(c, !!c.partner_id).length
              const st = CONSULT_STATUS.find(s => s.key === c.status)
              const soon = c.followup_on && c.followup_on <= todayISO()
              return (
                <button key={c.id} onClick={() => open(c.id)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">{consultTitle(c)}</span>
                    {c.partner && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                        <Users size={10} /> 부부 · 배우자 {c.partner.resident_name || '성함 미상'}
                      </span>
                    )}
                    {st && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>}
                    {miss > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle size={10} /> 덜 여쭌 것 {miss}
                      </span>
                    )}
                    {c.followup_on && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        soon ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        <CalendarClock size={10} /> 연락 {mmdd(c.followup_on)}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-gray-400">
                      {mmdd(c.consulted_on)}{c.consulted_at ? ` ${c.consulted_at}` : ''} · {c.counselor || '상담자 미상'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                    {[c.grade, c.benefit, c.copay].filter(Boolean).join(' · ') || <span className="text-gray-300">등급 미확인</span>}
                    {c.guardian_name && <span className="text-gray-400">· 보호자 {c.guardian_name}{c.guardian_relation ? `(${c.guardian_relation})` : ''} {c.guardian_phone ?? ''}</span>}
                    {c.wish_date && <span className="text-gray-400">· 희망 {mmdd(c.wish_date)}</span>}
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
  const sheets = mate ? [row, mate] : [row]
  // 한 단계씩 볼 때의 자리. 마지막 자리는 '마무리' 다.
  const lastStep = sections.length
  const at = Math.min(step, lastStep)
  const sec = sections[at]

  return (
    <div className="print:p-0">
      <div className="print:hidden" data-print="off">
        {/* ── 머리줄 ── 통화 중에 눈이 가는 곳은 적을 칸이지 단추가 아니다.
            여기에는 '어디서 나가는지' 와 '저장됐는지' 만 둔다. */}
        <div className="sticky top-14 md:top-0 z-30 -mx-3 md:-mx-6 px-3 md:px-6 py-2 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            <button onClick={back}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50">
              <ArrowLeft size={15} /> 목록
            </button>

            {mate ? (
              <div className="inline-flex items-center rounded-xl border border-pink-200 bg-pink-50 overflow-hidden">
                <span className="px-2 py-2 text-[11px] font-extrabold text-pink-700">부부</span>
                <span className="px-3 py-2 text-sm font-bold bg-white text-gray-900 border-x border-pink-200">
                  {row.resident_name || '성함 미상'}
                </span>
                <button onClick={() => open(mate.id)} title="배우자 상담으로 넘어갑니다"
                  className="px-3 py-2 text-sm font-bold text-pink-700 hover:bg-pink-100">
                  {mate.resident_name || '배우자'} →
                </button>
              </div>
            ) : (
              <h1 className="text-base font-bold text-gray-900">{consultTitle(row)}</h1>
            )}

            <span className={`text-xs ${saving ? 'text-indigo-600' : savedAt ? 'text-emerald-600' : 'text-gray-400'}`}>
              {saving ? '저장 중…' : savedAt ? `저장됨 ${savedAt}` : '적는 대로 저장됩니다'}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setMode(m => (m === 'step' ? 'all' : 'step'))}
                title={mode === 'step' ? '모든 항목을 한 화면에 펼칩니다' : '한 대목씩 차례로 봅니다'}
                className="px-2.5 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50">
                {mode === 'step' ? '전체 보기' : '한 대목씩'}
              </button>
              <button onClick={async () => { await flush(); window.print() }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold">
                <Printer size={13} /> 인쇄{mate ? ' 2장' : ''}
              </button>
              {canDelete && (
                <button onClick={remove} title="상담 기록 삭제"
                  className="p-2 rounded-xl border border-gray-200 text-gray-300 hover:text-rose-600 hover:border-rose-200">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-3 md:px-6 py-3 pb-40 md:pb-24">
          {/* 대목 고르기 — 이름이 그대로 적혀 있어 따로 배울 것이 없다.
              다 적은 대목에는 체크가 붙는다. */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-3">
            {sections.map((s, i) => {
              const p = sectionProgress(row, s)
              const here = mode === 'step' && i === at
              return (
                <button key={s.key} onClick={() => (mode === 'step' ? setStep(i) : goSection(s.key))}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] font-bold border transition-colors ${
                    here ? 'bg-indigo-600 text-white border-indigo-600'
                      : p.done === p.total ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {p.done === p.total && !here && <Check size={12} />}{s.title}
                </button>
              )
            })}
            {mode === 'step' && (
              <button onClick={() => setStep(lastStep)}
                className={`shrink-0 px-3 py-2 rounded-xl text-[13px] font-bold border ${
                  at === lastStep ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                마무리
              </button>
            )}
          </div>

          {mate && (
            <div className="rounded-2xl border border-pink-200 bg-pink-50/70 px-3 py-2.5 text-[13px] text-pink-900 leading-relaxed mb-3">
              <b>부부 상담입니다.</b> 지금은 <b>{row.resident_name || '이분'}</b> 기록지를 적고 있습니다.
              등급과 건강 상태는 두 분이 다르니 각각 여쭤 주세요.
            </div>
          )}

          {/* ── 한 대목씩 ── 통화는 차례로 흘러간다. 한 화면에 한 대목만 두면
              어디를 적는 중인지 헷갈리지 않는다. */}
          {mode === 'step' ? (
            at === lastStep ? (
              <Wrap title="마무리">
                {missing.length > 0 ? (
                  <>
                    <p className="text-[13.5px] font-bold text-amber-900 mb-2">
                      끊기 전에 {missing.length}가지만 더 여쭤 주세요
                    </p>
                    <div className="space-y-1.5 mb-4">
                      {missing.map(f => (
                        <button key={f.key} onClick={() => gotoField(f.key)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left">
                          <AlertCircle size={14} className="text-amber-600 shrink-0" />
                          <span className="text-[14px] font-bold text-amber-900">{f.label}</span>
                          <span className="ml-auto text-[12px] font-bold text-amber-700">적기 ▸</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-[14px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-4">
                    <Check size={16} /> 여쭐 것은 다 여쭸습니다
                  </p>
                )}

                <p className="text-[12px] font-bold text-gray-500 mb-1.5">이 상담은 어떻게 되었나요?</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {CONSULT_STATUS.map(s => (
                    <button key={s.key} onClick={() => patch('status', s.key)}
                      className={`px-3 py-2 rounded-xl text-[13px] font-bold border ${
                        row.status === s.key ? s.cls : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={async () => { await flush(); window.print() }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-bold">
                    <Printer size={14} /> 인쇄{mate ? ' 2장' : ''}
                  </button>
                  {!mate && (
                    <button onClick={addPartner} disabled={busy}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50 text-pink-700 text-sm font-bold hover:bg-pink-100 disabled:opacity-50">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Users size={14} />} 부부라서 한 장 더
                    </button>
                  )}
                  {mate && (
                    <button onClick={unlink} disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50">
                      <Unlink size={13} /> 부부 묶음 풀기
                    </button>
                  )}
                  <button onClick={back}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50">
                    목록으로
                  </button>
                </div>
              </Wrap>
            ) : (
              <>
                <Wrap title={sec.title} tone={sec.coupleOnly ? 'pink' : sec.key_point ? 'indigo' : 'plain'}
                  badge={sec.key_point ? '비용이 걸린 대목' : undefined}
                  step={`${at + 1} / ${sections.length}`}
                  onScript={() => setShowScript(v => !v)} scriptOn={showScript}>
                  {showScript && <Script text={sec.script} />}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    {sec.fields.map(f => (
                      <Field key={f.key} f={f} value={(row as any)[f.key]}
                        required={isRequiredKey(f.key, isCouple)} onChange={v => patch(f.key, v)} />
                    ))}
                  </div>
                </Wrap>

              </>
            )
          ) : (
            /* ── 전체 보기 ── 지난 상담을 훑어볼 때 */
            <div className="space-y-3">
              {sections.map(s => (
                <div key={s.key} id={`cs-sec-${s.key}`} className="scroll-mt-32">
                  <Wrap title={s.title} tone={s.coupleOnly ? 'pink' : s.key_point ? 'indigo' : 'plain'}
                    badge={s.key_point ? '비용이 걸린 대목' : undefined}>
                    {showScript && <Script text={s.script} />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                      {s.fields.map(f => (
                        <Field key={f.key} f={f} value={(row as any)[f.key]}
                          required={isRequiredKey(f.key, isCouple)} onChange={v => patch(f.key, v)} />
                      ))}
                    </div>
                  </Wrap>
                </div>
              ))}
              <Wrap title="진행">
                <div className="flex flex-wrap gap-1.5">
                  {CONSULT_STATUS.map(s => (
                    <button key={s.key} onClick={() => patch('status', s.key)}
                      className={`px-3 py-2 rounded-xl text-[13px] font-bold border ${
                        row.status === s.key ? s.cls : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </Wrap>
              <p className="text-[12px] text-gray-400">
                적은 사람 {row.created_by ?? '—'}
                {row.updated_by && row.updated_by !== row.created_by && ` · 마지막 수정 ${row.updated_by}`}
              </p>
            </div>
          )}
        </div>

        {/* ── 바닥에 붙은 줄 ──
            「다음」은 통화 한 번에 예닐곱 번 누른다. 본문 끝에 두면 대목마다
            스크롤해서 찾아야 하므로 자리를 고정한다. 통화 메모는 가끔 쓰니
            평소에는 단추 하나로 접어 두고, 누르면 그 자리에서 펼쳐진다. */}
        <div className="cs-quick fixed left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-3 md:px-6 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            {quickOpen ? (
              <>
                <input autoFocus value={quick} onChange={e => setQuick(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addQuick() }
                    if (e.key === 'Escape') { setQuick(''); setQuickOpen(false) }
                  }}
                  placeholder="들리는 대로 적고 Enter — 특이사항에 쌓입니다"
                  className="flex-1 min-w-0 px-3 py-2.5 text-[16px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                <button onClick={addQuick} disabled={!quick.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-bold disabled:opacity-30">
                  <CornerDownLeft size={14} /> 담기
                </button>
                <button onClick={() => { setQuick(''); setQuickOpen(false) }}
                  className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50">
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setQuickOpen(true)} title="들리는 대로 한 줄 적어두기"
                  className="inline-flex items-center gap-1 px-3 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 shrink-0">
                  <PenLine size={15} /> 메모
                </button>
                {mode === 'step' && (
                  <>
                    <button onClick={() => setStep(Math.max(0, at - 1))} disabled={at === 0}
                      className="px-3 sm:px-4 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 disabled:opacity-30 shrink-0">
                      ◂<span className="hidden sm:inline"> 이전</span>
                    </button>
                    {at < lastStep ? (
                      <button onClick={() => setStep(at + 1)}
                        className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[15px] font-bold truncate">
                        {at === sections.length - 1 ? '마무리 ▸' : `다음 — ${sections[at + 1].title} ▸`}
                      </button>
                    ) : (
                      <button onClick={back}
                        className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-gray-800 hover:bg-gray-900 text-white text-[15px] font-bold">
                        상담 마치고 목록으로
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>


      {/* ── 인쇄 — 부부면 두 장이 함께 나간다 ── */}
      <div className="hidden print:block">
        {sheets.map((sheet, si) => (
          <div key={sheet.id} className="cs-print cs-sheet">
            <div style={{ borderBottom: '2.5px solid #4338ca', paddingBottom: 6, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, color: '#4338ca', letterSpacing: '0.2em', margin: 0 }}>
                    행복한요양원 · 정성으로 모시겠습니다
                  </p>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '2px 0 0', letterSpacing: '0.06em' }}>
                    입소 상담 기록지
                    {sheets.length > 1 && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#be185d', marginLeft: 8 }}>
                        부부 상담 {si + 1}/{sheets.length}
                      </span>
                    )}
                  </h1>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10, color: '#6b7280' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>{consultTitle(sheet)}</div>
                  <div>
                    {sheet.consulted_on}{sheet.consulted_at ? ` ${sheet.consulted_at}` : ''} · 상담자 {sheet.counselor || '—'}
                    {' · '}{STATUS_LABEL[sheet.status] ?? sheet.status}
                  </div>
                  {sheets.length > 1 && (
                    <div style={{ color: '#be185d', fontWeight: 700 }}>
                      배우자 {(si === 0 ? sheets[1] : sheets[0]).resident_name || '성함 미상'} 님과 함께 상담
                    </div>
                  )}
                </div>
              </div>
            </div>

            {visibleSections(!!sheet.partner_id).map(sec => (
              <div key={sec.key} style={{ marginBottom: 6, breakInside: 'avoid' }}>
                <div style={{
                  background: sec.coupleOnly ? '#fdf2f8' : '#eef2ff',
                  border: `1px solid ${sec.coupleOnly ? '#fbcfe8' : '#c7d2fe'}`,
                  color: sec.coupleOnly ? '#9d174d' : '#3730a3',
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
                            <PrintCell key={f.key} f={f} row={sheet}
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
        ))}
      </div>

      <style>{`
        /* 폰에서는 아래 탭바(56px) 위에 올린다 — 겹치면 가려져 못 쓴다.
           넓은 화면에는 탭바가 없으니 바닥에 붙인다. */
        .cs-quick { bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 768px) { .cs-quick { bottom: 0; } }
        .cs-flash { animation: csFlash 1.6s ease-out; border-radius: 12px; }
        @keyframes csFlash {
          0%, 40% { background: #fef3c7; box-shadow: 0 0 0 6px #fef3c7; }
          100% { background: transparent; box-shadow: 0 0 0 6px transparent; }
        }
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          .cs-print { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #111; }
          .cs-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cs-sheet { page-break-after: always; }
          .cs-sheet:last-child { page-break-after: auto; }
          .cs-print tr { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}


/** 흰 상자 하나 — 대목마다 같은 모양으로 */
function Wrap({ title, children, tone = 'plain', badge, step, onScript, scriptOn }: {
  title: string
  children: React.ReactNode
  tone?: 'plain' | 'indigo' | 'pink'
  badge?: string
  step?: string
  onScript?: () => void
  scriptOn?: boolean
}) {
  const border = tone === 'pink' ? 'border-pink-200 ring-1 ring-pink-100'
    : tone === 'indigo' ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'
  return (
    <section className={`bg-white rounded-2xl border px-4 py-3.5 ${border}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
        {badge && (
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {onScript && (
            <button onClick={onScript} title="통화에서 여쭐 말"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11.5px] font-bold ${
                scriptOn ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-400 border-gray-200'}`}>
              <MessageSquareQuote size={12} /> 멘트
            </button>
          )}
          {step && <span className="text-[12px] font-bold text-gray-400">{step}</span>}
        </span>
      </div>
      {children}
    </section>
  )
}

/** 멘트 — 읽어야 하는 대본이 아니라 막혔을 때 보는 줄이다 */
function Script({ text }: { text: string }) {
  return (
    <p className="mb-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2.5 text-[14px] text-indigo-900 leading-relaxed">
      <span className="font-bold text-indigo-600 mr-1">이렇게 여쭤보세요</span><br />
      “{text}”
    </p>
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

/** 이름칸 + 값칸 한 쌍. 값칸에 높이를 주어 빈 기록지에 손으로 적을 수 있게 한다. */
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

/** 칸 하나 — 글자와 단추를 키웠다. 통화하면서 누르는 것이라 작으면 두 번 누르게 된다. */
function Field({ f, value, onChange, required }: {
  f: ConsultField
  value: any
  onChange: (v: any) => void
  required?: boolean
}) {
  const colCls = (f.span ?? 1) >= 2 ? 'sm:col-span-2' : ''
  const v = value === null || value === undefined ? '' : String(value)
  const empty = !v.trim()
  // 16px — 폰에서 이보다 작으면 칸을 누를 때 화면이 확대된다
  const inputCls = `w-full px-3 py-2.5 text-[16px] border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
    required && empty ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`
  const chipCls = (on: boolean) =>
    `px-3 py-2.5 rounded-xl text-[14px] font-bold border transition-colors ${
      on ? 'bg-indigo-600 text-white border-indigo-600'
         : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200'}`

  return (
    <div className={colCls} id={`cs-${f.key}`}>
      <label className="flex items-center gap-1 text-[13px] font-bold text-gray-600 mb-1.5">
        {f.label}
        {f.unit && <span className="font-normal text-gray-300">({f.unit})</span>}
        {required && empty && (
          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">꼭</span>
        )}
      </label>

      {f.type === 'choice' && (
        <div className="flex flex-wrap gap-1.5">
          {f.options!.map(o => (
            // 고른 것을 다시 누르면 지운다 — 잘못 누른 것을 되돌릴 길이 있어야 한다
            <button key={o} type="button" onClick={() => onChange(v === o ? '' : o)} className={chipCls(v === o)}>
              {v === o && <Check size={12} className="inline mr-0.5 -mt-0.5" />}{o}
            </button>
          ))}
        </div>
      )}

      {f.type === 'chips' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {f.options!.map(o => (
              <button key={o} type="button" onClick={() => onChange(toggleChip(v, o))} className={chipCls(hasChip(v, o))}>
                {hasChip(v, o) && <Check size={12} className="inline mr-0.5 -mt-0.5" />}{o}
              </button>
            ))}
          </div>
          {/* 고른 것과 손으로 덧붙인 말이 한 줄에 함께 담긴다 — 종이에도 이대로 찍힌다 */}
          <input value={v} onChange={e => onChange(e.target.value)}
            placeholder="누르거나, 들으신 그대로 적으셔도 됩니다" className={inputCls} />
        </>
      )}

      {f.type === 'textarea' && (
        <textarea value={v} onChange={e => onChange(e.target.value)} rows={2} placeholder={f.placeholder}
          className={inputCls + ' resize-y min-h-[58px]'} />
      )}

      {(f.type === 'text' || f.type === 'number' || f.type === 'date' || f.type === 'time') && (
        <input
          type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
          inputMode={f.type === 'number' ? 'numeric' : undefined}
          value={v} placeholder={f.placeholder}
          onChange={e => onChange(e.target.value)}
          className={inputCls} />
      )}

      {f.hint && <p className="text-[12px] text-gray-400 mt-1.5 leading-snug">{f.hint}</p>}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ShieldAlert, ChevronRight, Loader2, Check } from 'lucide-react'
import { residentDocAPI, type ResidentDoc } from '@/api/residentDocClient'
import { currentCert, certState, renewalDue } from '@/utils/cert'
import { asEvent, todayISO } from '@/utils/docEvents'

const fmt = (iso?: string | null) => {
  if (!iso) return '-'
  const [, m, d] = iso.split('-')
  const dt = new Date(iso + 'T00:00:00')
  return `${+m}.${+d}(${['일','월','화','수','목','금','토'][dt.getDay()]})`
}
const dday = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayISO() + 'T00:00:00').getTime()) / 86400000)

interface PlanRow { docId: string; idx: number; name: string; date: string; kind?: string | null; d: number }
interface CertRow { name: string; end: string; due: string; d: number; expired: boolean }

/** 앞으로 있을 급여제공계획서 작성 일정 · 인정서(등급) 만료 어르신 */
export default function UpcomingDocs() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ResidentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'plan' | 'cert'>('plan')
  const [doneBusy, setDoneBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  // 급여제공계획서 일정 완료 처리
  // ⚠ 낙관적 업데이트 금지 — 서버가 저장한 결과를 진실로 삼는다.
  //   (서버가 done 을 버리면 화면에서 즉시 되살아나 실패가 드러남)
  const completePlan = async (p: PlanRow) => {
    const key = `${p.docId}-${p.idx}`
    setDoneBusy(key); setErr('')
    try {
      const doc = rows.find(r => r.id === p.docId)
      if (!doc) return
      const next = (doc.plan_lines ?? []).map(asEvent).map((e, i) => i === p.idx ? { ...e, done: true } : e)
      const saved = await residentDocAPI.update(p.docId, { plan_lines: next })

      // 서버가 done 을 실제로 저장했는지 확인
      const savedDone = (saved.plan_lines ?? []).map(asEvent)[p.idx]?.done === true
      if (!savedDone) {
        setErr('완료 상태가 서버에 저장되지 않았습니다. 백엔드가 최신 버전인지 확인해주세요.')
        return
      }
      setRows(prev => prev.map(r => r.id === p.docId ? { ...r, ...saved } : r))
    } catch (e: any) {
      setErr(e?.message ?? '완료 처리에 실패했습니다.')
    } finally { setDoneBusy(null) }
  }

  useEffect(() => {
    residentDocAPI.list(false).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }, [])

  const plans: PlanRow[] = useMemo(() => {
    const today = todayISO()
    const out: PlanRow[] = []
    rows.forEach(r => {
      (r.plan_lines ?? []).map(asEvent).forEach((e, idx) => {
        if (e.done) return                       // 완료 처리된 일정은 숨김
        if (e.date && e.date >= today) {
          out.push({ docId: r.id, idx, name: r.name ?? '-', date: e.date, kind: e.kind, d: dday(e.date) })
        }
      })
    })
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  }, [rows])

  const certs: CertRow[] = useMemo(() => {
    const out: CertRow[] = []
    rows.forEach(r => {
      const cur = currentCert(r.certifications ?? [])
      const st = certState(cur)
      if (!cur?.end) return
      if (st.status === 'renew' || st.status === 'expired') {
        out.push({ name: r.name ?? '-', end: cur.end, due: renewalDue(cur.end), d: dday(cur.end), expired: st.status === 'expired' })
      }
    })
    return out.sort((a, b) => a.end.localeCompare(b.end)).slice(0, 5)
  }, [rows])

  const tabs = [
    { k: 'plan' as const, short: '계획서', label: '급여제공계획서', icon: FileText, count: plans.length, tone: 'text-sky-600' },
    { k: 'cert' as const, short: '갱신 대상', label: '인정서 갱신 대상', icon: ShieldAlert, count: certs.length, tone: 'text-amber-600' },
  ]

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-1 px-3 pt-2.5">
        {tabs.map(t => {
          const on = tab === t.k
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 px-2.5 md:px-3 py-2.5 md:py-2 min-h-[40px] rounded-xl text-xs font-bold transition-colors ${on ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}>
              <t.icon size={13} className={on ? t.tone : ''} />
              <span className="md:hidden">{t.short}</span>
              <span className="hidden md:inline">{t.label}</span>
              {t.count > 0 && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${t.k === 'cert' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{t.count}</span>
              )}
            </button>
          )
        })}
        <button onClick={() => navigate('/resident-docs')} className="ml-auto text-[11px] font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 inline-flex items-center">
          전체 <ChevronRight size={13} />
        </button>
      </div>

      <div className="px-3 pb-3 pt-1">
        {err && (
          <p className="mb-2 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
            {err}
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : tab === 'plan' ? (
          plans.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">예정된 급여제공계획서 작성 일정이 없습니다</p>
          ) : (
            <ul className="space-y-1 md:max-h-[220px] md:overflow-y-auto md:pr-0.5">
              {plans.map(p => (
                <li key={`${p.docId}-${p.idx}`}
                  className="flex items-center gap-2.5 px-1.5 md:px-2.5 py-2 min-h-[44px] rounded-xl hover:bg-sky-50/60 group">
                  <span className={`w-12 shrink-0 text-center text-[11px] font-extrabold rounded-lg py-1 ${p.d <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-sky-50 text-sky-600'}`}>
                    {p.d === 0 ? '오늘' : `D-${p.d}`}
                  </span>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/resident-docs')}>
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{fmt(p.date)}{p.kind ? ` · ${p.kind}` : ''}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); completePlan(p) }}
                    disabled={doneBusy === `${p.docId}-${p.idx}`}
                    title="작성 완료 처리"
                    aria-label="작성 완료 처리"
                    className="w-11 h-11 md:w-8 md:h-8 shrink-0 rounded-lg border border-gray-100 bg-gray-50 text-gray-300 hover:bg-sky-500 hover:text-white hover:border-sky-500 active:bg-sky-500 active:text-white flex items-center justify-center transition-colors disabled:opacity-50">
                    {doneBusy === `${p.docId}-${p.idx}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : certs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">인정서 만료 90일 이내인 어르신이 없습니다 👍</p>
        ) : (
          <>
            <p className="text-[10px] text-gray-400 px-1 pb-1.5">
              인정서 <b>만료 90일 이내</b>(D-90 이하) 어르신 — 갱신 신청 대상
            </p>
            <ul className="space-y-1 md:max-h-[220px] md:overflow-y-auto md:pr-0.5">
              {certs.map((c, i) => (
                <li key={i} onClick={() => navigate('/resident-docs')}
                  className="flex items-center gap-2.5 px-1.5 md:px-2.5 py-2 min-h-[44px] rounded-xl hover:bg-amber-50/60 cursor-pointer">
                  <span className={`w-12 shrink-0 text-center text-[11px] font-extrabold rounded-lg py-1 ${
                    c.expired ? 'bg-red-500 text-white' : c.d <= 30 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                    {c.expired ? '만료' : `D-${c.d}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {c.expired
                        ? <span className="text-red-500 font-semibold">만료 지남 · {fmt(c.end)}</span>
                        : <>만료 {fmt(c.end)} · 갱신기준일 {fmt(c.due)} 지남</>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

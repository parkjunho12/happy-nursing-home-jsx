import { useEffect, useMemo, useState } from 'react'
import { Landmark, Loader2, Save } from 'lucide-react'
import { pensionAPI, pensionRefundAPI, type PensionRow, type PensionRefundRow } from '@/api/pensionClient'

/**
 * 퇴직연금(DC) 적립 관리 — 직원별 월 부담금 발생·은행 입금 대장.
 * 임금을 넣으면 부담금(임금÷12)이 자동 계산되고, 누적 발생·입금·미납이 집계된다.
 */
const won = (n?: number | null) => n == null ? '' : n.toLocaleString('ko-KR')
const parseWon = (s: string) => { const n = Number(s.replace(/[^\d]/g, '')); return Number.isFinite(n) && n > 0 ? n : null }

type Draft = { wage: string; accrued: string; deposited: string; deposit_date: string; memo: string; dirty: boolean }

export default function PensionPage() {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [rows, setRows] = useState<PensionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)
  const [refunds, setRefunds] = useState<PensionRefundRow[]>([])
  const [refBusy, setRefBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    pensionAPI.month(ym).then(r => {
      setRows(r.rows)
      const d: Record<string, Draft> = {}
      r.rows.forEach(x => {
        d[x.staff_id] = {
          wage: won(x.wage ?? x.suggest_wage), accrued: won(x.accrued),
          deposited: won(x.deposited), deposit_date: x.deposit_date ?? '', memo: x.memo ?? '',
          dirty: x.wage == null && x.suggest_wage != null,   // 제안값이 채워진 행은 저장 대상
        }
      })
      setDrafts(d)
    }).catch(() => setRows([])).finally(() => setLoading(false))
    pensionRefundAPI.list().then(setRefunds).catch(() => setRefunds([]))
  }
  useEffect(load, [ym])

  const move = (d: number) => {
    const [y, m] = ym.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setYm(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const upd = (id: string, patch: Partial<Draft>) =>
    setDrafts(p => ({ ...p, [id]: { ...p[id], ...patch, dirty: true } }))

  // 임금 입력 → 부담금 자동 (수동으로 고치면 그 값 유지)
  const onWage = (id: string, v: string) => {
    const w = parseWon(v)
    upd(id, { wage: v, accrued: w ? won(Math.round(w / 12 / 10) * 10) : '' })   // 1의 자리 반올림(10원 단위)
  }

  const dirtyCount = Object.values(drafts).filter(d => d.dirty).length
  const saveAll = async () => {
    if (dirtyCount === 0) return
    setSaving(true)
    try {
      for (const [sid, d] of Object.entries(drafts)) {
        if (!d.dirty) continue
        await pensionAPI.save(ym, sid, {
          wage: parseWon(d.wage), accrued: parseWon(d.accrued),
          deposited: parseWon(d.deposited),
          deposit_date: d.deposit_date || null, memo: d.memo || null,
        })
      }
      load()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }

  // 합계 — 화면 초안 기준(이번 달), 누적은 서버 값
  const totals = useMemo(() => {
    let acc = 0, dep = 0, cumA = 0, cumD = 0
    rows.forEach(r => {
      const d = drafts[r.staff_id]
      acc += parseWon(d?.accrued ?? '') ?? 0
      dep += parseWon(d?.deposited ?? '') ?? 0
      cumA += r.cum_accrued; cumD += r.cum_deposited
    })
    return { acc, dep, cumA, cumD }
  }, [rows, drafts])

  const [y, m] = ym.split('-').map(Number)
  const td = 'px-2 py-1.5 border-b border-gray-50 text-sm'

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Landmark size={20} className="text-emerald-600" />
        <h1 className="text-xl font-bold text-gray-900">퇴직연금 관리</h1>
        <span className="text-[11px] text-gray-400">DC형 — 부담금은 월 임금 ÷ 12, 10원 단위 반올림 (수정 가능)</span>
        <button onClick={saveAll} disabled={dirtyCount === 0 || saving}
          className={`ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold ${dirtyCount ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border border-gray-200 text-gray-300'}`}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장{dirtyCount ? ` (${dirtyCount}명)` : ''}
        </button>
      </div>

      {/* 월 이동 + 요약 */}
      <div className="flex items-center gap-3 flex-wrap my-3">
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500">‹</button>
          <span className="text-base font-bold text-gray-800 min-w-[110px] text-center">{y}년 {m}월</span>
          <button onClick={() => move(1)} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500">›</button>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs">
            <span className="text-emerald-600 font-bold">이번 달 발생</span> <b className="text-gray-800">{won(totals.acc)}원</b>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-xs">
            <span className="text-sky-600 font-bold">이번 달 입금</span> <b className="text-gray-800">{won(totals.dep)}원</b>
          </div>
          <div className={`px-3 py-1.5 rounded-xl border text-xs ${totals.cumA - totals.cumD > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
            <span className={`font-bold ${totals.cumA - totals.cumD > 0 ? 'text-red-600' : 'text-gray-500'}`}>누적 미납</span>{' '}
            <b className="text-gray-800">{won(Math.max(0, totals.cumA - totals.cumD))}원</b>
          </div>
          {refunds.some(r => !r.refund_date) && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
              <span className="text-amber-700 font-bold">환급 대기</span>{' '}
              <b className="text-gray-800">{refunds.filter(r => !r.refund_date).length}명 · {won(refunds.filter(r => !r.refund_date).reduce((a, r) => a + r.cum_deposited, 0))}원</b>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm">{m}월 재직 직원이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse min-w-[860px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-500">
                <th className="px-2.5 py-2 text-left border-b border-gray-100">직원</th>
                <th className="px-2 py-2 text-right border-b border-gray-100">월 임금(원)</th>
                <th className="px-2 py-2 text-right border-b border-gray-100">이번 달 부담금 <span className="font-normal">(자동 ÷12)</span></th>
                <th className="px-2 py-2 text-right border-b border-gray-100">입금액(원)</th>
                <th className="px-2 py-2 text-center border-b border-gray-100">입금일</th>
                <th className="px-2 py-2 text-right border-b border-gray-100">누적 발생</th>
                <th className="px-2 py-2 text-right border-b border-gray-100">누적 입금</th>
                <th className="px-2 py-2 text-right border-b border-gray-100">미납액</th>
                <th className="px-2 py-2 text-left border-b border-gray-100">메모</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const d = drafts[r.staff_id]
                if (!d) return null
                const gap = r.cum_accrued - r.cum_deposited
                const numIn = 'w-24 px-1.5 py-1.5 text-xs text-right border rounded-lg'
                return (
                  <tr key={r.staff_id} className={`hover:bg-emerald-50/20 ${d.dirty ? 'bg-amber-50/40' : ''}`}>
                    <td className={`${td} whitespace-nowrap`}>
                      <p className="font-bold text-gray-800">{r.name}
                        {r.status === 'pending' && <span className="ml-1 text-[9px] font-bold text-amber-600">입사 예정</span>}
                      </p>
                      <p className="text-[10px] text-gray-400">{r.position ?? ''} · 입사 {r.hire_date ?? '-'}</p>
                    </td>
                    <td className={`${td} text-right`}>
                      <input value={d.wage} onChange={e => onWage(r.staff_id, e.target.value)}
                        placeholder={r.suggest_wage ? won(r.suggest_wage) : '임금'}
                        className={`${numIn} ${d.wage ? 'border-gray-200' : 'border-amber-200 bg-amber-50/50'}`} inputMode="numeric" />
                    </td>
                    <td className={`${td} text-right`}>
                      <input value={d.accrued} onChange={e => upd(r.staff_id, { accrued: e.target.value })}
                        className={`${numIn} border-gray-200 font-semibold text-emerald-700`} inputMode="numeric" />
                    </td>
                    <td className={`${td} text-right`}>
                      <input value={d.deposited} onChange={e => upd(r.staff_id, { deposited: e.target.value })}
                        className={`${numIn} border-gray-200 text-sky-700 font-semibold`} inputMode="numeric" />
                    </td>
                    <td className={`${td} text-center`}>
                      <input type="date" value={d.deposit_date} onChange={e => upd(r.staff_id, { deposit_date: e.target.value })}
                        className="w-[8rem] px-1.5 py-1.5 text-[11px] border border-gray-200 rounded-lg" />
                    </td>
                    <td className={`${td} text-right text-xs text-gray-500`}>{won(r.cum_accrued)}</td>
                    <td className={`${td} text-right text-xs text-gray-500`}>{won(r.cum_deposited)}</td>
                    <td className={`${td} text-right text-xs font-bold ${gap > 0 ? 'text-red-600' : gap < 0 ? 'text-sky-600' : 'text-green-600'}`}>
                      {gap > 0 ? won(gap) : gap < 0 ? `+${won(-gap)}` : '완납 ✓'}
                    </td>
                    <td className={td}>
                      <input value={d.memo} onChange={e => upd(r.staff_id, { memo: e.target.value })}
                        placeholder="메모" className="w-28 px-1.5 py-1.5 text-[11px] border border-gray-200 rounded-lg" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* ── 퇴사자 환급 — 적립금이 시설 통장으로 돌아오는 구조 ── */}
      {refunds.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-1">퇴사자 환급</h2>
          <p className="text-[11px] text-gray-400 mb-3">퇴사하면 적립해온 누적금이 시설 통장으로 환급됩니다 — 입금 확인 후 금액·일자를 기록하세요.</p>
          <ul className="space-y-1.5">
            {refunds.map(r => {
              const pending = !r.refund_date
              return (
                <li key={r.staff_id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm ${pending ? 'bg-amber-50/60 border-amber-200' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800">{r.name} <span className="text-[10px] font-semibold text-gray-400">{r.position ?? ''} · 퇴사 {r.resign_date ?? '-'}</span></p>
                    <p className="text-[11px] text-gray-500">누적 적립 <b className="text-gray-700">{won(r.cum_deposited)}원</b></p>
                  </div>
                  {pending ? (
                    <>
                      <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">환급 대기</span>
                      <button disabled={refBusy === r.staff_id}
                        onClick={async () => {
                          const amt = prompt(`${r.name} 님 환급 입금액(원)을 입력하세요.\n누적 적립: ${won(r.cum_deposited)}원`, String(r.cum_deposited))
                          if (amt === null) return
                          const n = Number(amt.replace(/[^\d]/g, ''))
                          if (!n) { alert('금액을 확인해주세요.'); return }
                          setRefBusy(r.staff_id)
                          const todayIso = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
                          try {
                            await pensionRefundAPI.save(r.staff_id, { amount: n, refund_date: todayIso })
                            setRefunds(await pensionRefundAPI.list())
                          } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
                          finally { setRefBusy(null) }
                        }}
                        className="shrink-0 text-xs font-bold text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-50 disabled:opacity-40">
                        {refBusy === r.staff_id ? '저장 중…' : '환급 확인'}
                      </button>
                    </>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      ✓ 환급 완료 {won(r.refund_amount)}원 · {r.refund_date}
                      {r.refund_amount != null && r.refund_amount !== r.cum_deposited && (
                        <span className="text-amber-600">(적립 대비 {r.refund_amount > r.cum_deposited ? '+' : ''}{won(r.refund_amount - r.cum_deposited)})</span>
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
        노란 임금 칸 = 미입력(직전 달 임금이 회색으로 제안됨) · 부담금은 임금÷12 자동 계산 후 상여 반영 등 직접 수정 가능 ·
        누적 수치는 저장된 모든 달의 합계 — 미납액이 빨간색이면 입금이 부족한 상태입니다 · 저장 버튼을 눌러야 반영됩니다
      </p>
    </div>
  )
}

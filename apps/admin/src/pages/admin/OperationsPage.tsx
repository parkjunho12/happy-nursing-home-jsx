import { useEffect, useMemo, useState } from 'react'
import {
  Building2, CalendarClock, FileSignature, Loader2, Pencil, Plus,
  ShieldCheck, Soup, Stethoscope, Trash2, UploadCloud, Wrench, X, Landmark, Repeat,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import {
  operationsAPI, type OpContract, type OpPayItem, type OpPaymentsMap, type OpPeriod,
} from '@/api/operationsClient'

/**
 * 운영·계약 — 수기 엑셀(운영 및 계약내역)을 그대로 옮긴 화면. ADMIN 전용.
 * ① 계약 대장: 만료 D-day 관리가 핵심 — 임박한 것부터 눈에 들어오게
 * ② 납부 대장: 항목×월 매트릭스 — 기록된 달은 차분하게, 빠뜨린 달만 도드라지게
 */

const C_SECTIONS = ['정기', '계약', '보험', '기타', '업체', '점검'] as const
const P_SECTIONS = ['정기', '기타', '병원'] as const
const SEC_META: Record<string, { label: string; icon: typeof Repeat; dot: string }> = {
  정기: { label: '정기 지출', icon: Repeat, dot: 'bg-sky-500' },
  계약: { label: '위탁 · 용역 계약', icon: FileSignature, dot: 'bg-indigo-500' },
  보험: { label: '보험', icon: ShieldCheck, dot: 'bg-emerald-500' },
  기타: { label: '기타 계약', icon: Landmark, dot: 'bg-violet-500' },
  업체: { label: '관련 업체 (참고)', icon: Soup, dot: 'bg-gray-400' },
  점검: { label: '정기 검사 · 교육', icon: Wrench, dot: 'bg-amber-500' },
  병원: { label: '어르신 병원 대납', icon: Stethoscope, dot: 'bg-rose-400' },
}
// 지출 영역 — 비슷한 성격끼리 묶고 영역별 소계를 낸다 (항목 수정에서 변경 가능)
const PAY_GROUPS = [
  '시설 유지·안전', '사무·운영', '위탁 서비스', '의료·간호',
  '인건비·세금', '적립·특별회계', '보험', '광고·홍보', '물품 구입', '병원 대납', '기타',
] as const
const GRP_DOT: Record<string, string> = {
  '시설 유지·안전': 'bg-sky-500', '사무·운영': 'bg-slate-500', '위탁 서비스': 'bg-indigo-500',
  '의료·간호': 'bg-rose-500', '인건비·세금': 'bg-emerald-600', '적립·특별회계': 'bg-teal-500',
  '보험': 'bg-green-500', '광고·홍보': 'bg-violet-500', '물품 구입': 'bg-amber-500',
  '병원 대납': 'bg-rose-300', '기타': 'bg-gray-400',
}
// 항목명 키워드로 지출 영역 추론 — 백엔드 operations_groups.py와 동일한 순서
const GRP_KEYWORDS: [string, string[]][] = [
  ['인건비·세금', ['급여', '세금', '4대보험', '국세', '지방세', '퇴직']],
  ['광고·홍보', ['광고', '게시대', '현수막', '블로그', '이지스텝', '당근', '영상']],
  ['위탁 서비스', ['위탁', '급식', '세탁', '프로그램']],
  ['의료·간호', ['촉탁의', '가정간호', '약국', '산소']],
  ['적립·특별회계', ['특별회계', '적립']],
  ['사무·운영', ['회계', '인터넷', '전화', '프린트', '전산']],
  ['보험', ['보험']],
  ['물품 구입', ['기저귀', '근무복', '침대']],
  ['시설 유지·안전', ['소방', '전기', '가스', '상하수도', 'CCTV', '정수기', '엘리베이터', '승강기', '소독', '폐기물', '공기질']],
]
const inferGrp = (category: string): string => {
  for (const [g, kws] of GRP_KEYWORDS) if (kws.some(k => (category || '').includes(k))) return g
  return '기타'
}
const fmt = (n: number) => n.toLocaleString()
const ic = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

const ddayOf = (end?: string | null): number | null => {
  if (!end) return null
  const m = String(end).match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (!m) return null
  return Math.round((new Date(+m[1], +m[2] - 1, +m[3]).getTime() - Date.now()) / 86400000)
}
const DdayPill = ({ d }: { d: number | null }) => {
  if (d === null) return <span className="text-gray-200 text-xs">—</span>
  const cls = d < 0 ? 'bg-red-500 text-white'
    : d <= 30 ? 'bg-orange-100 text-orange-700 border border-orange-200'
    : d <= 90 ? 'bg-amber-50 text-amber-700 border border-amber-200'
    : 'bg-gray-50 text-gray-400 border border-gray-100'
  return <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{d < 0 ? `만료 +${-d}일` : d === 0 ? '오늘 만료' : `D-${d}`}</span>
}

export default function OperationsPage() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [tab, setTab] = useState<'contracts' | 'payments'>('contracts')
  const [contracts, setContracts] = useState<OpContract[]>([])
  const [items, setItems] = useState<OpPayItem[]>([])
  const [pays, setPays] = useState<OpPaymentsMap>({})
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [editC, setEditC] = useState<OpContract | 'new' | null>(null)
  const [cell, setCell] = useState<{ item: OpPayItem; ym: string } | null>(null)
  const [editItem, setEditItem] = useState<OpPayItem | 'new' | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [c, i, p] = await Promise.all([
        operationsAPI.contracts(), operationsAPI.payItems(), operationsAPI.payments(year),
      ])
      setContracts(c); setItems(i); setPays(p)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const empty = !loading && contracts.length === 0 && items.length === 0

  const expiring = useMemo(() =>
    contracts.filter(c => c.active && c.section !== '업체')
      .map(c => ({ c, d: ddayOf(c.end_date) }))
      .filter(x => x.d !== null && x.d <= 90)
      .sort((a, b) => (a.d! - b.d!)), [contracts])
  const expired = expiring.filter(x => x.d! < 0).length
  // 정기 지출 월액 (숫자로 읽히는 것만)
  const monthlyFixed = useMemo(() => contracts
    .filter(c => c.active && c.section === '정기')
    .reduce((a, c) => {
      const m = String(c.amount_note ?? '').replace(/,/g, '').match(/\d{4,}/)
      return a + (m ? Number(m[0]) : 0)
    }, 0), [contracts])
  const yearTotal = useMemo(() =>
    Object.values(pays).reduce((a, mm) => a + Object.values(mm).flat().reduce((x, p) => x + p.amount, 0), 0), [pays])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-sm"><Building2 size={19} /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">운영 · 계약</h1>
          <p className="text-[11px] text-gray-400">업체 계약과 월별 납부를 한곳에서 · ADMIN 전용</p>
        </div>
        <div className="ml-auto flex gap-1 bg-gray-100 p-1 rounded-2xl">
          {(['contracts', 'payments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'contracts' ? '계약 대장' : '납부 대장'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      : empty ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center"><Building2 size={26} /></div>
          <p className="text-sm text-gray-400 mb-4">아직 데이터가 없습니다.</p>
          {isAdmin && (
            <button onClick={async () => {
              if (!confirm('2026 수기 엑셀(운영 및 계약내역) 데이터를 이관할까요?\n계약 50건 + 납부 항목 51개·기록 167건이 들어갑니다.')) return
              try { const r = await operationsAPI.seed(); alert(`이관 완료 — 계약 ${r.contracts}건 · 납부 ${r.payments}건`); load() }
              catch (e: any) { alert(e?.response?.data?.detail ?? '이관 실패') }
            }} className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 shadow-sm">
              <UploadCloud size={15} /> 엑셀 데이터 이관 (1회)
            </button>
          )}
        </div>
      ) : tab === 'contracts' ? (
        <>
          {/* 요약 스트립 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-[11px] font-bold text-gray-400">관리 중인 계약</p>
              <p className="text-2xl font-black text-gray-800">{contracts.filter(c => c.active).length}<span className="text-sm font-bold text-gray-400 ml-0.5">건</span></p>
            </div>
            <div className={`rounded-2xl border shadow-sm px-4 py-3 ${expiring.length ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
              <p className={`text-[11px] font-bold ${expiring.length ? 'text-amber-600' : 'text-gray-400'}`}>90일 내 만료</p>
              <p className={`text-2xl font-black ${expiring.length ? 'text-amber-700' : 'text-gray-800'}`}>{expiring.length}<span className="text-sm font-bold ml-0.5 opacity-60">건</span></p>
            </div>
            <div className={`rounded-2xl border shadow-sm px-4 py-3 ${expired ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
              <p className={`text-[11px] font-bold ${expired ? 'text-red-500' : 'text-gray-400'}`}>이미 만료됨</p>
              <p className={`text-2xl font-black ${expired ? 'text-red-600' : 'text-gray-800'}`}>{expired}<span className="text-sm font-bold ml-0.5 opacity-60">건</span></p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-[11px] font-bold text-gray-400">정기 지출 월액 <span className="font-normal">(파악분)</span></p>
              <p className="text-xl font-black text-gray-800 leading-8">{fmt(monthlyFixed)}<span className="text-sm font-bold text-gray-400 ml-0.5">원</span></p>
            </div>
          </div>

          {/* 갱신 임박 띠 */}
          {expiring.length > 0 && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1"><CalendarClock size={13} /> 갱신 확인이 필요한 계약</p>
              <div className="flex flex-wrap gap-1.5">
                {expiring.map(({ c, d }) => (
                  <button key={c.id} onClick={() => setEditC(c)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold pl-2.5 pr-1.5 py-1 rounded-full border bg-white border-amber-200 text-gray-700 hover:shadow-sm transition-shadow">
                    {c.category}{c.vendor ? <span className="font-semibold text-gray-400">{c.vendor}</span> : null}
                    <DdayPill d={d} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mb-3">
            <button onClick={() => setEditC('new')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-orange text-white text-sm font-bold hover:opacity-90 shadow-sm">
              <Plus size={14} /> 계약 추가
            </button>
          </div>

          {C_SECTIONS.map(sec => {
            const allRows = contracts.filter(c => c.section === sec)
            if (allRows.length === 0) return null
            const M = SEC_META[sec]
            // 정기 지출은 영역별로 다시 묶는다 — 납부 대장과 같은 분류
            const buckets: { key: string; dot: string; rows: OpContract[] }[] = sec === '정기'
              ? Object.entries(allRows.reduce<Record<string, OpContract[]>>((acc, c) => {
                  const g = (c.grp && PAY_GROUPS.includes(c.grp as any)) ? c.grp : inferGrp(c.category); (acc[g] ||= []).push(c); return acc
                }, {}))
                  .sort((a, b) => PAY_GROUPS.indexOf(a[0] as any) - PAY_GROUPS.indexOf(b[0] as any))
                  .map(([key, rows]) => ({ key, dot: GRP_DOT[key] ?? 'bg-gray-400', rows }))
              : [{ key: '', dot: M.dot, rows: allRows }]
            const monthlyOf = (rows: OpContract[]) => rows.filter(c => c.active).reduce((a, c) => {
              const mm = String(c.amount_note ?? '').replace(/,/g, '').match(/\d{4,}/)
              return a + (mm ? Number(mm[0]) : 0)
            }, 0)
            return (
              <div key={sec} className="mb-5">
                <h2 className="flex items-center gap-1.5 text-[12px] font-bold text-gray-600 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${M.dot}`} /> {M.label}
                  <span className="font-semibold text-gray-300">{allRows.length}</span>
                </h2>
                {buckets.map(({ key, dot, rows }) => (
                <div key={key || 'all'} className="mb-2.5">
                {key && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 mb-1 ml-1">
                    <span className={`w-1 h-1 rounded-full ${dot}`} /> {key}
                    <span className="font-semibold text-gray-300">{rows.length}</span>
                    {monthlyOf(rows) > 0 && <span className="ml-auto text-[10px] font-black text-gray-400 tabular-nums">월 {fmt(monthlyOf(rows))}원 (파악분)</span>}
                  </p>
                )}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead>
                      <tr className="text-[10.5px] font-bold text-gray-400 tracking-wide">
                        <th className="px-4 py-2.5 text-left">항목</th>
                        <th className="px-2 py-2.5 text-left">업체 · 연락처</th>
                        <th className="px-2 py-2.5 text-left">금액</th>
                        <th className="px-2 py-2.5 text-left">기간</th>
                        <th className="px-2 py-2.5 text-center">만료</th>
                        <th className="px-2 py-2.5 text-left">지출일</th>
                        <th className="px-2 py-2.5 text-left hidden lg:table-cell">메모</th>
                        <th className="px-2 py-2.5 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(c => {
                        const d = ddayOf(c.end_date)
                        return (
                          <tr key={c.id}
                            className={`border-t border-gray-50 transition-colors hover:bg-slate-50/60 ${!c.active ? 'opacity-40' : ''} ${d !== null && d < 0 && c.active ? 'bg-red-50/40' : ''}`}>
                            <td className="px-4 py-2.5 font-bold text-gray-800 whitespace-nowrap">{c.category}</td>
                            <td className="px-2 py-2.5 whitespace-nowrap">
                              <p className="text-[13px] text-gray-700 font-semibold">{c.vendor || <span className="text-gray-300">—</span>}</p>
                              {c.contact && <p className="text-[10px] text-gray-400 max-w-[170px] truncate">{c.contact.split('\n')[0]}</p>}
                            </td>
                            <td className="px-2 py-2.5 text-[12px] text-gray-600 max-w-[150px]">{c.amount_note || <span className="text-gray-300">—</span>}</td>
                            <td className="px-2 py-2.5 text-[11.5px] text-gray-500 whitespace-nowrap">
                              {(c.start_date || c.end_date) ? <>{c.start_date || '?'}<span className="text-gray-300"> → </span>{c.end_date || '계속'}</> : <span className="text-gray-300">—</span>}
                              {(c.periods?.length ?? 0) > 0 && (
                                <span className="ml-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded" title={c.periods!.map(p => `${p.start} → ${p.end}`).join('\n')}>
                                  연장 {c.periods!.length}회
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-center"><DdayPill d={d} /></td>
                            <td className="px-2 py-2.5 text-[11.5px] text-gray-500 whitespace-nowrap">{c.pay_day || <span className="text-gray-300">—</span>}</td>
                            <td className="px-2 py-2.5 text-[11px] text-gray-400 hidden lg:table-cell max-w-[230px] truncate" title={c.memo ?? ''}>{c.memo || ''}</td>
                            <td className="px-2 py-2.5 text-right whitespace-nowrap">
                              <button onClick={async () => {
                                if (c.active && !confirm(`「${c.category}${c.vendor ? ` · ${c.vendor}` : ''}」 계약을 종료 처리할까요?\n목록에 흐리게 남고 만료 알림에서 빠집니다.`)) return
                                await operationsAPI.updateContract(c.id, { active: !c.active }); load()
                              }}
                                title={c.active ? '계약 종료 처리' : '계약 재개'}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border mr-0.5 ${c.active ? 'text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                                {c.active ? '종료' : '재개'}
                              </button>
                              <button onClick={() => setEditC(c)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100"><Pencil size={13} /></button>
                              {isAdmin && (
                                <button onClick={async () => {
                                  if (!confirm(`「${c.category} · ${c.vendor ?? ''}」 계약을 삭제할까요?`)) return
                                  await operationsAPI.deleteContract(c.id); load()
                                }} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                </div>
                ))}
              </div>
            )
          })}
        </>
      ) : (
        <PaymentsTab items={items} pays={pays} year={year} setYear={setYear} yearTotal={yearTotal}
          onCell={(item, ym) => setCell({ item, ym })} onEditItem={setEditItem} onAddItem={() => setEditItem('new')} />
      )}

      {editC && <ContractModal existing={editC === 'new' ? undefined : editC} onClose={() => setEditC(null)} onSaved={load} />}
      {cell && <CellModal item={cell.item} ym={cell.ym} entries={pays[cell.item.id]?.[cell.ym] ?? []}
        onClose={() => setCell(null)} onSaved={load} />}
      {editItem && <PayItemModal existing={editItem === 'new' ? undefined : editItem} onClose={() => setEditItem(null)} onSaved={load} isAdmin={isAdmin} />}
    </div>
  )
}

// ── 납부 대장 ─────────────────────────────────────────────────────────────
function PaymentsTab({ items, pays, year, setYear, yearTotal, onCell, onEditItem, onAddItem }: {
  items: OpPayItem[]; pays: OpPaymentsMap; year: number; setYear: (y: number) => void; yearTotal: number
  onCell: (item: OpPayItem, ym: string) => void; onEditItem: (i: OpPayItem) => void; onAddItem: () => void
}) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const now = new Date()
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const grpOf = (i: OpPayItem) => (i.grp && PAY_GROUPS.includes(i.grp as any)) ? i.grp : '기타'
  const active = items.filter(i => i.active)
  const thisMonthTotal = active.reduce((a, it) => a + (pays[it.id]?.[nowYm] ?? []).reduce((x, p) => x + p.amount, 0), 0)
  const missedCount = active.filter(i => i.section === '정기').reduce((a, it) => {
    let n = 0
    for (const m of months) {
      const ym = `${year}-${String(m).padStart(2, '0')}`
      if (ym < nowYm && (pays[it.id]?.[ym] ?? []).length === 0) n++
    }
    return a + n
  }, 0)
  const sumOf = (itemId: string) => Object.values(pays[itemId] ?? {}).flat().reduce((a, p) => a + p.amount, 0)
  const cellSum = (itemId: string, m: number) => {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    return (pays[itemId]?.[ym] ?? []).reduce((a, p) => a + p.amount, 0)
  }
  // 영역별 소계
  const grpMonthTotal = (rows: OpPayItem[], m: number) => rows.reduce((a, it) => a + cellSum(it.id, m), 0)
  const grpYearTotal = (rows: OpPayItem[]) => rows.reduce((a, it) => a + sumOf(it.id), 0)

  return (
    <>
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-2xl bg-slate-800 text-white shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">{year}년 총 납부</p>
          <p className="text-xl font-black leading-8">{fmt(yearTotal)}<span className="text-sm font-bold opacity-60 ml-0.5">원</span></p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold text-gray-400">이번 달 납부</p>
          <p className="text-xl font-black text-gray-800 leading-8">{fmt(thisMonthTotal)}<span className="text-sm font-bold text-gray-400 ml-0.5">원</span></p>
        </div>
        <div className={`rounded-2xl border shadow-sm px-4 py-3 ${missedCount ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-100'}`}>
          <p className={`text-[11px] font-bold ${missedCount ? 'text-rose-500' : 'text-gray-400'}`}>기록 없는 지난달 칸</p>
          <p className={`text-xl font-black leading-8 ${missedCount ? 'text-rose-600' : 'text-gray-800'}`}>{missedCount}<span className="text-sm font-bold ml-0.5 opacity-60">칸</span></p>
        </div>
      </div>

      {/* 영역별 연간 소계 카드 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PAY_GROUPS.map(g => {
          const rows = active.filter(i => grpOf(i) === g)
          if (rows.length === 0) return null
          const t = grpYearTotal(rows)
          return (
            <span key={g} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white border border-gray-200 rounded-full pl-2.5 pr-3 py-1.5 shadow-sm">
              <span className={`w-1.5 h-1.5 rounded-full ${GRP_DOT[g]}`} />
              <span className="text-gray-600">{g}</span>
              <span className="text-gray-900 tabular-nums">{t ? fmt(t) : '0'}<span className="text-gray-300 font-semibold">원</span></span>
            </span>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
          <button onClick={() => setYear(year - 1)} className="w-8 h-8 rounded-lg hover:bg-gray-50 text-gray-500">‹</button>
          <span className="text-sm font-bold text-gray-800 w-14 text-center">{year}년</span>
          <button onClick={() => setYear(year + 1)} className="w-8 h-8 rounded-lg hover:bg-gray-50 text-gray-500">›</button>
        </div>
        <span className="text-[11px] text-gray-400">셀을 누르면 금액·납부일 기록 · 한 달 여러 건 가능</span>
        <button onClick={onAddItem} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-orange text-white text-sm font-bold hover:opacity-90 shadow-sm">
          <Plus size={14} /> 항목 추가
        </button>
      </div>

      {PAY_GROUPS.map(g => {
        const rows = active.filter(i => grpOf(i) === g)
        if (rows.length === 0) return null
        const yTotal = grpYearTotal(rows)
        return (
          <div key={g} className="mb-6">
            <h2 className="flex items-center gap-1.5 text-[12px] font-bold text-gray-600 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${GRP_DOT[g]}`} /> {g}
              <span className="font-semibold text-gray-300">{rows.length}</span>
              <span className="ml-auto text-[11px] font-black text-gray-500 tabular-nums">연간 {fmt(yTotal)}원</span>
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="border-collapse min-w-[1020px] w-full">
                <thead>
                  <tr className="text-[10.5px] font-bold text-gray-400">
                    <th className="sticky left-0 bg-white px-3 py-2.5 text-left border-b border-r border-gray-100 min-w-[160px] z-10">항목</th>
                    {months.map(m => {
                      const isNow = `${year}-${String(m).padStart(2, '0')}` === nowYm
                      return (
                        <th key={m} className={`px-1 py-2.5 text-center border-b border-gray-100 min-w-[76px] ${isNow ? 'bg-amber-50 text-amber-600 rounded-t-lg' : ''}`}>
                          {m}월{isNow && <span className="block text-[8px] font-bold text-amber-400">이번 달</span>}
                        </th>
                      )
                    })}
                    <th className="px-2.5 py-2.5 text-right border-b border-gray-100 min-w-[92px]">연간</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it, ri) => (
                    <tr key={it.id} className={ri % 2 ? 'bg-gray-50/40' : ''}>
                      <td className={`sticky left-0 px-3 py-1.5 border-b border-r border-gray-100 z-10 ${ri % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                        <button onClick={() => onEditItem(it)} className="text-left w-full group" title="항목 수정">
                          <p className="text-[12px] font-bold text-gray-800 leading-tight group-hover:text-primary-orange transition-colors">{it.category}</p>
                          <p className="text-[10px] text-gray-400 leading-tight truncate">{it.vendor}{it.method ? ` · ${it.method}` : ''}</p>
                        </button>
                      </td>
                      {months.map(m => {
                        const ym = `${year}-${String(m).padStart(2, '0')}`
                        const list = pays[it.id]?.[ym] ?? []
                        const tot = list.reduce((a, p) => a + p.amount, 0)
                        const missed = it.section === '정기' && ym < nowYm && list.length === 0
                        return (
                          <td key={m} onClick={() => onCell(it, ym)}
                            className={`px-1 py-1.5 text-center border-b border-gray-50 cursor-pointer align-middle transition-colors
                              ${ym === nowYm ? 'bg-amber-50/60' : ''} ${missed ? 'bg-rose-50/60' : ''} hover:bg-orange-100/50`}>
                            {list.length === 0 ? (
                              <span className={`text-[10px] ${missed ? 'text-rose-300 font-black' : 'text-gray-200'}`}>{missed ? '미기록' : '+'}</span>
                            ) : (
                              <div>
                                <p className="text-[11px] font-bold text-gray-800 leading-tight tabular-nums">{fmt(tot)}</p>
                                <p className="text-[9px] text-gray-400 leading-tight">{list.length > 1 ? `${list.length}건` : (list[0].paid_on || '✓')}</p>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-2.5 py-1.5 text-right border-b border-gray-50 text-[11px] font-bold text-gray-600 whitespace-nowrap tabular-nums">{sumOf(it.id) ? fmt(sumOf(it.id)) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 1 && (
                  <tfoot>
                    <tr className="bg-gray-50 text-[10.5px] font-black text-gray-600 border-t border-gray-200">
                      <td className="sticky left-0 bg-gray-50 px-3 py-2 border-r border-gray-100 z-10">{g} 소계</td>
                      {months.map(m => <td key={m} className="px-1 py-2 text-center tabular-nums">{grpMonthTotal(rows, m) ? fmt(grpMonthTotal(rows, m)) : <span className="text-gray-200">·</span>}</td>)}
                      <td className="px-2.5 py-2 text-right tabular-nums">{fmt(yTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )
      })}

      {/* 전체 합계 */}
      <div className="bg-slate-800 text-white rounded-2xl shadow-sm overflow-x-auto mb-2">
        <table className="border-collapse min-w-[1020px] w-full">
          <tbody>
            <tr className="text-[11px] font-bold">
              <td className="sticky left-0 bg-slate-800 px-3 py-3 border-r border-slate-700 min-w-[160px] z-10">전체 월 합계</td>
              {months.map(m => {
                const t = active.reduce((a, it) => a + cellSum(it.id, m), 0)
                return <td key={m} className="px-1 py-3 text-center min-w-[76px] tabular-nums">{t ? fmt(t) : <span className="opacity-20">·</span>}</td>
              })}
              <td className="px-2.5 py-3 text-right min-w-[92px] tabular-nums font-black">{fmt(yearTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">분홍 칸 = 정기 항목인데 납부 기록이 없는 지난달 · 영역은 항목을 눌러 수정할 수 있습니다</p>
    </>
  )
}

// ── 모달들 ────────────────────────────────────────────────────────────────
function Modal({ title, sub, onClose, children, wide }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h2 className="font-bold text-gray-900">{title}</h2>
            {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
      </div>
    </div>
  )
}
const L = ({ children }: { children: React.ReactNode }) => <label className="block text-[11px] font-bold text-gray-500 mb-1">{children}</label>

function ContractModal({ existing, onClose, onSaved }: { existing?: OpContract; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    section: existing?.section ?? '정기', category: existing?.category ?? '', vendor: existing?.vendor ?? '',
    contact: existing?.contact ?? '', amount_note: existing?.amount_note ?? '',
    start_date: existing?.start_date ?? '', end_date: existing?.end_date ?? '',
    pay_day: existing?.pay_day ?? '', memo: existing?.memo ?? '', active: existing?.active ?? true,
    grp: existing?.grp ?? '',
  })
  const [periods, setPeriods] = useState<OpPeriod[]>(existing?.periods ?? [])
  const [busy, setBusy] = useState(false)
  // 연장 기록 — 지금 기간을 이력으로 내리고 새 기간을 입력받는다
  const renew = () => {
    if (!f.start_date && !f.end_date) { alert('현재 계약 기간이 비어 있습니다.'); return }
    const today = new Date()
    const rec = `${String(today.getFullYear()).slice(2)}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
    setPeriods(p => [...p, { start: f.start_date, end: f.end_date, note: '연장 전 기간', recorded_at: rec }])
    // 새 기간: 기존 종료일 다음 날부터 시작하도록 힌트만 — 값은 비워서 직접 입력
    setF(prev => ({ ...prev, start_date: prev.end_date, end_date: '' }))
  }
  const save = async () => {
    if (!f.category.trim()) { alert('항목명을 입력해주세요.'); return }
    setBusy(true)
    try {
      if (existing) await operationsAPI.updateContract(existing.id, { ...f, periods } as any)
      else await operationsAPI.createContract({ ...f, periods } as any)
      onSaved(); onClose()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setBusy(false) }
  }
  return (
    <Modal title={existing ? '계약 수정' : '계약 추가'} sub="종료일을 적어두면 만료 D-day로 알려드립니다" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <div><L>구분</L>
          <select className={ic} value={f.section} onChange={e => setF({ ...f, section: e.target.value })}>
            {C_SECTIONS.map(s => <option key={s} value={s}>{SEC_META[s].label}</option>)}
          </select></div>
        <div><L>항목 *</L><input className={ic} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="소방 / 전기 / CCTV…" /></div>
      </div>
      <div><L>지출 영역 <span className="font-normal text-gray-400">— 정기 지출 소분류·납부 대장과 같은 기준</span></L>
        <select className={ic} value={f.grp} onChange={e => setF({ ...f, grp: e.target.value })}>
          <option value="">자동 분류{f.category ? ` (지금 기준: ${inferGrp(f.category)})` : ' (항목명 기준)'}</option>
          {PAY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><L>업체명</L><input className={ic} value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} /></div>
        <div><L>월 지출액 (자유 표기)</L><input className={ic} value={f.amount_note} onChange={e => setF({ ...f, amount_note: e.target.value })} placeholder="예: 66,000(VAT포함)" /></div>
      </div>
      <div><L>연락처</L><textarea className={ic} rows={2} value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} /></div>
      {/* 기간 이력 — 연장할 때마다 지난 기간이 쌓인다 */}
      {periods.length > 0 && (
        <div>
          <L>지난 계약 기간</L>
          <ul className="space-y-1">
            {periods.map((p, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-[12px] text-gray-600">
                <span className="font-semibold tabular-nums">{p.start || '?'} <span className="text-gray-300">→</span> {p.end || '?'}</span>
                {p.note && <span className="text-[10px] text-gray-400">{p.note}</span>}
                {p.recorded_at && <span className="ml-auto text-[10px] text-gray-300">{p.recorded_at} 기록</span>}
                <button type="button" onClick={() => setPeriods(ps => ps.filter((_, j) => j !== i))}
                  className="p-0.5 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={11} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div><L>{periods.length > 0 ? '현재 계약 시작' : '계약 시작'}</L><input className={ic} value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} placeholder="2026.04.06" /></div>
        <div><L>{periods.length > 0 ? '현재 계약 종료' : '계약 종료'}</L><input className={ic} value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} placeholder="2028.04.05" /></div>
        <div><L>지출일</L><input className={ic} value={f.pay_day} onChange={e => setF({ ...f, pay_day: e.target.value })} placeholder="매달 10일" /></div>
      </div>
      {existing && (
        <button type="button" onClick={renew}
          className="w-full text-left px-3 py-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 text-xs text-emerald-700 hover:bg-emerald-50">
          <b>↻ 계약 연장 기록</b> — 지금 기간을 이력으로 남기고 새 기간을 입력합니다
        </button>
      )}
      <div><L>메모</L><textarea className={ic} rows={2} value={f.memo} onChange={e => setF({ ...f, memo: e.target.value })} /></div>
      {existing && (
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={!f.active} onChange={e => setF({ ...f, active: !e.target.checked })} />
          종료된 계약 (흐리게 표시 · 알림 제외)
        </label>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={save} disabled={busy} className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 shadow-sm">{busy ? '저장 중…' : '저장'}</button>
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">취소</button>
      </div>
    </Modal>
  )
}

function PayItemModal({ existing, onClose, onSaved, isAdmin }: {
  existing?: OpPayItem; onClose: () => void; onSaved: () => void; isAdmin: boolean
}) {
  const [f, setF] = useState({
    section: existing?.section ?? '정기', category: existing?.category ?? '',
    vendor: existing?.vendor ?? '', method: existing?.method ?? '',
    grp: existing?.grp ?? '', active: existing?.active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!f.category.trim()) { alert('항목명을 입력해주세요.'); return }
    setBusy(true)
    try {
      if (existing) await operationsAPI.updatePayItem(existing.id, f)
      else await operationsAPI.createPayItem(f)
      onSaved(); onClose()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setBusy(false) }
  }
  return (
    <Modal title={existing ? '납부 항목 수정' : '납부 항목 추가'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><L>구분</L>
          <select className={ic} value={f.section} onChange={e => setF({ ...f, section: e.target.value })}>
            {P_SECTIONS.map(s => <option key={s} value={s}>{SEC_META[s].label}</option>)}
          </select></div>
        <div><L>항목 *</L><input className={ic} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><L>업체 · 이름</L><input className={ic} value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} /></div>
        <div><L>입금 방법</L><input className={ic} value={f.method} onChange={e => setF({ ...f, method: e.target.value })} placeholder="자동이체(10일)" /></div>
      </div>
      <div><L>지출 영역</L>
        <select className={ic} value={f.grp} onChange={e => setF({ ...f, grp: e.target.value })}>
          <option value="">자동 분류 (항목명 기준)</option>
          {PAY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select></div>
      {existing && (
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={!f.active} onChange={e => setF({ ...f, active: !e.target.checked })} />
          사용 안 함 (표에서 숨김)
        </label>
      )}
      <div className="flex gap-3 pt-1">
        <button onClick={save} disabled={busy} className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">{busy ? '저장 중…' : '저장'}</button>
        {existing && isAdmin && (
          <button onClick={async () => {
            if (!confirm(`「${existing.category}」 항목과 모든 납부 기록을 삭제할까요?`)) return
            await operationsAPI.deletePayItem(existing.id); onSaved(); onClose()
          }} className="px-4 border border-red-200 text-red-500 rounded-xl py-2.5 text-sm font-bold">삭제</button>
        )}
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">취소</button>
      </div>
    </Modal>
  )
}

function CellModal({ item, ym, entries, onClose, onSaved }: {
  item: OpPayItem; ym: string; entries: { id: string; amount: number; paid_on?: string | null; note?: string | null }[]
  onClose: () => void; onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const m = Number(ym.slice(5, 7))
  const add = async () => {
    const n = Number(amount.replace(/[^\d]/g, ''))
    if (!n) { alert('금액을 입력해주세요.'); return }
    setBusy(true)
    try {
      await operationsAPI.createPayment({ item_id: item.id, year_month: ym, amount: n, paid_on: paidOn || undefined, note: note || undefined })
      setAmount(''); setPaidOn(''); setNote('')
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setBusy(false) }
  }
  return (
    <Modal title={`${item.category} — ${ym.slice(0, 4)}년 ${m}월`} sub={`${item.vendor ?? ''}${item.method ? ` · ${item.method}` : ''}`} onClose={onClose}>
      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map(p => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm">
              <b className="text-gray-800 tabular-nums">{fmt(p.amount)}원</b>
              {p.paid_on && <span className="text-[11px] text-gray-400">{p.paid_on} 납부</span>}
              {p.note && <span className="text-[10px] text-gray-400 truncate">{p.note}</span>}
              <button onClick={async () => {
                if (!confirm('이 납부 기록을 삭제할까요?')) return
                await operationsAPI.deletePayment(p.id); onSaved()
              }} className="ml-auto p-1 rounded text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
            </li>
          ))}
          <li className="text-right text-[11px] font-bold text-gray-500 pr-1">합계 {fmt(entries.reduce((a, p) => a + p.amount, 0))}원</li>
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input className={ic} inputMode="numeric" value={amount} placeholder="금액 (원)" autoFocus
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          onChange={e => setAmount(e.target.value.replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} />
        <input className={ic} value={paidOn} placeholder={`납부일 (예: ${String(m).padStart(2, '0')}.10)`}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          onChange={e => setPaidOn(e.target.value)} />
      </div>
      <input className={ic} value={note} placeholder="메모 (선택)" onChange={e => setNote(e.target.value)} />
      <div className="flex gap-3">
        <button onClick={add} disabled={busy} className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 shadow-sm">{busy ? '저장 중…' : '기록 추가'}</button>
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">닫기</button>
      </div>
    </Modal>
  )
}

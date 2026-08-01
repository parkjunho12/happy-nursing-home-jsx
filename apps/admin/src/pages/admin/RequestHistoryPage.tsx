import { useEffect, useMemo, useState } from 'react'
import { ClipboardSignature, Loader2, Search } from 'lucide-react'
import { leaveAPI, swapAPI, signatureUrl, type LeaveRequest, type SwapRequest } from '@/api/leaveClient'

/**
 * 신청 내역 (서명) — 직원들이 내 근무표에서 넣은 연차·희망휴무·맞교대 신청을
 * 직원별로 묶어 서명과 함께 한눈에. (ADMIN·시설장 전용, 열람 중심 — 처리는 승인함에서)
 */
type Row = {
  key: string
  staff: string                 // 묶음 기준 직원명
  kind: '연차' | '반차' | '희망휴무' | '맞교대'
  role?: '신청' | '상대'        // 맞교대에서의 역할
  dates: string[]
  detail?: string | null        // 상대방·코드 등
  reason?: string | null
  status: string
  decided_by?: string | null
  sigs: { label: string; url: string }[]
  created_at?: string | null
}

const KIND_CLS: Record<string, string> = {
  연차: 'bg-rose-50 text-rose-600 border-rose-200',
  반차: 'bg-rose-50 text-rose-600 border-rose-200',
  희망휴무: 'bg-amber-50 text-amber-700 border-amber-200',
  맞교대: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}
const ST_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-amber-100 text-amber-700' },
  partner_wait: { label: '상대 동의 대기', cls: 'bg-gray-100 text-gray-500' },
  approved: { label: '승인', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-red-100 text-red-600' },
  declined: { label: '상대 거절', cls: 'bg-gray-100 text-gray-500' },
}
const fmtD = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

export default function RequestHistoryPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [allMonths, setAllMonths] = useState(false)
  const [kind, setKind] = useState('')      // '' | 연차 | 희망휴무 | 맞교대
  const [status, setStatus] = useState('')  // '' | pending | approved | rejected
  const [q, setQ] = useState('')
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [zoomSig, setZoomSig] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      leaveAPI.list(allMonths ? undefined : month, '' as any).catch(() => []),
      swapAPI.list('' as any).catch(() => []),
    ]).then(([l, s]) => { setLeaves(l); setSwaps(s) }).finally(() => setLoading(false))
  }, [month, allMonths])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const r of leaves) {
      out.push({
        key: `l-${r.id}`, staff: r.staff_name ?? '(이름 없음)',
        kind: r.kind as Row['kind'], dates: [r.date],
        detail: r.kind === '희망휴무' ? (r.use_annual ? '연차 우선 반영' : '반영만 희망') : null,
        reason: r.reason, status: r.status, decided_by: r.decided_by,
        sigs: r.signature_url ? [{ label: '서명', url: signatureUrl(r.signature_url)! }] : [],
        created_at: r.created_at,
      })
    }
    for (const s of swaps) {
      const inMonth = allMonths || (s.dates ?? []).some(d => d.startsWith(month))
      if (!inMonth) continue
      const base = {
        kind: '맞교대' as const, dates: s.dates ?? [], reason: s.reason,
        status: s.status, decided_by: s.decided_by, created_at: s.created_at,
        sigs: [
          ...(s.requester_signature_url ? [{ label: `${s.requester_name ?? '신청'} 서명`, url: signatureUrl(s.requester_signature_url)! }] : []),
          ...(s.partner_signature_url ? [{ label: `${s.partner_name ?? '상대'} 서명`, url: signatureUrl(s.partner_signature_url)! }] : []),
        ],
      }
      out.push({ ...base, key: `s-${s.id}-r`, staff: s.requester_name ?? '(이름 없음)', role: '신청',
        detail: `${s.partner_name ?? ''}님과 ${s.shift_code ?? ''} 근무 교환` })
      out.push({ ...base, key: `s-${s.id}-p`, staff: s.partner_name ?? '(이름 없음)', role: '상대',
        detail: `${s.requester_name ?? ''}님의 신청 · ${s.shift_code ?? ''} 근무 교환` })
    }
    return out
      .filter(r => !kind || (kind === '연차' ? (r.kind === '연차' || r.kind === '반차') : r.kind === kind))
      .filter(r => !status || r.status === status)
      .filter(r => !q || r.staff.includes(q))
      .sort((a, b) => (b.dates[0] ?? '').localeCompare(a.dates[0] ?? ''))
  }, [leaves, swaps, kind, status, q, month, allMonths])

  // 직원별 묶기 — 가나다순
  const byStaff = useMemo(() => {
    const m = new Map<string, Row[]>()
    rows.forEach(r => m.set(r.staff, [...(m.get(r.staff) ?? []), r]))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [rows])

  const cnt = (list: Row[], k: string) => list.filter(r => k === '연차' ? (r.kind === '연차' || r.kind === '반차') : r.kind === k).length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <ClipboardSignature size={20} className="text-teal-600" />
        <h1 className="text-xl font-bold text-gray-900">신청 내역 (서명)</h1>
        <span className="text-[11px] text-gray-400">연차 · 희망휴무 · 맞교대 — 직원별 열람</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">서명을 누르면 크게 볼 수 있어요 · 승인/반려 처리는 근무표 페이지의 승인함에서</p>

      {/* 필터 */}
      <div className="flex items-center gap-2 flex-wrap mb-4 bg-white border border-gray-100 rounded-2xl p-2.5">
        <input type="month" value={month} disabled={allMonths} onChange={e => setMonth(e.target.value)}
          className="px-2.5 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40" />
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 cursor-pointer">
          <input type="checkbox" checked={allMonths} onChange={e => setAllMonths(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600" />
          전체 기간
        </label>
        <div className="w-px h-6 bg-gray-100" />
        {['', '연차', '희망휴무', '맞교대'].map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${kind === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-500 border-gray-200'}`}>
            {k || '전체'}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-100" />
        {[['', '전체'], ['pending', '대기'], ['approved', '승인'], ['rejected', '반려']].map(([v, label]) => (
          <button key={v} onClick={() => setStatus(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${status === v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200'}`}>
            {label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="직원 검색"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl w-32" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : byStaff.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm">조건에 맞는 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {byStaff.map(([name, list]) => (
            <section key={name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
                <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-sm font-bold flex items-center justify-center">{name[0]}</span>
                <h2 className="text-sm font-bold text-gray-800">{name}</h2>
                <div className="ml-auto flex gap-1.5">
                  {cnt(list, '연차') > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">연차 {cnt(list, '연차')}</span>}
                  {cnt(list, '희망휴무') > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">희망 {cnt(list, '희망휴무')}</span>}
                  {cnt(list, '맞교대') > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">맞교대 {cnt(list, '맞교대')}</span>}
                </div>
              </div>
              <ul className="divide-y divide-gray-50">
                {list.map(r => (
                  <li key={r.key} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${KIND_CLS[r.kind]}`}>
                      {r.kind}{r.role ? ` · ${r.role}` : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {r.dates.map(fmtD).join(' ↔ ')}
                        {r.detail && <span className="font-normal text-gray-500"> — {r.detail}</span>}
                      </p>
                      {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        신청 {r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : ''}
                        {r.decided_by && ` · 처리 ${r.decided_by}`}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {r.sigs.map((sg, i) => (
                        <button key={i} onClick={() => setZoomSig(sg.url)} title={`${sg.label} — 눌러서 크게`}>
                          <img src={sg.url} alt={sg.label} className="h-8 rounded border border-gray-100 bg-white hover:ring-2 hover:ring-teal-200" />
                        </button>
                      ))}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ST_META[r.status]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                        {ST_META[r.status]?.label ?? r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* 서명 확대 */}
      {zoomSig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setZoomSig(null)}>
          <img src={zoomSig} alt="서명 확대" className="max-w-full max-h-[70vh] bg-white rounded-2xl p-4 shadow-2xl" />
        </div>
      )}
    </div>
  )
}

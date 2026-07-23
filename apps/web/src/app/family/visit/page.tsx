'use client'

/**
 * 보호자 면회 예약 — 전화 대신 앱에서 신청.
 * 보호자도 연세가 있는 분이 많아 글씨 크게, 단계는 짧게.
 * 신청 → 시설 확인 → 확정/어려움 알림(푸시)이 전부다.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarHeart, Loader2, X } from 'lucide-react'
import { resolveApiBase } from '@/lib/api-client'
import FamilyTabBar from '@/components/family/FamilyTabBar'

type Resident = { id: string; name: string; relation?: string | null }
type Visit = {
  id: string; resident_name: string; date: string; time: string
  visitors: number; memo?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'canceled'
  reject_reason?: string | null
}

const STATUS: Record<Visit['status'], { t: string; cls: string }> = {
  pending:  { t: '확인 중',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { t: '확정 ✓',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { t: '어려움',    cls: 'bg-red-50 text-red-600 border-red-200' },
  canceled: { t: '취소함',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

// 면회 가능 시간대 — 30분 단위 (10:00 ~ 16:30)
const TIMES = Array.from({ length: 14 }, (_, i) => {
  const h = 10 + Math.floor(i / 2), m = i % 2 ? '30' : '00'
  return `${String(h).padStart(2, '0')}:${m}`
})

const fmtD = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${w})`
}

export default function FamilyVisitPage() {
  const router = useRouter()
  const api = resolveApiBase()
  const [residents, setResidents] = useState<Resident[]>([])
  const [resident, setResident] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [visitors, setVisitors] = useState(1)
  const [memo, setMemo] = useState('')
  const [mine, setMine] = useState<Visit[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('family_token') : null

  const load = useCallback(async () => {
    if (!token) { router.replace('/family'); return }
    const r = localStorage.getItem('family_residents')
    if (r) {
      const list: Resident[] = JSON.parse(r)
      setResidents(list)
      if (list.length === 1) setResident(list[0].id)
    }
    try {
      const res = await fetch(`${api}/api/v1/family/visits/mine`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      })
      if (res.status === 401) { router.replace('/family'); return }
      const json = await res.json()
      setMine(json.data ?? [])
    } catch { /* 목록만 조용히 실패 */ }
  }, [api, token, router])
  useEffect(() => { load() }, [load])

  const todayIso = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

  const submit = async () => {
    if (!resident) { setErr('어르신을 선택해주세요.'); return }
    if (!date) { setErr('날짜를 선택해주세요.'); return }
    if (!time) { setErr('시간을 선택해주세요.'); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch(`${api}/api/v1/family/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resident_id: resident, date, time, visitors, memo: memo || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.detail ?? json.error ?? '신청 실패')
      setDate(''); setTime(''); setVisitors(1); setMemo('')
      await load()
      alert('예약을 신청했습니다.\n시설에서 확인하면 알림으로 알려드려요.')
    } catch (e: any) { setErr(e.message ?? '신청에 실패했습니다. 다시 시도해주세요.') }
    finally { setBusy(false) }
  }

  const cancel = async (v: Visit) => {
    if (!confirm(`${fmtD(v.date)} ${v.time} 예약을 취소할까요?`)) return
    try {
      await fetch(`${api}/api/v1/family/visits/${v.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      load()
    } catch { alert('취소에 실패했습니다.') }
  }

  const sel = 'w-full px-4 py-3.5 text-base border border-orange-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-300'

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center gap-2.5 mb-1">
          <CalendarHeart className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-800">면회 예약</h1>
        </div>
        <p className="text-base text-gray-500 mb-5">전화 없이 여기서 신청하세요. 시설에서 확인하면 알림을 보내드려요.</p>

        {/* 신청 카드 */}
        <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 ring-1 ring-orange-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">누구를 만나러 오세요?</label>
            <select value={resident} onChange={e => setResident(e.target.value)} className={sel}>
              <option value="">어르신 선택</option>
              {residents.map(r => (
                <option key={r.id} value={r.id}>{r.name} 어르신{r.relation ? ` (나와의 관계: ${r.relation})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">언제 오세요?</label>
            <input type="date" min={todayIso} value={date} onChange={e => setDate(e.target.value)} className={sel} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">몇 시쯤 오세요? <span className="font-normal text-gray-400">(면회 10:00~17:00)</span></label>
            <div className="grid grid-cols-4 gap-1.5">
              {TIMES.map(t => (
                <button key={t} onClick={() => setTime(t)}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    time === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-orange-100 hover:border-orange-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">몇 분이 오세요?</label>
            <select value={visitors} onChange={e => setVisitors(Number(e.target.value))} className={sel}>
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}명</option>)}
            </select>
          </div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="시설에 전할 말 (선택)" className={sel} />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button onClick={submit} disabled={busy}
            className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold disabled:opacity-40 shadow-lg shadow-orange-200">
            {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '면회 신청하기'}
          </button>
        </div>

        {/* 내 예약 */}
        {mine.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-bold text-gray-700 mb-2.5">내 예약</h2>
            <ul className="space-y-2.5">
              {mine.map(v => {
                const st = STATUS[v.status]
                return (
                  <li key={v.id} className="bg-white rounded-2xl ring-1 ring-orange-100 p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-gray-800">{fmtD(v.date)} {v.time}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${st.cls}`}>{st.t}</span>
                      {(v.status === 'pending' || v.status === 'approved') && (
                        <button onClick={() => cancel(v)} aria-label="예약 취소"
                          className="ml-auto text-gray-300 hover:text-red-400"><X className="w-5 h-5" /></button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{v.resident_name} 어르신 · {v.visitors}명</p>
                    {v.status === 'rejected' && v.reject_reason && (
                      <p className="text-sm text-red-500 mt-1.5 bg-red-50 rounded-xl px-3 py-2">사유: {v.reject_reason} — 다른 시간으로 다시 신청해주세요.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
      <FamilyTabBar />
    </div>
  )
}

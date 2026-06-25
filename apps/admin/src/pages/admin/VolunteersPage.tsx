import { useEffect, useState } from 'react'
import { volunteerAPI, type Volunteer, type VolunteerStatus } from '@/api/volunteerClient'

const STATUSES: VolunteerStatus[] = ['대기', '연락완료', '승인', '보류']
const statusStyle: Record<string, string> = {
  '대기': 'bg-gray-100 text-gray-600',
  '연락완료': 'bg-blue-50 text-blue-700',
  '승인': 'bg-green-50 text-green-700',
  '보류': 'bg-orange-50 text-orange-700',
}
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

export default function VolunteersPage() {
  const [items, setItems] = useState<Volunteer[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<Volunteer | null>(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const d = await volunteerAPI.list(filter || undefined)
      setItems(d.items); setCounts(d.counts)
    } catch (e: any) { setError(e?.message ?? '목록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  const openDetail = (v: Volunteer) => { setSel(v); setMemo(v.admin_memo ?? '') }

  const changeStatus = async (status: VolunteerStatus) => {
    if (!sel) return
    setSaving(true); setError('')
    try {
      const updated = await volunteerAPI.update(sel.id, { status })
      setSel(updated)
      setItems(rows => rows.map(r => (r.id === updated.id ? updated : r)))
      await load()
    } catch (e: any) { setError(e?.message ?? '상태 변경에 실패했습니다.') }
    finally { setSaving(false) }
  }

  const saveMemo = async () => {
    if (!sel) return
    setSaving(true); setError('')
    try {
      const updated = await volunteerAPI.update(sel.id, { admin_memo: memo })
      setSel(updated)
      setItems(rows => rows.map(r => (r.id === updated.id ? updated : r)))
      alert('메모를 저장했습니다.')
    } catch (e: any) { setError(e?.message ?? '메모 저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">자원봉사 관리</h1>
        <p className="text-sm text-gray-500 mt-1">홈페이지로 접수된 자원봉사 신청을 확인하고 상태를 관리합니다.</p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === '' ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          전체 {items.length > 0 && filter === '' ? `(${items.length})` : ''}
        </button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === s ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['이름', '연락처', '희망 활동', '희망 요일/시간', '상태', '신청일'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '신청자가 없습니다.'}</td></tr>
            )}
            {items.map(v => (
              <tr key={v.id} onClick={() => openDetail(v)} className="border-t border-gray-50 hover:bg-orange-50/40 cursor-pointer">
                <td className="px-4 py-3 font-semibold text-gray-900">{v.name}</td>
                <td className="px-4 py-3 text-gray-600">{v.phone}</td>
                <td className="px-4 py-3 text-gray-600">{v.preferred_activity ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{[v.preferred_day, v.preferred_time].filter(Boolean).join(' · ') || '-'}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle[v.status]}`}>{v.status}</span></td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(v.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 상세 모달 */}
      {sel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{sel.name}</h3>
                <p className="text-sm text-gray-500">{fmt(sel.created_at)} 신청</p>
              </div>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle[sel.status]}`}>{sel.status}</span>
            </div>

            <dl className="space-y-2.5 text-sm mb-5">
              {[
                ['연락처', sel.phone],
                ['생년월일/나이', sel.birth_or_age],
                ['희망 활동', sel.preferred_activity],
                ['희망 요일', sel.preferred_day],
                ['희망 시간', sel.preferred_time],
                ['봉사 경험', sel.experience],
                ['메모', sel.memo],
              ].map(([k, val]) => (
                <div key={k as string} className="flex gap-3">
                  <dt className="w-24 shrink-0 text-gray-400 font-medium">{k}</dt>
                  <dd className="text-gray-800 whitespace-pre-wrap">{val || '-'}</dd>
                </div>
              ))}
            </dl>

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">상태 변경</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => changeStatus(s)} disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${sel.status === s ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">관리자 메모</p>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="연락 내용, 배정 일정 등 내부 메모"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <button onClick={saveMemo} disabled={saving} className="mt-2 px-4 py-2 rounded-lg text-sm font-bold bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50">메모 저장</button>
            </div>

            <div className="flex justify-end gap-2">
              <a href={`tel:${sel.phone}`} className="px-4 py-2 rounded-lg text-sm font-semibold border border-orange-200 text-orange-600 hover:bg-orange-50">📞 전화 연결</a>
              <button onClick={() => setSel(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Printer, Loader2, ChevronDown, ChevronUp, Clock, User2, Check, ListChecks } from 'lucide-react'
import { handoverAPI, handoverImageUrl, type HandoverRecord } from '@/api/handoverClient'

const URG = {
  high: { label: '긴급', cls: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '주의', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: '일반', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
} as const

const FREQ_LABEL: Record<string, string> = { one_time: '일회성', daily: '매일', weekly: '주간', monthly: '월간', quarterly: '분기', 'half-yearly': '반기', yearly: '연간' }

const fmt = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${w}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function HandoverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [rec, setRec] = useState<HandoverRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [more, setMore] = useState(false)     // 더 자세히 보기
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    handoverAPI.detail(id).then(setRec)
      .catch((e: any) => { if (e?.response?.status === 403) setDenied(true) })
      .finally(() => setLoading(false))
  }, [id])

  const rep = rec?.report
  const entries = useMemo(() => [...(rep?.entries ?? [])].sort((a, b) => (a.time || '').localeCompare(b.time || '')), [rep])
  const byResident = useMemo(() => {
    const m = new Map<string, any[]>()
    entries.forEach(e => { const k = e.resident_matched || e.resident || '기타'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(e) })
    return Array.from(m.entries())
  }, [entries])

  const suggestions = rep?.suggested_checklists ?? []
  const toggle = (i: number) => setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })
  const createChecklists = async () => {
    if (!rec || picked.size === 0) return
    setCreating(true)
    try {
      await handoverAPI.createChecklists(rec.id, Array.from(picked).map(i => ({
        title: suggestions[i].title, frequency: suggestions[i].frequency,
        person_name: suggestions[i].person_name || null, due_date: suggestions[i].due_date || null,
      })))
      alert(`체크리스트 ${picked.size}건을 만들었습니다.`)
      setPicked(new Set())
    } catch (e: any) { alert(e?.response?.data?.detail ?? '생성에 실패했습니다.') }
    finally { setCreating(false) }
  }

  if (denied) return (
    <div className="p-6 max-w-md mx-auto text-center py-24">
      <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-3xl">🔒</div>
      <p className="font-bold text-gray-800 text-lg">열람 권한이 없습니다</p>
      <p className="text-[15px] text-gray-500 mt-2">인수인계는 지정된 직원만 볼 수 있습니다.</p>
    </div>
  )
  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
  if (!rec || !rep) return (
    <div className="p-6 max-w-md mx-auto text-center py-24">
      <p className="font-bold text-gray-800 text-lg">리포트를 찾을 수 없습니다</p>
      <button onClick={() => navigate('/handover')} className="mt-5 px-6 py-3.5 bg-violet-600 text-white rounded-2xl text-[15px] font-bold">인수인계로 가기</button>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <style>{`@media print { body * { visibility:hidden } .print-area,.print-area * { visibility:visible } .print-area { position:absolute; left:0; top:0; width:100% } .no-print { display:none !important } .detail-block { display:block !important } @page { size:A4; margin:12mm } }`}</style>

      <div className="no-print flex items-center justify-between mb-4">
        <button onClick={() => navigate('/handover')} className="inline-flex items-center gap-1.5 text-[15px] text-gray-500 hover:text-violet-600 py-2">
          <ArrowLeft size={18} /> 목록
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-[15px] text-gray-600">
          <Printer size={17} /> 인쇄
        </button>
      </div>

      <div className="print-area space-y-4">
        {/* 제목 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">인수인계</h1>
          <p className="text-[15px] text-gray-500 mt-1">{fmt(rec.created_at)} · {rec.author ?? '-'}</p>
        </div>

        {/* 주의 — 가장 먼저, 가장 크게 */}
        {(rep.alerts ?? []).length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
            <p className="font-bold text-red-700 text-lg flex items-center gap-2 mb-3">
              <AlertTriangle size={22} /> 주의 필요 {rep.alerts.length}명
            </p>
            <div className="space-y-2.5">
              {rep.alerts.map((a, i) => (
                <div key={i} className="bg-white rounded-xl px-4 py-3.5 border border-red-100">
                  <p className="text-[17px] font-bold text-gray-900">{a.resident || '—'}</p>
                  <p className="text-[16px] text-gray-700 mt-1 leading-relaxed">{a.issue}</p>
                  {a.action && <p className="text-[15px] text-red-600 mt-1.5 leading-relaxed">→ {a.action}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 요약 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[13px] font-bold text-violet-500 mb-2">요약</p>
          <p className="text-[17px] text-gray-800 leading-[1.9] whitespace-pre-wrap">{rep.summary || '요약이 없습니다.'}</p>
        </div>

        {/* 꼭 확인할 것 */}
        {(rep.key_points ?? []).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-[13px] font-bold text-gray-400 mb-3">꼭 확인할 것</p>
            <ul className="space-y-3">
              {rep.key_points.map((k, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-[17px] text-gray-800 leading-[1.7]">{k}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 더 자세히 보기 */}
        <button onClick={() => setMore(v => !v)}
          className="no-print w-full flex items-center justify-center gap-2 py-4 min-h-[56px] bg-violet-50 border-2 border-violet-200 text-violet-700 rounded-2xl text-[16px] font-bold active:scale-[0.99] transition-transform">
          {more ? <>간단히 보기 <ChevronUp size={20} /></> : <>더 자세히 보기 <ChevronDown size={20} /></>}
        </button>

        {/* 상세 — 기본 숨김, 인쇄 시 항상 표시 */}
        <div className={`detail-block space-y-4 ${more ? '' : 'hidden'}`}>
          <p className="text-[13px] text-gray-400 px-1">전체 기록 {entries.length}건 · 어르신 {byResident.length}명</p>

          {byResident.map(([name, list]) => (
            <div key={name} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-[14px] font-bold flex items-center justify-center">{name.slice(0, 1)}</span>
                <span className="font-bold text-gray-900 text-[16px]">{name}</span>
                <span className="text-[13px] text-gray-400">{list.length}건</span>
                {list[0]?.match === 'none' && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">명단에 없음</span>
                )}
                {list[0]?.match === 'ambiguous' && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">확인 필요</span>
                )}
              </div>
              <ul className="divide-y divide-gray-50">
                {list.map((e: any, i: number) => {
                  const u = URG[e.urgency as keyof typeof URG] ?? URG.low
                  return (
                    <li key={i} className="px-4 py-3.5">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${u.cls}`}>{u.label}</span>
                        {e.time && <span className="text-[13px] text-gray-400 flex items-center gap-1"><Clock size={12} />{e.time}</span>}
                        {e.writer && <span className="text-[13px] text-gray-400 flex items-center gap-1"><User2 size={12} />{e.writer}</span>}
                      </div>
                      {e.resident_matched && e.resident && e.resident_matched !== e.resident && (
                        <p className="text-[12px] text-gray-400 mb-0.5">기록지 표기: {e.resident}</p>
                      )}
                      {e.match === 'ambiguous' && (e.match_candidates?.length ?? 0) > 0 && (
                        <p className="text-[12px] text-amber-600 mb-0.5">누구인지 확인 필요 — 후보: {e.match_candidates!.join(', ')}</p>
                      )}
                      <p className="text-[16px] text-gray-800 leading-[1.7] whitespace-pre-line">{e.content}</p>
                      {e.vitals && <p className="text-[14px] text-teal-600 mt-1">활력징후 {e.vitals}</p>}
                      {e.confidence === 'low' && <p className="text-[13px] text-amber-600 mt-1">※ 글씨 판독이 불확실합니다. 원본을 확인해 주세요.</p>}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {suggestions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-[15px] font-bold text-gray-800 flex items-center gap-2 mb-1"><ListChecks size={18} className="text-violet-600" /> 후속 조치 제안</p>
              <p className="text-[13px] text-gray-400 mb-3">필요한 것만 골라 체크리스트로 만들 수 있습니다.</p>
              <div className="space-y-2">
                {suggestions.map((s2, i) => (
                  <label key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${picked.has(i) ? 'border-violet-300 bg-violet-50' : 'border-gray-100'}`}>
                    <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="mt-1 w-4 h-4 accent-violet-600" />
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-gray-800 leading-snug">{s2.title}</span>
                      <span className="flex items-center gap-1.5 flex-wrap text-[13px] text-gray-400 mt-1.5">
                        {s2.due_label && (
                          <span className={`font-bold px-2 py-0.5 rounded ${(s2.due_days ?? 9) <= 0 ? 'bg-red-100 text-red-700' : (s2.due_days ?? 9) <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            ~{s2.due_label}
                          </span>
                        )}
                        <span>{FREQ_LABEL[s2.frequency] ?? s2.frequency}{s2.person_name ? ` · ${s2.person_name}` : ''}{s2.reason ? ` · ${s2.reason}` : ''}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <button onClick={createChecklists} disabled={picked.size === 0 || creating}
                className="no-print mt-3 w-full inline-flex items-center justify-center gap-2 py-3.5 min-h-[52px] bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-[16px] font-bold disabled:opacity-40">
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 선택한 {picked.size}건 만들기
              </button>
            </div>
          )}

          {(rec.images ?? []).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-[13px] font-bold text-gray-400 mb-2.5">원본 기록지 {rec.images.length}장 <span className="font-normal">(누르면 크게 보입니다)</span></p>
              <div className="grid grid-cols-2 gap-2.5">
                {rec.images.map((u, i) => (
                  <a key={i} href={handoverImageUrl(u)!} target="_blank" rel="noopener noreferrer">
                    <img src={handoverImageUrl(u)!} alt={`기록지 ${i + 1}`} className="w-full h-36 object-cover rounded-xl border border-gray-200" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {rep.unreadable_notes && (
            <p className="text-[14px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">판독 참고: {rep.unreadable_notes}</p>
          )}
        </div>

        <p className="text-[13px] text-gray-400 text-center leading-relaxed pt-2">
          AI가 손글씨를 읽어 정리한 내용입니다.<br />원본 기록지와 대조해 확인해 주세요.
        </p>
      </div>
    </div>
  )
}

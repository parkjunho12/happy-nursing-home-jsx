import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList, Upload, Loader2, Sparkles, AlertTriangle, Send, MessageCircle,
  Printer, History, Trash2, X, Check, ShieldCheck, Camera, ScanLine,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { handoverAPI, handoverImageUrl, type HandoverRecord, type AccessRow } from '@/api/handoverClient'
import { isKakaoShareEnabled, shareText } from '@/lib/kakaoShare'
import { scanDocument } from '@/utils/docScan'

const URG = {
  high: { label: '긴급', cls: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '주의', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: '일반', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
} as const
const FREQ_LABEL: Record<string, string> = { one_time: '일회성', daily: '매일', weekly: '주간', monthly: '월간', quarterly: '분기', 'half-yearly': '반기', yearly: '연간' }
const fmt = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function HandoverAiPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [rec, setRec] = useState<HandoverRecord | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [hist, setHist] = useState<HandoverRecord[]>([])
  const [showHist, setShowHist] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  const [scanMode, setScanMode] = useState(true)   // 문서 스캔 보정
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    handoverAPI.history().then(setHist)
      .catch((e: any) => { if (e?.response?.status === 403) setDenied(true); setHist([]) })
  }, [])
  useEffect(() => () => { previews.forEach(u => URL.revokeObjectURL(u)) }, [previews])

  const addFiles = async (fl: FileList | null) => {
    if (!fl?.length) return
    const incoming = Array.from(fl).slice(0, 6 - files.length)
    if (!incoming.length) return
    let processed = incoming
    if (scanMode) {
      setScanning(true)
      try { processed = await Promise.all(incoming.map(f => scanDocument(f))) }
      finally { setScanning(false) }
    }
    const next = [...files, ...processed].slice(0, 6)
    setFiles(next)
    previews.forEach(u => URL.revokeObjectURL(u))
    setPreviews(next.map(f => URL.createObjectURL(f)))
    if (fileRef.current) fileRef.current.value = ''
    if (camRef.current) camRef.current.value = ''
  }
  const removeFile = (i: number) => {
    const next = files.filter((_, x) => x !== i)
    setFiles(next)
    previews.forEach(u => URL.revokeObjectURL(u))
    setPreviews(next.map(f => URL.createObjectURL(f)))
  }

  const run = async () => {
    if (!files.length) { setErr('사진을 1장 이상 올려주세요.'); return }
    setBusy(true); setErr('')
    try {
      const r = await handoverAPI.analyze(files)
      setRec(r); setPicked(new Set())
      if (r.report?.error) setErr(r.report.error)
      setHist(await handoverAPI.history().catch(() => hist))
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '분석에 실패했습니다.')
    } finally { setBusy(false) }
  }

  const rep = rec?.report
  const suggestions = rep?.suggested_checklists ?? []
  const toggle = (i: number) => setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })

  const createChecklists = async () => {
    if (!rec || picked.size === 0) return
    const items = Array.from(picked).map(i => ({
      title: suggestions[i].title, frequency: suggestions[i].frequency,
      person_name: suggestions[i].person_name || null, due_date: suggestions[i].due_date || null,
    }))
    try {
      await handoverAPI.createChecklists(rec.id, items)
      alert(`체크리스트 ${items.length}건을 생성했습니다.`)
      setPicked(new Set())
    } catch (e: any) { alert(e?.response?.data?.detail ?? '생성 실패') }
  }

  const push = async () => {
    if (!rec) return
    if (!confirm('요약을 직원앱으로 발송할까요?')) return
    try {
      const r = await handoverAPI.push(rec.id)
      alert(r.tokens === 0 ? '직원앱에 등록된 기기가 없습니다.' : `직원 ${r.recipients}명(${r.sent}대)에게 발송했습니다.`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '발송 실패') }
  }

  // 카카오 텍스트는 최대 200자 → 문장·항목 단위로만 담아 말이 끊기지 않게 구성
  const buildShareText = (max = 200) => {
    if (!rep) return ''
    const head = urgentCount > 0 ? `[인수인계] 주의 ${urgentCount}건` : '[인수인계 요약]'
    let out = head
    const add = (line: string) => {
      const l = (line || '').trim()
      if (!l) return
      const next = `${out}\n${l}`
      if (next.length <= max) out = next        // 통째로 들어갈 때만 추가
    }
    ;(rep.summary || '').split(/(?<=[.!?])\s+/).forEach(add)   // 요약: 문장 단위
    ;(rep.key_points || []).forEach(k => add(`· ${k}`))          // 전달사항: 항목 단위
    return out.length <= max ? out : out.slice(0, max - 1) + '…'
  }

  const kakao = async () => {
    if (!rep || !rec) return
    const link = `${window.location.origin}/handover/${rec.id}`   // '자세히 보기' → 상세 페이지
    try { await shareText(buildShareText(200), link) }
    catch (e: any) { alert(e?.message ?? '카카오 공유를 열 수 없습니다.') }
  }

  const sorted = useMemo(() => [...(rep?.entries ?? [])].sort((a, b) => (a.time || '').localeCompare(b.time || '')), [rep])
  const urgentCount = useMemo(() => sorted.filter(e => e.urgency === 'high').length, [sorted])
  const residentCount = useMemo(() => new Set(sorted.map(e => e.resident).filter(Boolean)).size, [sorted])

  if (denied) return (
    <div className="p-6 max-w-md mx-auto text-center py-24">
      <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-3xl">🔒</div>
      <p className="font-bold text-gray-800">접근 권한이 없습니다</p>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">인수인계 AI는 관리자·시설장·간호·사회복지사와<br />지정된 직원만 이용할 수 있습니다.<br />필요하시면 관리자에게 요청해 주세요.</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <style>{`@media print { body * { visibility: hidden } .print-area, .print-area * { visibility: visible } .print-area { position:absolute; left:0; top:0; width:100% } .no-print { display:none !important } @page { size: A4; margin: 12mm } }`}</style>

      {/* 헤더 */}
      <div className="no-print flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">인수인계 AI 리포트</h1>
            <p className="text-xs text-gray-400">수기 인수인계 기록지를 찍어 올리면 AI가 판독해 요약·후속조치를 정리합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setAccessOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:border-violet-400 hover:text-violet-600">
              <ShieldCheck className="w-4 h-4" /> 접근 권한
            </button>
          )}
          <button onClick={() => setShowHist(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:border-violet-400 hover:text-violet-600">
            <History className="w-4 h-4" /> 이력 {hist.length > 0 && <span className="text-[11px] text-gray-400">({hist.length})</span>}
          </button>
        </div>
      </div>

      {/* 업로드 */}
      <div className="no-print bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addFiles(e.target.files)} />
        {previews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
            {previews.map((u, i) => (
              <div key={i} className="relative">
                <img src={u} alt={`기록지 ${i + 1}`} className="w-full h-28 object-cover rounded-lg border border-gray-200" />
                <button onClick={() => removeFile(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"><X size={13} /></button>
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 rounded">{i + 1}</span>
                {files[i]?.name?.includes('_scan') && (
                  <span className="absolute bottom-1 right-1 text-[10px] bg-violet-600 text-white px-1.5 rounded font-bold">보정</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => camRef.current?.click()} disabled={busy || scanning || files.length >= 6}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[46px] bg-violet-50 border-2 border-violet-200 text-violet-700 rounded-xl text-sm font-bold hover:bg-violet-100 disabled:opacity-40">
            <Camera className="w-4 h-4" /> 촬영하기
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy || scanning || files.length >= 6}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[46px] border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-violet-400 hover:text-violet-600 disabled:opacity-40">
            <Upload className="w-4 h-4" /> 사진 선택
          </button>
          <button onClick={run} disabled={busy || scanning || !files.length}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {busy ? 'AI 판독 중...' : 'AI 판독 시작'}
          </button>
          {files.length > 0 && <span className="text-xs text-gray-400">{files.length}장 선택됨</span>}
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={scanMode} onChange={e => setScanMode(e.target.checked)} className="w-4 h-4 accent-violet-600" />
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-700"><ScanLine size={14} className="text-violet-600" /> 문서 스캔 보정</span>
          <span className="text-[11px] text-gray-400">촬영한 사진을 또렷하게 정리해 판독률을 높입니다</span>
          {scanning && <span className="inline-flex items-center gap-1 text-[11px] text-violet-600 font-bold"><Loader2 size={12} className="animate-spin" /> 보정 중...</span>}
        </label>
        <p className="text-[11px] text-gray-400 mt-2">※ 어르신 성함·건강정보가 포함됩니다. 판독을 위해 이미지가 AI로 전송되며, 결과는 반드시 담당자가 확인·수정해 주세요.</p>
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      </div>

      {/* 결과 */}
      {rep && (
        <div className="print-area space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 className="font-bold text-gray-900">요약</h2>
              <div className="no-print flex items-center gap-1.5">
                <button onClick={() => window.print()} className="p-2 text-gray-300 hover:text-violet-600 rounded" title="인쇄"><Printer size={15} /></button>
                <button onClick={push} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:text-violet-600"><Send size={13} /> 직원앱 발송</button>
                {isKakaoShareEnabled() && (
                  <button onClick={kakao} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#FEE500] text-[#3A1D1D]"><MessageCircle size={13} /> 카톡</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { l: '기록', v: `${sorted.length}건`, c: 'text-gray-900' },
                { l: '긴급', v: `${urgentCount}건`, c: urgentCount ? 'text-red-600' : 'text-gray-300' },
                { l: '어르신', v: `${residentCount}명`, c: 'text-violet-600' },
              ].map(s => (
                <div key={s.l} className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-gray-400">{s.l}</p>
                  <p className={`text-lg font-bold mt-0.5 ${s.c}`}>{s.v}</p>
                </div>
              ))}
            </div>
            <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-4">
              <p className="text-[15px] text-gray-800 leading-[1.8] whitespace-pre-wrap">{rep.summary || '요약이 없습니다.'}</p>
            </div>
            {(rep.key_points ?? []).length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-bold text-gray-400 mb-1.5">꼭 확인할 것</p>
                <ul className="space-y-1.5">
                  {rep.key_points.map((k, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="leading-relaxed">{k}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-gray-300 mt-3">{rec?.model ? `판독 모델: ${rec.model}` : ''} {rec?.created_at ? `· ${fmt(rec.created_at)}` : ''}</p>
          </div>

          {(rep.alerts ?? []).length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <h2 className="font-bold text-red-700 text-sm flex items-center gap-1.5 mb-2"><AlertTriangle size={15} /> 주의 필요</h2>
              <div className="space-y-2">
                {rep.alerts.map((a, i) => (
                  <div key={i} className="bg-white rounded-xl px-3 py-2 border border-red-100">
                    <p className="text-sm font-bold text-gray-800">{a.resident || '—'} · {a.issue}</p>
                    {a.action && <p className="text-xs text-gray-500 mt-0.5">→ {a.action}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sorted.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <h2 className="font-bold text-gray-900 px-5 pt-4 pb-2">판독 내역 <span className="text-xs font-normal text-gray-400">{sorted.length}건</span></h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-[11px] text-gray-500">
                    <th className="px-3 py-2 text-left">시간</th><th className="px-3 py-2 text-left">어르신</th>
                    <th className="px-3 py-2 text-left">내용</th><th className="px-3 py-2 text-left">작성자</th>
                  </tr></thead>
                  <tbody>
                    {sorted.map((e, i) => {
                      const u = URG[e.urgency] ?? URG.low
                      return (
                        <tr key={i} className="border-t border-gray-50 align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{e.time || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-800">{e.resident || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mr-1.5 ${u.cls}`}>{u.label}</span>
                            {e.content}
                            {e.vitals && <span className="block text-[11px] text-teal-600 mt-0.5">V/S {e.vitals}</span>}
                            {e.confidence === 'low' && <span className="block text-[10px] text-amber-500 mt-0.5">※ 판독 불확실 — 확인 필요</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-400 text-xs">{e.writer || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rep.unreadable_notes && <p className="text-[11px] text-amber-600 px-5 py-2 bg-amber-50">판독 참고: {rep.unreadable_notes}</p>}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="no-print bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">후속 조치 제안</h2>
              <p className="text-xs text-gray-400 mb-3">필요한 항목만 선택해 체크리스트로 만드세요.</p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <label key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${picked.has(i) ? 'border-violet-300 bg-violet-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="mt-0.5 accent-violet-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {s.due_label && (
                          <span className={`font-bold px-1.5 py-0.5 rounded ${(s.due_days ?? 9) <= 0 ? 'bg-red-100 text-red-700' : (s.due_days ?? 9) <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            ~{s.due_label}
                          </span>
                        )}
                        <span>{FREQ_LABEL[s.frequency] ?? s.frequency}{s.person_name ? ` · ${s.person_name}` : ''}{s.reason ? ` · ${s.reason}` : ''}</span>
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={createChecklists} disabled={picked.size === 0}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
                <Check size={15} /> 선택한 {picked.size}건 체크리스트 생성
              </button>
            </div>
          )}
        </div>
      )}

      {/* 이력 */}
      {showHist && (
        <div className="no-print mt-4 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <h2 className="font-bold text-gray-900 px-5 pt-4 pb-2">판독 이력</h2>
          {hist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">저장된 리포트가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {hist.map(h => (
                <li key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <button onClick={() => { setRec(h); setPicked(new Set()); setShowHist(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-800 truncate">{h.report?.summary || '(요약 없음)'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {fmt(h.created_at)} · {h.author ?? '-'} · 사진 {h.images?.length ?? 0}장
                      {(h.report?.alerts?.length ?? 0) > 0 && <span className="text-red-500 ml-1">· 주의 {h.report.alerts.length}건</span>}
                    </p>
                  </button>
                  {(h.images ?? []).slice(0, 2).map((u, i) => (
                    <img key={i} src={handoverImageUrl(u)!} alt="" className="w-10 h-10 object-cover rounded border border-gray-200" />
                  ))}
                  {isAdmin && (
                    <button onClick={async () => { if (confirm('이 리포트를 삭제할까요?')) { await handoverAPI.remove(h.id); setHist(await handoverAPI.history()) } }}
                      className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {accessOpen && <AccessModal onClose={() => setAccessOpen(false)} />}
    </div>
  )
}

function AccessModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { setRows(await handoverAPI.accessList()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const toggle = async (r: AccessRow) => {
    try { await handoverAPI.setAccess(r.id, !r.granted); await load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '변경 실패') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-900">인수인계 AI 접근 권한</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-3 overflow-y-auto flex-1">
          <p className="text-[11px] text-gray-400 mb-2">관리자·시설장·간호사·간호조무사·사회복지사는 항상 접근 가능합니다. 그 외 직원은 여기서 지정하세요.</p>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={20} /></div> : (
            <ul className="space-y-1">
              {rows.map(r => (
                <li key={r.id} className="flex items-center gap-2 py-2 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-400">{r.position ?? r.role}</p>
                  </div>
                  {r.always
                    ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">직책상 허용</span>
                    : <button onClick={() => toggle(r)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${r.granted ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                        {r.granted ? '허용됨' : '허용'}
                      </button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

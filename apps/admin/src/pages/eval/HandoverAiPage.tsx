import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClipboardList, Upload, Loader2, Sparkles, AlertTriangle, Send, MessageCircle,
  Printer, History, Trash2, X, Check, ShieldCheck, Camera, ScanLine, RefreshCw, Search,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { handoverAPI, handoverImageUrl, type HandoverRecord, type AccessRow, type HandoverEntry } from '@/api/handoverClient'
import { isKakaoShareEnabled, shareText } from '@/lib/kakaoShare'
import { useLtcStore } from '@/store/ltc'
import { useIsMobile } from '@/hooks/useMediaQuery'
import ResidentPickerModal from '@/components/handover/ResidentPickerModal'
import { scanDocument } from '@/utils/docScan'

const URG = {
  high: { label: '긴급', cls: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '주의', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: '일반', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
} as const
const FREQ_LABEL: Record<string, string> = { one_time: '일회성', daily: '매일', weekly: '주간', monthly: '월간', quarterly: '분기', 'half-yearly': '반기', yearly: '연간' }
const kstDay = (v: string) => new Date(v).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const hhmm = (iso?: string | null) => !iso ? '' :
  new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
/** '오늘 · 7월 19일(일)' 형태의 그룹 제목 */
const dayLabel = (day: string) => {
  const today = kstDay(new Date().toISOString())
  const y = new Date(Date.now() - 86400000).toISOString()
  const d = new Date(day + 'T00:00:00')
  const w = ['일','월','화','수','목','금','토'][d.getDay()]
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일(${w})`
  if (day === today) return `오늘 · ${base}`
  if (day === kstDay(y)) return `어제 · ${base}`
  return base
}

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
  const [created, setCreated] = useState<Set<number>>(new Set())
  const [regen, setRegen] = useState(false)
  const [hist, setHist] = useState<HandoverRecord[]>([])
  const [showHist, setShowHist] = useState(false)
  const [histQ, setHistQ] = useState('')
  const [accessOpen, setAccessOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  const [picking, setPicking] = useState<number | null>(null)   // 명단 선택 중인 항목 index
  const { residents, loaded: ltcLoaded, loadAll: loadLtc } = useLtcStore()
  const isMobile = useIsMobile()
  const [scanMode, setScanMode] = useState(true)   // 기본 켬 — 회전·그림자 보정으로 판독 도움
  const [scanning, setScanning] = useState(false)

  useEffect(() => { if (!ltcLoaded) loadLtc() }, [ltcLoaded, loadLtc])

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
      setRec(r); setPicked(new Set()); setCreated(new Set())
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
      setCreated(prev => new Set([...prev, ...Array.from(picked)]))   // 중복 생성 방지
      setPicked(new Set())
      alert(`체크리스트 ${items.length}건을 생성했습니다.`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '생성 실패') }
  }

  const confirmMatch = async (entryIndex: number, cand: { id: string; name: string } | null) => {
    if (!rec) return
    try { setRec(await handoverAPI.confirmMatch(rec.id, entryIndex, cand)) }
    catch (e: any) { alert(e?.response?.data?.detail ?? '확정에 실패했습니다.') }
    finally { setPicking(null) }
  }

  const doRegenerate = async () => {
    if (!rec) return
    if (!confirm('확정한 어르신 이름으로 요약·주의사항·후속조치를 다시 만들까요?\n기존 요약은 대체됩니다.')) return
    setRegen(true)
    try {
      setRec(await handoverAPI.regenerate(rec.id))
      setCreated(new Set()); setPicked(new Set())   // 제안 목록이 새로 생성됨
      setHist(await handoverAPI.history().catch(() => hist))
    } catch (e: any) { alert(e?.response?.data?.detail ?? '재생성에 실패했습니다.') }
    finally { setRegen(false) }
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

  // 야간 근무는 자정을 넘는다(22:00 → 23:51 → 00:45 → 07:19).
  // 시간 문자열로 정렬하면 아침 기록이 맨 앞으로 와 근무 흐름이 뒤집힌다.
  const sorted = useMemo(() => {
    const es = [...(rep?.entries ?? [])]
    const mins = (t?: string) => {
      const m = /(\d{1,2})\s*[:.]\s*(\d{2})/.exec(t || '')
      return m ? Number(m[1]) * 60 + Number(m[2]) : null
    }
    const vals = es.map(e => mins(e.time)).filter((v): v is number => v !== null)
    // 저녁(18시~)과 오전(~12시)이 함께 있으면 자정을 넘긴 야간 근무로 본다
    const overnight = vals.some(v => v >= 18 * 60) && vals.some(v => v < 12 * 60)
    const key = (e: HandoverEntry) => {
      const v = mins(e.time)
      if (v === null) return Number.MAX_SAFE_INTEGER          // 시간 없는 항목은 맨 뒤
      return overnight && v < 12 * 60 ? v + 24 * 60 : v       // 새벽·아침은 다음 날로
    }
    return es.sort((a, b) => key(a) - key(b))
  }, [rep])
  const urgentCount = useMemo(() => sorted.filter(e => e.urgency === 'high').length, [sorted])
  const residentCount = useMemo(() => new Set(sorted.map(e => e.resident).filter(Boolean)).size, [sorted])
  // 표는 시간순 정렬본을 쓰지만, 저장은 원본 entries 인덱스 기준이다.
  // 정렬본의 i 를 그대로 보내면 다른 행이 확정되므로 반드시 원본 인덱스로 변환한다.
  const origIndex = (e: HandoverEntry) => rep?.entries?.indexOf(e) ?? -1

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
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-700"><ScanLine size={14} className="text-violet-600" /> 사진 보정 (선택)</span>
          <span className="text-[11px] text-gray-400">기울기·그림자를 정리해 AI가 읽기 쉽게 만듭니다. 결과가 이상하면 꺼보세요</span>
          {scanning && <span className="inline-flex items-center gap-1 text-[11px] text-violet-600 font-bold"><Loader2 size={12} className="animate-spin" /> 보정 중...</span>}
        </label>
        <p className="text-[11px] text-gray-400 mt-2">※ 어르신 성함·건강정보가 포함됩니다. 판독을 위해 이미지가 AI로 전송되며, 결과는 반드시 담당자가 확인·수정해 주세요.</p>
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      </div>

      {/* 결과 */}
      {rep && (
        <div className="print-area space-y-4">
          {(rep.alerts ?? []).length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
              <h2 className="font-bold text-red-700 text-[15px] flex items-center gap-1.5 mb-2">
                <AlertTriangle size={17} /> 주의 필요 {rep.alerts.length}건
              </h2>
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

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h2 className="font-bold text-gray-900">요약</h2>
              <div className="no-print flex items-center gap-1.5">
                <button onClick={doRegenerate} disabled={regen}
                  title="확정한 이름으로 요약을 다시 만듭니다"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-violet-200 text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-50">
                  {regen ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {regen ? '생성 중...' : '요약 다시 만들기'}
                </button>
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
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              {rep.pipeline && (
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  GPT 전사 {rep.pipeline.gpt_calls}회{rep.pipeline.claude_calls > 0 ? ' + Claude 검증 1회' : ''}
                </span>
              )}
              {rep.pipeline?.claude_error && (
                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded"
                  title={rep.pipeline.claude_error}>
                  Claude 검증 미적용 — {rep.pipeline.claude_error.slice(0, 40)}
                </span>
              )}
              {(rep.pipeline?.corrections ?? 0) > 0 && (
                <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                  Claude 교정 {rep.pipeline!.corrections}건
                </span>
              )}
              {(rep.matching?.matched ?? 0) < (rep.matching?.total ?? 0) && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  이름 확정 후 «요약 다시 만들기» 를 누르면 요약에도 반영됩니다
                </span>
              )}
              {(rep.pipeline?.low_confidence ?? 0) > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  판독 불확실 {rep.pipeline!.low_confidence}건 — 원본 확인 권장
                </span>
              )}
              <span className="text-[11px] text-gray-300">{rec?.model ?? ''} {rec?.created_at ? `· ${fmt(rec.created_at)}` : ''}</span>
            </div>
          </div>

          {sorted.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <h2 className="font-bold text-gray-900 px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap">
                판독 내역 <span className="text-xs font-normal text-gray-400">{sorted.length}건</span>
                {rep.matching && (
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                    수급자 매칭 {rep.matching.matched}/{rep.matching.total}
                  </span>
                )}
                {(rep.matching?.unmatched_names?.length ?? 0) > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    미매칭: {rep.matching!.unmatched_names.slice(0, 3).join(', ')}
                  </span>
                )}
              </h2>
              {isMobile ? (
                <ul className="divide-y divide-gray-50">
                  {sorted.map((e, i) => {
                    const u = URG[e.urgency] ?? URG.low
                    const unresolved = e.match === 'none' || e.match === 'ambiguous'
                    return (
                      <li key={i} className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${u.cls}`}>{u.label}</span>
                          <span className="text-[12px] text-gray-400">{e.time || '-'}</span>
                          <button onClick={() => setPicking(origIndex(e))}
                            className={`text-[14px] font-bold rounded px-1.5 py-0.5 ${
                              unresolved ? 'bg-amber-50 border border-amber-300 text-amber-900' : 'text-gray-800 border border-transparent'}`}>
                            {e.resident_matched || e.resident || '-'}{unresolved && ' ✎'}
                          </button>
                          {e.writer && <span className="text-[12px] text-gray-400 ml-auto">{e.writer}</span>}
                        </div>
                        {e.resident_matched && e.resident && e.resident_matched !== e.resident && (
                          <p className="text-[11px] text-gray-400 mb-0.5">기록지: {e.resident}</p>
                        )}
                        <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line">{e.content}</p>
                        {e.vitals && <p className="text-[12px] text-teal-600 mt-0.5">활력징후 {e.vitals}</p>}
                        {e.confidence === 'low' && <p className="text-[11px] text-amber-600 mt-0.5">※ 판독 불확실 — 원본 확인</p>}
                        {(e.match_suggest?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {e.match_suggest!.map(c => (
                              <button key={c.id} onClick={() => confirmMatch(origIndex(e), c)}
                                className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded">
                                {c.name}로 확정
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
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
                          <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-800">
                            <button onClick={() => setPicking(origIndex(e))} title="눌러서 명단에서 선택"
                              className={`text-left rounded px-1.5 py-0.5 -mx-1 ${
                                e.match === 'none' || e.match === 'ambiguous'
                                  ? 'bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100'
                                  : 'hover:bg-gray-100 border border-transparent'}`}>
                              {e.resident_matched || e.resident || '-'}
                              {(e.match === 'none' || e.match === 'ambiguous') && <span className="ml-1 text-[10px]">✎</span>}
                            </button>
                            {e.resident_matched && e.resident && e.resident_matched !== e.resident && (
                              <span className="block text-[10px] font-normal text-gray-400">기록지: {e.resident}</span>
                            )}
                            {(e.match === 'none' || e.match === 'ambiguous') && e.resident && (
                              <span className="block text-[10px] font-bold text-amber-600 mt-0.5">
                                {e.match === 'ambiguous' ? '확인 필요' : '명단에 없음'}
                              </span>
                            )}
                            {(e.match_suggest?.length ?? 0) > 0 && (
                              <span className="flex flex-wrap gap-1 mt-1">
                                {e.match_suggest!.map(c => (
                                  <button key={c.id} onClick={() => confirmMatch(origIndex(e), c)}
                                    title={`유사도 ${c.score}`}
                                    className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded hover:bg-violet-100">
                                    {c.name}로 확정
                                  </button>
                                ))}
                                <button onClick={() => confirmMatch(origIndex(e), null)}
                                  className="text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded hover:bg-gray-50">
                                  명단에 없음
                                </button>
                              </span>
                            )}
                            {e.match === 'confirmed' && (
                              <span className="block text-[10px] font-bold text-emerald-600 mt-0.5">확정됨</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mr-1.5 ${u.cls}`}>{u.label}</span>
                            <span className="whitespace-pre-line">{e.content}</span>
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
              )}
              {rep.unreadable_notes && (
                <details className="px-5 py-2 bg-amber-50 border-t border-amber-100">
                  <summary className="text-[11px] font-bold text-amber-700 cursor-pointer select-none">
                    판독 참고 — 확인이 필요한 부분 보기
                  </summary>
                  <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed whitespace-pre-wrap">{rep.unreadable_notes}</p>
                </details>
              )}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="no-print bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">후속 조치 제안</h2>
              <p className="text-xs text-gray-400 mb-3">필요한 항목만 선택해 체크리스트로 만드세요.</p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <label key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                    created.has(i) ? 'border-emerald-200 bg-emerald-50/60 cursor-default'
                    : picked.has(i) ? 'border-violet-300 bg-violet-50 cursor-pointer'
                    : 'border-gray-100 hover:bg-gray-50 cursor-pointer'}`}>
                    <input type="checkbox" checked={created.has(i) || picked.has(i)} disabled={created.has(i)}
                      onChange={() => toggle(i)} className="mt-0.5 accent-violet-600 disabled:opacity-60" />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${created.has(i) ? 'text-emerald-800' : 'text-gray-800'}`}>
                        {s.title}
                        {created.has(i) && <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">✓ 생성됨</span>}
                      </p>
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
                <Check size={15} /> {picked.size > 0 ? `선택한 ${picked.size}건 체크리스트 생성` : '만들 항목을 선택하세요'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 이력 */}
      {showHist && (() => {
        const kw = histQ.trim()
        const filtered = hist.filter(h => {
          if (!kw) return true
          const names = (h.report?.entries ?? []).map(e => e.resident_matched || e.resident).join(' ')
          return `${h.report?.summary ?? ''} ${names} ${h.author ?? ''}`.includes(kw)
        })
        // 날짜별 그룹
        const groups = new Map<string, HandoverRecord[]>()
        filtered.forEach(h => {
          const d = h.created_at ? kstDay(h.created_at) : '기타'
          if (!groups.has(d)) groups.set(d, [])
          groups.get(d)!.push(h)
        })

        return (
          <div className="no-print mt-4 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 flex-wrap">
              <h2 className="font-bold text-gray-900">판독 이력 <span className="text-xs font-normal text-gray-400">{filtered.length}건</span></h2>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input value={histQ} onChange={e => setHistQ(e.target.value)} placeholder="어르신·내용 검색"
                  className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-violet-200" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">{kw ? '검색 결과가 없습니다.' : '저장된 리포트가 없습니다.'}</p>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                {Array.from(groups.entries()).map(([day, items]) => (
                  <div key={day}>
                    <div className="sticky top-0 z-10 bg-gray-50 border-y border-gray-100 px-5 py-1.5">
                      <span className="text-[12px] font-bold text-gray-600">{day === '기타' ? '날짜 미상' : dayLabel(day)}</span>
                      <span className="text-[11px] text-gray-400 ml-2">{items.length}건</span>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {items.map(h => {
                        const r = h.report
                        const alerts = r?.alerts?.length ?? 0
                        const rows = r?.entries?.length ?? 0
                        const people = new Set((r?.entries ?? []).map(e => e.resident_matched || e.resident).filter(Boolean)).size
                        const unmatched = r?.matching ? r.matching.total - r.matching.matched : 0
                        return (
                          <li key={h.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50">
                            {h.images?.[0]
                              ? <img src={handoverImageUrl(h.images[0])!} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 shrink-0" />
                              : <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />}
                            <button onClick={() => { setRec(h); setPicked(new Set()); setCreated(new Set()); setShowHist(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                              className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[15px] font-bold text-gray-900 tabular-nums">{hhmm(h.created_at)}</span>
                                {alerts > 0 && (
                                  <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">주의 {alerts}</span>
                                )}
                                {unmatched > 0 && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">이름 미확정 {unmatched}</span>
                                )}
                                {r?.pipeline?.regenerated && (
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">요약 갱신됨</span>
                                )}
                              </div>
                              <p className="text-[13px] text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                                {r?.summary || '(요약 없음)'}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-1">
                                어르신 {people}명 · 기록 {rows}건 · 사진 {h.images?.length ?? 0}장 · {h.author ?? '-'}
                              </p>
                            </button>
                            {isAdmin && (
                              <button onClick={async () => { if (confirm('이 리포트를 삭제할까요?')) { await handoverAPI.remove(h.id); setHist(await handoverAPI.history()) } }}
                                title="삭제" className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {picking !== null && rep && (
        <ResidentPickerModal
          rawName={rep.entries?.[picking]?.resident ?? ''}
          residents={residents}
          currentId={rep.entries?.[picking]?.resident_id ?? null}
          onPick={(r) => confirmMatch(picking, r)}
          onClose={() => setPicking(null)}
        />
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

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, X, Image as ImageIcon, Smile, Wand2, Copy, RefreshCw,
  Download, ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, Info, Trash2,
  History, ChevronDown, ChevronUp, User as UserIcon,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/auth'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface EmojiMark { id: string; cx: number; cy: number; r: number }   // 이미지 원본좌표 기준
interface Photo {
  id: string
  file: File
  url: string
  caption: string
  emojis: EmojiMark[]
  natW: number
  natH: number
}
interface BlogResult {
  titles: string[]
  body: string
  hashtags: string[]
  guardian_summary: string
  photo_summaries: string[]
}

const TONES = [
  { v: 'warm',         label: '따뜻하게' },
  { v: 'guardian',     label: '보호자 안심형' },
  { v: 'professional', label: '전문적인 요양원 소개형' },
  { v: 'seo',          label: '네이버 SEO 홍보형' },
] as const

const STEPS = ['사진 업로드', '얼굴 가림', '기본 정보', 'AI 생성', '결과']
const ACCEPT = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const uid = () => Math.random().toString(36).slice(2)

// ── 스마일 그리기 (폰트 독립 · 얼굴 완전 가림) ────────────────────────────────
function drawSmiley(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#FFCE3A'; ctx.fill()
  ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = '#E0A800'; ctx.stroke()
  ctx.fillStyle = '#5A3E00'
  const ey = cy - r * 0.18, ex = r * 0.36, er = r * 0.12
  ctx.beginPath(); ctx.arc(cx - ex, ey, er, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + ex, ey, er, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = '#5A3E00'
  ctx.arc(cx, cy + r * 0.05, r * 0.5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke()
  ctx.restore()
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new window.Image()
    img.onload = () => res(img); img.onerror = rej; img.src = url
  })
}

// 얼굴 가림 처리된 blob 합성 (원본 해상도)
async function composeMaskedBlob(photo: Photo): Promise<Blob> {
  const img = await loadImage(photo.url)
  const canvas = document.createElement('canvas')
  canvas.width = photo.natW; canvas.height = photo.natH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, photo.natW, photo.natH)
  for (const e of photo.emojis) drawSmiley(ctx, e.cx, e.cy, e.r)
  return await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.9))
}

// ── face-api.js 동적 로드 (자동 얼굴 감지, best-effort) ────────────────────────
let faceApiPromise: Promise<any> | null = null
function ensureFaceApi(): Promise<any> {
  if (faceApiPromise) return faceApiPromise
  faceApiPromise = new Promise(async (resolve, reject) => {
    try {
      if (!(window as any).faceapi) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
          s.onload = () => res(); s.onerror = () => rej(new Error('face-api load 실패'))
          document.head.appendChild(s)
        })
      }
      const faceapi = (window as any).faceapi
      const MODEL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model'
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL)
      resolve(faceapi)
    } catch (e) { faceApiPromise = null; reject(e) }
  })
  return faceApiPromise
}

// ════════════════════════════════════════════════════════════════════════════
export default function BlogAiWriterPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const canSeeAll = isAdmin || user?.position === '대표' || user?.position === '이사'
  const [view, setView] = useState<'write' | 'history'>('write')
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  const [form, setForm] = useState({
    title_keyword: '', activity_date: '', program_name: '',
    participant_count: '', location: '', tone: 'warm' as string,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BlogResult | null>(null)
  const [maskedPreviews, setMaskedPreviews] = useState<{ idx: number; url: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // ── 사진 추가 ──
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => ACCEPT.includes(f.type))
    const next: Photo[] = []
    for (const file of arr) {
      const url = URL.createObjectURL(file)
      try {
        const img = await loadImage(url)
        next.push({ id: uid(), file, url, caption: '', emojis: [], natW: img.naturalWidth, natH: img.naturalHeight })
      } catch { /* skip */ }
    }
    if (next.length) setPhotos(p => [...p, ...next])
  }, [])

  const removePhoto = (id: string) =>
    setPhotos(p => { const t = p.find(x => x.id === id); if (t) URL.revokeObjectURL(t.url); return p.filter(x => x.id !== id) })
  const move = (i: number, dir: -1 | 1) =>
    setPhotos(p => { const j = i + dir; if (j < 0 || j >= p.length) return p; const c = [...p];[c[i], c[j]] = [c[j], c[i]]; return c })
  const setCaption = (id: string, caption: string) =>
    setPhotos(p => p.map(x => x.id === id ? { ...x, caption } : x))
  const setEmojis = (id: string, emojis: EmojiMark[]) =>
    setPhotos(p => p.map(x => x.id === id ? { ...x, emojis } : x))

  useEffect(() => () => { photos.forEach(p => URL.revokeObjectURL(p.url)) }, []) // eslint-disable-line

  // ── AI 생성 ──
  const generate = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      const previews: { idx: number; url: string }[] = []
      let n = 0
      for (const p of photos) {
        const blob = await composeMaskedBlob(p)
        fd.append('images', blob, `photo_${p.id}.jpg`)
        fd.append('captions', p.caption || '')
        n += 1
        previews.push({ idx: n, url: URL.createObjectURL(blob) })
      }
      setMaskedPreviews(previews)
      fd.append('title_keyword', form.title_keyword)
      fd.append('activity_date', form.activity_date)
      fd.append('program_name', form.program_name)
      fd.append('participant_count', form.participant_count)
      fd.append('location', form.location)
      fd.append('tone', form.tone)
      const res = await apiClient.post('/api/v1/blog-ai/analyze', fd, {
        headers: { 'Content-Type': undefined as any },   // axios가 multipart boundary 자동 설정
      })
      const data = (res.data as any)?.data ?? res.data
      setResult(data)
      setStep(4)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'AI 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally { setLoading(false) }
  }

  const downloadMasked = async () => {
    for (let i = 0; i < photos.length; i++) {
      const blob = await composeMaskedBlob(photos[i])
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `blog_${i + 1}.jpg`; a.click()
      URL.revokeObjectURL(a.href)
    }
  }

  const canNext = step === 0 ? photos.length > 0 : true
  const activePhoto = photos[activeIdx]

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wand2 size={20} className="text-primary-orange" /> 블로그 AI 작성
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">관리자·사회복지사 전용</p>
      </div>

      {/* 안내 카드 */}
      <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3.5 flex items-start gap-2.5">
        <Info size={16} className="text-primary-orange flex-shrink-0 mt-0.5" />
        <p className="text-sm text-orange-800 leading-relaxed">
          사진을 올리면 얼굴을 자동으로 가리고, AI가 네이버 블로그 글 초안을 만들어드립니다.
          실명·질환·부정적 표현 없이 따뜻한 글로 작성됩니다.
        </p>
      </div>

      {/* 글 작성 / 사용 이력 전환 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['write', '글 작성'], ['history', '사용 이력']] as ['write' | 'history', string][]).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'history' ? (
        <BlogHistory canSeeAll={canSeeAll} />
      ) : (
      <>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-shrink-0">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                i === step ? 'bg-primary-orange text-white'
                : i < step ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                i < step ? 'bg-orange-500 text-white' : i === step ? 'bg-white/30' : 'bg-gray-200'}`}>
                {i < step ? <Check size={10} /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <ArrowRight size={12} className="text-gray-300 mx-0.5" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: 사진 업로드 ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-primary-orange hover:bg-orange-50/30 transition-colors">
            <input ref={fileRef} type="file" accept={ACCEPT.join(',')} multiple className="hidden"
              onChange={e => e.target.files && addFiles(e.target.files)} />
            <Upload size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700">사진을 끌어다 놓거나 클릭해서 업로드</p>
            <p className="text-sm text-gray-400 mt-1">JPG · PNG · WEBP · 여러 장 가능 (5장 이상 권장)</p>
          </div>

          {photos.length > 0 && photos.length < 5 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertCircle size={13} /> 사진 5장 이상을 권장합니다. (현재 {photos.length}장)
            </div>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="relative aspect-square bg-gray-100">
                    <img src={p.url} className="w-full h-full object-cover" alt="" />
                    <button onClick={() => removePhoto(p.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/55 text-white rounded-lg flex items-center justify-center hover:bg-black/75">
                      <X size={13} />
                    </button>
                    <span className="absolute top-1.5 left-1.5 text-[10px] bg-black/55 text-white px-1.5 py-0.5 rounded-full">{i + 1}</span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <input value={p.caption} onChange={e => setCaption(p.id, e.target.value)}
                      placeholder="사진 설명(선택)"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-orange/30" />
                    <div className="flex gap-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0}
                        className="flex-1 text-[11px] py-1 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">◀ 앞으로</button>
                      <button onClick={() => move(i, 1)} disabled={i === photos.length - 1}
                        className="flex-1 text-[11px] py-1 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">뒤로 ▶</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: 얼굴 가림 ── */}
      {step === 1 && activePhoto && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button key={p.id} onClick={() => setActiveIdx(i)}
                className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 ${i === activeIdx ? 'border-primary-orange' : 'border-transparent opacity-70'}`}>
                <img src={p.url} className="w-full h-full object-cover" alt="" />
                {p.emojis.length > 0 && <span className="absolute bottom-0.5 right-0.5"><Smile size={12} className="text-amber-400" /></span>}
              </button>
            ))}
          </div>
          <FaceMaskEditor key={activePhoto.id} photo={activePhoto}
            onChange={emojis => setEmojis(activePhoto.id, emojis)} />
          <p className="text-xs text-gray-400">
            얼굴 위를 클릭하면 😊가 추가됩니다. 드래그로 이동, 슬라이더로 크기 조절, 선택 후 삭제할 수 있어요.
            저장·생성에는 가려진 이미지만 사용되고 얼굴 정보는 AI에 전달되지 않습니다.
          </p>
        </div>
      )}

      {/* ── Step 3: 기본 정보 ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="제목 키워드"><input className={ic} value={form.title_keyword}
              onChange={e => setForm({ ...form, title_keyword: e.target.value })} placeholder="예: 봄나들이, 어버이날" /></Field>
            <Field label="활동 날짜"><input type="date" className={ic} value={form.activity_date}
              onChange={e => setForm({ ...form, activity_date: e.target.value })} /></Field>
            <Field label="프로그램명"><input className={ic} value={form.program_name}
              onChange={e => setForm({ ...form, program_name: e.target.value })} placeholder="예: 원예치료, 음악프로그램" /></Field>
            <Field label="참여 어르신 수"><input className={ic} value={form.participant_count}
              onChange={e => setForm({ ...form, participant_count: e.target.value })} placeholder="예: 12" /></Field>
            <Field label="장소"><input className={ic} value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })} placeholder="예: 1층 프로그램실" /></Field>
          </div>
          <Field label="글 분위기">
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(t => (
                <button key={t.v} onClick={() => setForm({ ...form, tone: t.v })}
                  className={`text-sm py-2.5 rounded-xl border font-medium transition-colors ${
                    form.tone === t.v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* ── Step 4: AI 생성 ── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4">
          {loading ? (
            <>
              <Loader2 size={40} className="mx-auto text-primary-orange animate-spin" />
              <p className="font-semibold text-gray-700">AI가 블로그 글을 작성하고 있어요…</p>
              <p className="text-sm text-gray-400">사진 분석(ChatGPT) → 본문 집필(Claude · 레퍼런스 문체)</p>
            </>
          ) : (
            <>
              <Wand2 size={40} className="mx-auto text-primary-orange" />
              <p className="font-semibold text-gray-700">사진 {photos.length}장 · 얼굴 가림 처리 후 AI 글을 생성합니다</p>
              {error && (
                <div className="flex items-center justify-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <button onClick={generate}
                className="inline-flex items-center gap-2 bg-primary-orange text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-orange/90">
                <Wand2 size={16} /> AI 글 생성하기
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Step 5: 결과 ── */}
      {step === 4 && result && (
        <ResultView result={result} tone={form.tone} previews={maskedPreviews}
          onRegenerate={() => { setStep(3); setResult(null) }}
          onChangeTone={(tone) => { setForm(f => ({ ...f, tone })); setStep(3); setResult(null) }}
          onDownloadImages={downloadMasked} />
      )}

      {/* 하단 네비게이션 */}
      {step < 4 && view === 'write' && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 px-4 py-2.5 rounded-xl border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
            <ArrowLeft size={14} /> 이전
          </button>
          {step < 3 ? (
            <button onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-orange px-5 py-2.5 rounded-xl disabled:opacity-40 hover:bg-primary-orange/90">
              다음 <ArrowRight size={14} />
            </button>
          ) : <span />}
        </div>
      )}
      </>
      )}
    </div>
  )
}

const ic = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>{children}</div>
}

// ── 얼굴 가림 에디터 ──────────────────────────────────────────────────────────
function FaceMaskEditor({ photo, onChange }: { photo: Photo; onChange: (e: EmojiMark[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [emojis, setLocal] = useState<EmojiMark[]>(photo.emojis)
  const [sel, setSel] = useState<string | null>(null)
  const [dispW, setDispW] = useState(480)
  const [detecting, setDetecting] = useState(false)
  const [detMsg, setDetMsg] = useState('')
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)

  const scale = dispW / photo.natW
  const dispH = Math.round(photo.natH * scale)

  useEffect(() => { onChange(emojis) }, [emojis]) // eslint-disable-line

  useEffect(() => {
    const onResize = () => { if (wrapRef.current) setDispW(Math.min(560, wrapRef.current.clientWidth)) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { loadImage(photo.url).then(img => { imgRef.current = img; draw() }) }, [photo.url]) // eslint-disable-line
  useEffect(() => { draw() }) // redraw on any state change

  function draw() {
    const c = canvasRef.current, img = imgRef.current
    if (!c || !img) return
    c.width = dispW; c.height = dispH
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, dispW, dispH)
    ctx.drawImage(img, 0, 0, dispW, dispH)
    for (const e of emojis) {
      drawSmiley(ctx, e.cx * scale, e.cy * scale, e.r * scale)
      if (e.id === sel) {
        ctx.beginPath(); ctx.arc(e.cx * scale, e.cy * scale, e.r * scale + 3, 0, Math.PI * 2)
        ctx.strokeStyle = '#F97316'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([])
      }
    }
  }

  const toNat = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }
  const hit = (x: number, y: number) =>
    [...emojis].reverse().find(em => Math.hypot(em.cx - x, em.cy - y) <= em.r) || null

  const onDown = (e: React.PointerEvent) => {
    const { x, y } = toNat(e); const h = hit(x, y)
    if (h) { setSel(h.id); drag.current = { id: h.id, dx: x - h.cx, dy: y - h.cy } }
    else {
      const r = Math.max(24, photo.natW * 0.1)
      const nm: EmojiMark = { id: uid(), cx: x, cy: y, r }
      setLocal(p => [...p, nm]); setSel(nm.id)
    }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const { x, y } = toNat(e); const d = drag.current
    setLocal(p => p.map(em => em.id === d.id ? { ...em, cx: x - d.dx, cy: y - d.dy } : em))
  }
  const onUp = () => { drag.current = null }

  const selEmoji = emojis.find(e => e.id === sel)
  const setR = (r: number) => setLocal(p => p.map(e => e.id === sel ? { ...e, r } : e))
  const del = () => { setLocal(p => p.filter(e => e.id !== sel)); setSel(null) }

  const autoDetect = async () => {
    setDetecting(true); setDetMsg('')
    try {
      const faceapi = await ensureFaceApi()
      const img = imgRef.current!
      const dets = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
      if (!dets.length) { setDetMsg('얼굴을 찾지 못했어요. 수동으로 추가해주세요.'); return }
      const found: EmojiMark[] = dets.map((d: any) => {
        const b = d.box
        return { id: uid(), cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: Math.max(b.width, b.height) * 0.62 }
      })
      setLocal(p => [...p, ...found])
      setDetMsg(`${found.length}명의 얼굴을 가렸어요.`)
    } catch {
      setDetMsg('자동 감지를 불러오지 못했습니다. 얼굴 위를 클릭해 직접 가려주세요.')
    } finally { setDetecting(false) }
  }

  return (
    <div ref={wrapRef} className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={autoDetect} disabled={detecting}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-teal-600 px-3 py-2 rounded-xl hover:bg-teal-700 disabled:opacity-50">
          {detecting ? <Loader2 size={14} className="animate-spin" /> : <Smile size={14} />} 얼굴 자동 감지
        </button>
        <span className="text-xs text-gray-400">😊 {emojis.length}개</span>
        {detMsg && <span className="text-xs text-gray-500">{detMsg}</span>}
      </div>

      <canvas ref={canvasRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ width: dispW, height: dispH, touchAction: 'none' }}
        className="rounded-xl border border-gray-100 cursor-crosshair mx-auto block" />

      {selEmoji && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
          <span className="text-xs font-semibold text-gray-500 flex-shrink-0">크기</span>
          <input type="range" min={16} max={Math.round(photo.natW * 0.4)} value={Math.round(selEmoji.r)}
            onChange={e => setR(Number(e.target.value))} className="flex-1" />
          <button onClick={del} className="inline-flex items-center gap-1 text-xs text-red-500 px-2 py-1 rounded-lg hover:bg-red-50">
            <Trash2 size={12} /> 삭제
          </button>
        </div>
      )}
    </div>
  )
}

// ── 결과 뷰 ──────────────────────────────────────────────────────────────────
function ResultView({ result, tone, previews, onRegenerate, onChangeTone, onDownloadImages }: {
  result: BlogResult; tone: string; previews: { idx: number; url: string }[]
  onRegenerate: () => void; onChangeTone: (t: string) => void; onDownloadImages: () => void
}) {
  const [copied, setCopied] = useState('')
  const [chosenTitle, setChosenTitle] = useState(result.titles[0] ?? '')
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500)
  }
  const fullText = `${chosenTitle}\n\n${result.body}\n\n${result.hashtags.join(' ')}`
  const saveTxt = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([fullText], { type: 'text/plain;charset=utf-8' }))
    a.download = '네이버블로그_초안.txt'; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={onRegenerate} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} /> 다시 생성
        </button>
        <select value={tone} onChange={e => onChangeTone(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-orange/40">
          {TONES.map(t => <option key={t.v} value={t.v}>톤: {t.label}</option>)}
        </select>
        <button onClick={saveTxt} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
          <Download size={14} /> 글 저장(.txt)
        </button>
        <button onClick={onDownloadImages} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
          <ImageIcon size={14} /> 가림 이미지 저장
        </button>
      </div>

      {/* 추천 제목 */}
      <Card title="추천 제목" onCopy={() => copy('title', chosenTitle)} copied={copied === 'title'}>
        <div className="space-y-1.5">
          {result.titles.map((t, i) => (
            <button key={i} onClick={() => setChosenTitle(t)}
              className={`w-full text-left text-sm px-3 py-2 rounded-xl border transition-colors ${
                chosenTitle === t ? 'border-primary-orange bg-orange-50 text-gray-900 font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {chosenTitle === t && <Check size={12} className="inline mr-1 text-primary-orange" />}{t}
            </button>
          ))}
        </div>
      </Card>

      {/* 본문 — [사진 N] 위치에 실제 가림 사진 표시 */}
      <Card title="블로그 본문" onCopy={() => copy('body', result.body)} copied={copied === 'body'}>
        <p className="text-[11px] text-gray-400 mb-2">아래 사진 자리( [사진 N] )에 업로드한 사진을 넣으세요. 복사하면 표시도 함께 복사됩니다.</p>
        <div className="text-sm text-gray-700 leading-relaxed">
          {result.body.split(/(\[\s*사진\s*\d+\s*\])/g).map((part, i) => {
            const m = part.match(/^\[\s*사진\s*(\d+)\s*\]$/)
            if (m) {
              const n = Number(m[1]); const pv = previews.find(p => p.idx === n)
              return (
                <div key={i} className="my-3 flex items-center gap-3 bg-orange-50/70 border border-orange-100 rounded-xl p-2.5">
                  {pv
                    ? <img src={pv.url} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" alt={`사진 ${n}`} />
                    : <div className="w-20 h-20 rounded-lg bg-orange-100 flex items-center justify-center text-orange-400 flex-shrink-0"><ImageIcon size={20} /></div>}
                  <div>
                    <p className="text-xs font-semibold text-orange-700">📷 사진 {n} 위치</p>
                    <p className="text-[11px] text-gray-500">여기에 사진 {n}을(를) 넣으세요</p>
                  </div>
                </div>
              )
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>
          })}
        </div>
      </Card>

      {/* 해시태그 */}
      <Card title="해시태그" onCopy={() => copy('tags', result.hashtags.join(' '))} copied={copied === 'tags'}>
        <div className="flex flex-wrap gap-1.5">
          {result.hashtags.map((h, i) => (
            <span key={i} className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{h}</span>
          ))}
        </div>
      </Card>

      {/* 보호자 요약 */}
      <Card title="보호자 안내용 요약" onCopy={() => copy('guard', result.guardian_summary)} copied={copied === 'guard'}>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.guardian_summary}</p>
      </Card>

      {/* 사진별 요약 */}
      {result.photo_summaries.length > 0 && (
        <Card title="사진별 AI 요약">
          <ol className="space-y-1.5 list-decimal list-inside">
            {result.photo_summaries.map((s, i) => (
              <li key={i} className="text-sm text-gray-600 leading-relaxed">{s}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}

function Card({ title, children, onCopy, copied }: {
  title: string; children: React.ReactNode; onCopy?: () => void; copied?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {onCopy && (
          <button onClick={onCopy}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              copied ? 'border-green-200 bg-green-50 text-green-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ── 사용 이력 (관리자=전체 / 사회복지사=본인) ────────────────────────────────
interface UsageRow { user_name: string | null; position: string | null; user_role: string | null; count: number }
interface LogRow {
  id: string; user_name: string | null; position: string | null; created_at: string | null
  title_keyword: string | null; program_name: string | null; tone: string | null
  photo_count: number; titles: string[]; body: string; hashtags: string[]; guardian_summary: string
}

function toneLabel(v: string | null) {
  return TONES.find(t => t.v === v)?.label ?? (v ?? '-')
}
function fmtDateTime(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function BlogHistory({ canSeeAll }: { canSeeAll: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await apiClient.get('/api/v1/blog-ai/logs')
      const d = (res.data as any)?.data ?? res.data
      setUsage(d.usage ?? []); setLogs(d.logs ?? []); setTotal(d.total ?? 0)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '이력을 불러오지 못했습니다')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center py-16"><Loader2 size={26} className="animate-spin text-primary-orange" /></div>
  )
  if (error) return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
      <AlertCircle size={15} /> {error}
      <button onClick={load} className="ml-auto text-xs underline">다시 시도</button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500">전체 사용</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{total}회</p>
        </div>
        <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500">{canSeeAll ? '사용 계정 수' : '내 사용'}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{canSeeAll ? `${usage.length}명` : `${total}회`}</p>
        </div>
      </div>

      {/* 계정별 사용 횟수 */}
      {canSeeAll && usage.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <p className="px-4 py-3 border-b border-gray-50 text-sm font-bold text-gray-900">계정별 사용 횟수</p>
          <div className="divide-y divide-gray-50">
            {usage.map((u, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center"><UserIcon size={14} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{u.user_name ?? '(이름 없음)'}</p>
                  <p className="text-xs text-gray-400">{u.position ?? u.user_role ?? ''}</p>
                </div>
                <span className="text-sm font-bold text-primary-orange">{u.count}회</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 생성 이력 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <p className="px-4 py-3 border-b border-gray-50 text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <History size={14} /> 생성 이력 ({logs.length})
        </p>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">아직 생성 이력이 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(l => (
              <div key={l.id}>
                <button onClick={() => setOpenId(openId === l.id ? null : l.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {l.titles?.[0] || l.title_keyword || l.program_name || '제목 없음'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{l.user_name ?? '-'}</span>
                      <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{toneLabel(l.tone)}</span>
                      <span className="text-[11px] text-gray-400">사진 {l.photo_count}장 · {fmtDateTime(l.created_at)}</span>
                    </div>
                  </div>
                  {openId === l.id ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </button>
                {openId === l.id && (
                  <div className="px-4 pb-4 space-y-2.5 bg-gray-50/40">
                    {l.titles?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 mb-1">추천 제목</p>
                        <ul className="space-y-0.5">{l.titles.map((t, i) => <li key={i} className="text-xs text-gray-700">· {t}</li>)}</ul>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-semibold text-gray-500">본문</p>
                        <button onClick={() => navigator.clipboard.writeText(l.body)}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"><Copy size={11} /> 복사</button>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-white rounded-lg border border-gray-100 p-2.5 max-h-60 overflow-y-auto">{l.body}</p>
                    </div>
                    {l.hashtags?.length > 0 && (
                      <p className="text-[11px] text-blue-600">{l.hashtags.join(' ')}</p>
                    )}
                    {l.guardian_summary && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 mb-1">보호자 요약</p>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{l.guardian_summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

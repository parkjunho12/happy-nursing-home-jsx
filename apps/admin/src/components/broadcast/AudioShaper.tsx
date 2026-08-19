import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, Square, RotateCcw, Save } from 'lucide-react'
import {
  broadcastAPI, mediaUrl, EQ_BANDS, EQ_Q, EQ_MAX_DB,
  type AudioConfig, type AudioPreset,
} from '@/api/broadcastClient'

/**
 * 방송 음질 조절 — 브라우저에서 직접 듣고 맞춘다.
 *
 * 왜 브라우저인가: 숫자를 바꿔 저장하고 서버가 만들어 준 것을 다시 듣는 방식은
 * 한 번 고칠 때마다 몇 초씩 기다린다. 그래서는 '어디를 얼마나' 를 못 찾는다.
 * 슬라이더를 움직이는 즉시 소리가 바뀌고 눈에도 보여야 귀로 찾을 수 있다.
 *
 * 신호 흐름 (Web Audio)
 *   음원 → [입력 분석] → 8밴드 이큐 → 컴프레서 → 보정볼륨 → [출력 분석] → 스피커
 *
 * 맞춘 값은 서버에 저장되고, 서버가 음성을 만들 때 같은 값으로 처리한다.
 * 이큐는 양쪽 다 피킹 바이쿼드라 계산이 같지만 컴프레서는 구현이 달라
 * 미세하게 다를 수 있다 — 그래서 '서버가 만든 소리' 를 확인하는 자리를 따로 뒀다.
 */

const db2lin = (db: number) => Math.pow(10, db / 20)

type Nodes = {
  ctx: AudioContext
  src: AudioBufferSourceNode
  inAn: AnalyserNode
  outAn: AnalyserNode
  bands: BiquadFilterNode[]
  comp: DynamicsCompressorNode
  makeup: GainNode
}

export default function AudioShaper() {
  const [cfg, setCfg] = useState<AudioConfig | null>(null)
  const [presets, setPresets] = useState<AudioPreset[]>([])
  const [ffmpeg, setFfmpeg] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [prepping, setPrepping] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  /** 서버가 실제로 만들어 준 소리 — 최종 확인용 */
  const [rendered, setRendered] = useState<{ before: string; after: string } | null>(null)
  const [rendering, setRendering] = useState(false)

  const bufRef = useRef<AudioBuffer | null>(null)
  const nodesRef = useRef<Nodes | null>(null)
  const rafRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const grRef = useRef<HTMLDivElement | null>(null)      // 눌린 양 막대
  const grTxtRef = useRef<HTMLSpanElement | null>(null)
  const inRef = useRef<HTMLDivElement | null>(null)
  const outRef = useRef<HTMLDivElement | null>(null)
  // 슬라이더를 움직일 때마다 노드에 바로 반영하려면 최신 설정이 필요하다
  const cfgRef = useRef<AudioConfig | null>(null)
  cfgRef.current = cfg

  useEffect(() => {
    broadcastAPI.audioConfig()
      .then(r => { setCfg(r.config.custom ? r.config : { ...r.config, ...r.effective }); setPresets(r.presets); setFfmpeg(r.ffmpeg) })
      .catch(() => setErr('설정을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── 값 바꾸기 — 소리에 즉시 반영 ─────────────────────────── */
  const patch = (p: Partial<AudioConfig>) => {
    setCfg(c => {
      if (!c) return c
      const n = { ...c, ...p, custom: true }
      applyLive(n)
      return n
    })
    setDirty(true); setMsg('')
  }
  const setBand = (i: number, v: number) => {
    setCfg(c => {
      if (!c) return c
      const eq = [...(c.eq ?? [])]; eq[i] = v
      const n = { ...c, eq, custom: true }
      applyLive(n)
      return n
    })
    setDirty(true); setMsg('')
  }
  const usePreset = (p: AudioPreset) => {
    const n: AudioConfig = {
      ...(cfgRef.current as AudioConfig),
      preset: p.key as AudioConfig['preset'], custom: false,
      threshold_db: p.threshold_db, ratio: p.ratio,
      attack_ms: p.attack_ms, release_ms: p.release_ms,
      target_lufs: p.target_lufs,
      eq: [...(p.eq ?? EQ_BANDS.map(() => 0))],
    }
    setCfg(n); applyLive(n); setDirty(true); setMsg('')
  }

  const applyLive = (c: AudioConfig) => {
    const n = nodesRef.current
    if (!n) return
    const t = n.ctx.currentTime
    n.bands.forEach((b, i) => b.gain.setTargetAtTime(c.eq?.[i] ?? 0, t, 0.01))
    n.comp.threshold.setTargetAtTime(c.threshold_db, t, 0.01)
    n.comp.ratio.setTargetAtTime(Math.max(c.ratio, 1), t, 0.01)
    n.comp.knee.setTargetAtTime(c.knee_db ?? 6, t, 0.01)
    n.comp.attack.setTargetAtTime((c.attack_ms ?? 10) / 1000, t, 0.01)
    n.comp.release.setTargetAtTime((c.release_ms ?? 220) / 1000, t, 0.01)
    n.makeup.gain.setTargetAtTime(db2lin(c.makeup_db ?? 0), t, 0.01)
  }

  /* ── 듣기 ─────────────────────────────────────────────── */
  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    const n = nodesRef.current
    if (n) { try { n.src.stop() } catch { /* 이미 끝났을 수 있다 */ } n.ctx.close() }
    nodesRef.current = null
    setPlaying(false)
  }

  const play = async () => {
    if (playing) { stop(); return }
    const c = cfgRef.current
    if (!c) return
    setErr(''); setPrepping(true)
    try {
      // 들어볼 음원 — 서버가 만든 '보정 전' 안내방송을 쓴다(실제로 나갈 목소리다)
      if (!bufRef.current) {
        const r = await broadcastAPI.audioPreview({ config: { preset: 'off', custom: false } })
        const res = await fetch(mediaUrl(r.before.url ?? ''))
        const raw = await res.arrayBuffer()
        const tmp = new AudioContext()
        bufRef.current = await tmp.decodeAudioData(raw)
        tmp.close()
      }
      const ctx = new AudioContext()
      const src = ctx.createBufferSource()
      src.buffer = bufRef.current
      src.loop = true

      const inAn = ctx.createAnalyser(); inAn.fftSize = 2048; inAn.smoothingTimeConstant = 0.75
      const outAn = ctx.createAnalyser(); outAn.fftSize = 2048; outAn.smoothingTimeConstant = 0.75

      const bands = EQ_BANDS.map((f, i) => {
        const b = ctx.createBiquadFilter()
        b.type = 'peaking'; b.frequency.value = f; b.Q.value = EQ_Q
        b.gain.value = c.eq?.[i] ?? 0
        return b
      })
      const comp = ctx.createDynamicsCompressor()
      const makeup = ctx.createGain()

      src.connect(inAn)
      let node: AudioNode = inAn
      bands.forEach(b => { node.connect(b); node = b })
      node.connect(comp); comp.connect(makeup); makeup.connect(outAn); outAn.connect(ctx.destination)

      nodesRef.current = { ctx, src, inAn, outAn, bands, comp, makeup }
      applyLive(c)
      src.start()
      setPlaying(true)
      draw()
    } catch (e: any) {
      setErr('들어볼 음원을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally { setPrepping(false) }
  }

  /* ── 그리기 ───────────────────────────────────────────── */
  const draw = () => {
    const n = nodesRef.current
    const cv = canvasRef.current
    if (!n || !cv) return
    const g = cv.getContext('2d')
    if (!g) return
    const W = cv.width, H = cv.height
    const inBuf = new Uint8Array(n.inAn.frequencyBinCount)
    const outBuf = new Uint8Array(n.outAn.frequencyBinCount)
    const rate = n.ctx.sampleRate
    // 로그 주파수 축 — 사람이 소리를 듣는 방식이다
    const F0 = 40, F1 = 16000
    const xOf = (f: number) => (Math.log10(f / F0) / Math.log10(F1 / F0)) * W

    const tick = () => {
      const nn = nodesRef.current
      if (!nn) return
      nn.inAn.getByteFrequencyData(inBuf)
      nn.outAn.getByteFrequencyData(outBuf)
      g.clearRect(0, 0, W, H)

      // 눈금
      g.strokeStyle = 'rgba(148,163,184,0.18)'; g.lineWidth = 1
      g.font = '9px system-ui'; g.fillStyle = 'rgba(100,116,139,0.7)'
      EQ_BANDS.forEach(f => {
        const x = xOf(f)
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H - 12); g.stroke()
        g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x - 8, H - 2)
      })

      const spectrum = (buf: Uint8Array, fill: string) => {
        g.beginPath(); g.moveTo(0, H - 12)
        for (let x = 0; x <= W; x += 2) {
          const f = F0 * Math.pow(F1 / F0, x / W)
          const i = Math.min(buf.length - 1, Math.round((f / (rate / 2)) * buf.length))
          const y = (H - 14) * (1 - buf[i] / 255)
          g.lineTo(x, y)
        }
        g.lineTo(W, H - 12); g.closePath(); g.fillStyle = fill; g.fill()
      }
      spectrum(inBuf, 'rgba(148,163,184,0.30)')     // 원본 — 회색
      spectrum(outBuf, 'rgba(99,102,241,0.45)')     // 보정 후 — 보라

      // 이큐 곡선
      const c = cfgRef.current
      if (c) {
        g.beginPath()
        for (let x = 0; x <= W; x += 2) {
          const f = F0 * Math.pow(F1 / F0, x / W)
          let db = 0
          EQ_BANDS.forEach((bf, i) => {
            const gdb = c.eq?.[i] ?? 0
            if (!gdb) return
            // 피킹 필터의 대략적인 모양 — 곡선의 뜻을 보여주는 용도다
            const oct = Math.log2(f / bf)
            db += gdb * Math.exp(-Math.pow(oct * EQ_Q, 2))
          })
          const y = (H - 14) / 2 - (db / EQ_MAX_DB) * ((H - 14) / 2)
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
        }
        g.strokeStyle = 'rgba(16,185,129,0.95)'; g.lineWidth = 2; g.stroke()
      }

      // 눌린 양 · 입출력 크기
      const gr = Math.abs(nn.comp.reduction)
      if (grRef.current) grRef.current.style.width = `${Math.min(100, (gr / 24) * 100)}%`
      if (grTxtRef.current) grTxtRef.current.textContent = `-${gr.toFixed(1)}dB`
      const lvl = (buf: Uint8Array) => {
        let s = 0
        for (let i = 0; i < buf.length; i++) s += buf[i]
        return Math.min(100, (s / buf.length / 140) * 100)
      }
      if (inRef.current) inRef.current.style.width = `${lvl(inBuf)}%`
      if (outRef.current) outRef.current.style.width = `${lvl(outBuf)}%`

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  /* ── 저장 · 서버 소리 확인 ────────────────────────────── */
  const save = async () => {
    if (!cfg) return
    setSaving(true); setErr(''); setMsg('')
    try {
      const r = await broadcastAPI.audioSave(cfg)
      setCfg(r.config.custom ? r.config : { ...r.config, ...r.effective })
      setDirty(false); setRendered(null)
      setMsg('저장했습니다. 앞으로 만드는 음성부터 이 설정으로 나갑니다.')
    } catch (e: any) { setErr(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const renderOnServer = async () => {
    if (!cfg) return
    setRendering(true); setErr('')
    try {
      const r = await broadcastAPI.audioPreview({ config: cfg })
      setRendered({ before: r.before.url ?? '', after: r.after.url ?? '' })
    } catch (e: any) { setErr('서버에서 만들지 못했습니다') }
    finally { setRendering(false) }
  }

  if (loading || !cfg) return <p className="text-sm text-gray-400 py-10 text-center">불러오는 중…</p>

  const Slider = ({ k, label, lo, hi, step, unit }: {
    k: keyof AudioConfig; label: string; lo: number; hi: number; step: number; unit: string
  }) => (
    <label className="block">
      <span className="text-[11px] font-semibold text-gray-600">
        {label} <b className="text-gray-900 tabular-nums">{Number(cfg[k] ?? 0)}</b>
        <span className="font-normal text-gray-400"> {unit}</span>
      </span>
      <input type="range" min={lo} max={hi} step={step} value={Number(cfg[k] ?? lo)}
        onChange={e => patch({ [k]: Number(e.target.value) } as any)}
        className="w-full accent-indigo-600" />
    </label>
  )

  return (
    <div className="space-y-4">
      {!ffmpeg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-bold text-amber-800">서버에 ffmpeg 이 없습니다</p>
          <p className="text-[11px] text-amber-600 mt-0.5">
            여기서 듣는 소리는 나오지만, 실제 방송 음성에는 반영되지 않습니다. 관리자에게 알려주세요.
          </p>
        </div>
      )}

      {/* 실시간 흐름 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-bold text-gray-800">실시간 소리</p>
          <span className="text-[11px] text-gray-400">
            <span className="inline-block w-2 h-2 rounded-sm bg-slate-300 align-middle mr-1" />원본
            <span className="inline-block w-2 h-2 rounded-sm bg-indigo-400 align-middle mx-1" />보정 후
            <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 align-middle mx-1" />이큐 곡선
          </span>
          <button onClick={play} disabled={prepping}
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${
              playing ? 'bg-gray-900 text-white' : 'bg-indigo-600 text-white'}`}>
            {prepping ? <Loader2 size={11} className="animate-spin" />
              : playing ? <Square size={11} /> : <Play size={11} />}
            {playing ? '멈춤' : '들으면서 맞추기'}
          </button>
        </div>
        <canvas ref={canvasRef} width={880} height={190}
          className="w-full rounded-xl bg-slate-50 border border-slate-100" />
        {!playing && (
          <p className="text-[11px] text-gray-400 mt-1.5 text-center">
            「들으면서 맞추기」를 누르면 안내방송이 반복 재생되고, 슬라이더를 움직이는 즉시 소리가 바뀝니다.
            이 PC에서만 들립니다.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-[10px] font-bold text-gray-500 mb-1">들어온 소리</p>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div ref={inRef} className="h-full bg-slate-400 transition-[width] duration-75" style={{ width: '0%' }} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 mb-1">
              눌린 양 <span ref={grTxtRef} className="font-black text-amber-600 tabular-nums">-0.0dB</span>
            </p>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div ref={grRef} className="h-full bg-amber-500 transition-[width] duration-75" style={{ width: '0%' }} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 mb-1">나가는 소리</p>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div ref={outRef} className="h-full bg-indigo-500 transition-[width] duration-75" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 8밴드 이큐 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-bold text-gray-800">8밴드 이큐</p>
          <span className="text-[11px] text-gray-400">
            저음을 덜고 2~4k(자음)를 올리면 방송에서 말이 또렷해집니다
          </span>
          <button onClick={() => patch({ eq: EQ_BANDS.map(() => 0) })}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-700">
            <RotateCcw size={11} /> 평평하게
          </button>
        </div>
        <div className="flex gap-1 justify-between">
          {EQ_BANDS.map((f, i) => {
            const v = cfg.eq?.[i] ?? 0
            return (
              <div key={f} className="flex-1 flex flex-col items-center gap-1">
                <span className={`text-[10px] font-black tabular-nums ${
                  v > 0 ? 'text-emerald-600' : v < 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                  {v > 0 ? '+' : ''}{v}
                </span>
                <input type="range" min={-EQ_MAX_DB} max={EQ_MAX_DB} step={0.5} value={v}
                  onChange={e => setBand(i, Number(e.target.value))}
                  className="ws-eq accent-indigo-600"
                  style={{ writingMode: 'vertical-lr' as any, direction: 'rtl', width: 24, height: 110 }} />
                <span className="text-[10px] font-semibold text-gray-500">
                  {f >= 1000 ? `${f / 1000}k` : f}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 컴프레서 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-bold text-gray-800 mb-1">컴프레서</p>
        <p className="text-[11px] text-gray-400 mb-3">
          큰 소리만 눌러 세기를 고르게 만듭니다. 「눌린 양」이 말할 때 3~8dB 정도 움직이면 알맞습니다.
        </p>
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-3">
          <Slider k="threshold_db" label="누르기 시작하는 세기" lo={-50} hi={0} step={1} unit="dB" />
          <Slider k="ratio" label="누르는 정도" lo={1} hi={12} step={0.5} unit=": 1" />
          <Slider k="knee_db" label="부드럽게 넘기는 폭" lo={0} hi={24} step={1} unit="dB" />
          <Slider k="makeup_db" label="누른 뒤 다시 올리기" lo={-12} hi={12} step={0.5} unit="dB" />
          <Slider k="attack_ms" label="무는 속도" lo={1} hi={100} step={1} unit="ms" />
          <Slider k="release_ms" label="놓는 속도" lo={50} hi={800} step={10} unit="ms" />
        </div>
      </div>

      {/* 프리셋 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs font-bold text-gray-600 mb-2">
          기본값에서 시작하기 <span className="font-normal text-gray-400">— 누르면 값이 채워집니다. 그 뒤 자유롭게 고치세요</span>
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {presets.map(p => (
            <button key={p.key} onClick={() => usePreset(p)}
              className={`text-left p-2.5 rounded-xl border transition-colors ${
                !cfg.custom && cfg.preset === p.key
                  ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <p className="text-[13px] font-bold text-gray-800">{p.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{p.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 저장 · 서버 확인 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800">
              {dirty ? '저장하지 않은 변경이 있습니다' : '저장된 설정으로 방송됩니다'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              저장하면 <b>앞으로 만드는 음성</b>부터 적용됩니다. 이미 만들어 둔 음원은 그대로입니다.
            </p>
          </div>
          <button onClick={renderOnServer} disabled={rendering}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-50">
            {rendering && <Loader2 size={12} className="animate-spin" />} 서버 소리로 확인
          </button>
          <button onClick={save} disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
          </button>
        </div>

        {rendered && (
          <div className="grid md:grid-cols-2 gap-2.5 mt-3">
            <div className="rounded-xl border border-gray-100 p-2.5">
              <p className="text-[11px] font-bold text-gray-500 mb-1">원본</p>
              <audio controls src={mediaUrl(rendered.before)} className="w-full h-9" />
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5">
              <p className="text-[11px] font-bold text-indigo-700 mb-1">서버가 이 설정으로 만든 소리</p>
              <audio controls src={mediaUrl(rendered.after)} className="w-full h-9" />
            </div>
            <p className="md:col-span-2 text-[11px] text-gray-400">
              화면에서 듣는 소리와 서버가 만든 소리는 이큐는 같고 컴프레서는 미세하게 다를 수 있습니다.
              실제로 나갈 것은 이쪽입니다.
            </p>
          </div>
        )}
      </div>

      {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  Monitor, Tablet, Smartphone, RotateCcw, MousePointerClick,
  ExternalLink, ArrowLeftRight, Loader2, AlertTriangle, FlaskConical,
} from 'lucide-react'
import { PREVIEW_META, type PickedTarget, type PreviewInfo } from '@/api/aiEditorClient'

/**
 * 미리보기 — 고칠 화면을 보여주고, 요소를 눌러 고른다.
 *
 * 운영 사이트를 여기에 띄워 편집하지 않는다. 편집 에이전트가 만든 전용
 * worktree 의 미리보기 서버를 띄워 보여준다. 운영을 iframe 안에서 만지면
 * 실수 하나가 곧바로 어르신·직원이 쓰는 화면에 간다.
 *
 * iframe 안팎은 postMessage 로만 이야기한다. 다른 창의 DOM 을 직접 만지면
 * 주소가 달라지는 순간 조용히 멈춘다.
 */

const DEVICES = [
  { key: 'desktop', label: '데스크톱', icon: Monitor, w: 0 },
  { key: 'tablet', label: '태블릿', icon: Tablet, w: 834 },
  { key: 'mobile', label: '모바일', icon: Smartphone, w: 390 },
] as const

type Device = typeof DEVICES[number]['key']
const HOST = 'happy-inspector-host'
const CHILD = 'happy-inspector'

export default function PreviewPane({
  url, beforeUrl, pageUrl, onPick, onNavigate, picking, setPicking,
  preview, isJob, onRetry,
}: {
  /** 지금 보여줄 주소 — 없으면 안내만 띄운다 */
  url?: string | null
  /** 변경 전 주소(있으면 전/후 전환) */
  beforeUrl?: string | null
  pageUrl?: string | null
  onPick: (t: PickedTarget) => void
  onNavigate?: (path: string) => void
  picking: boolean
  setPicking: (v: boolean) => void
  /** 상시 미리보기 상태 — 아직 안 떴을 때 무엇을 기다리는지 알려준다 */
  preview?: PreviewInfo | null
  /** 지금 보고 있는 것이 작업 결과인가(아니면 기준 브랜치인가) */
  isJob?: boolean
  onRetry?: () => void
}) {
  const [device, setDevice] = useState<Device>('desktop')
  const [showBefore, setShowBefore] = useState(false)
  const [ready, setReady] = useState(false)
  const [nonce, setNonce] = useState(0)
  const frame = useRef<HTMLIFrameElement | null>(null)

  const src = showBefore && beforeUrl ? beforeUrl : url

  /** iframe 에서 오는 말 듣기 */
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const m = e.data
      if (!m || m.source !== CHILD) return
      if (m.type === 'ready') setReady(true)
      if (m.type === 'picked') { onPick(m.payload); setPicking(false) }
      if (m.type === 'picking') setPicking(!!m.payload?.on)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [onPick, setPicking])

  /** 요소 고르기 켜고 끄기 */
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { source: HOST, type: 'setPicking', on: picking }, '*')
  }, [picking, ready])

  /** 주소칸은 따로 들고 있는다 — 위 input 주석 참고 */
  const [addr, setAddr] = useState(pageUrl || '/')
  useEffect(() => { setAddr(pageUrl || '/') }, [pageUrl])

  const reload = () => { setReady(false); setNonce(n => n + 1) }
  const width = DEVICES.find(d => d.key === device)!.w

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 도구 막대 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {DEVICES.map(d => (
            <button key={d.key} onClick={() => setDevice(d.key)}
              title={d.label}
              className={`p-1.5 rounded-md transition-colors ${
                device === d.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              <d.icon size={14} />
            </button>
          ))}
        </div>

        <button onClick={reload} disabled={!src} title="새로고침"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30">
          <RotateCcw size={14} />
        </button>

        <button onClick={() => setPicking(!picking)} disabled={!src || !ready}
          title={ready ? '화면에서 고칠 요소를 클릭합니다' : '미리보기가 준비되면 쓸 수 있습니다'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-40 ${
            picking ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <MousePointerClick size={12} />
          {picking ? '고르는 중… (Esc 취소)' : '요소 선택'}
        </button>

        {beforeUrl && (
          <button onClick={() => { setShowBefore(v => !v); reload() }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
              showBefore ? 'bg-amber-500 border-amber-500 text-white'
                         : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <ArrowLeftRight size={12} />
            {showBefore ? '변경 전 보는 중' : '변경 전과 비교'}
          </button>
        )}

        {/* 지금 보고 있는 것이 무엇인지 — 이걸 헷갈리면 엉뚱한 것을 보고 판단한다 */}
        {src && (
          <span title={isJob ? '이 작업의 수정 결과입니다' : '아직 아무것도 고치지 않은 기준 브랜치입니다'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
              isJob ? 'bg-violet-50 border-violet-200 text-violet-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <FlaskConical size={10} />
            {isJob ? '수정 결과' : '기준 화면'}
          </span>
        )}

        {/* 주소 — 미리보기 안에서 다른 화면으로 옮겨간다.
            타이핑 중에는 건드리지 않는다. 글자마다 주소가 바뀌면 iframe 이
            글자마다 다시 뜬다. Enter 를 눌렀을 때만 옮긴다. */}
        <input
          value={addr}
          onChange={e => setAddr(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            const path = addr.startsWith('/') ? addr : `/${addr}`
            setAddr(path)
            onNavigate?.(path)
          }}
          onBlur={() => setAddr(pageUrl || '/')}
          placeholder="/eval/residents"
          title="경로를 고치고 Enter — 미리보기가 그 화면으로 갑니다"
          className="ml-1 flex-1 min-w-[8rem] max-w-[20rem] px-2 py-1 text-[11px] font-mono
                     border border-gray-200 rounded-lg text-gray-600" />

        {src && (
          <a href={src} target="_blank" rel="noreferrer" title="새 창에서 열기"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50">
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* 화면 */}
      <div className="flex-1 min-h-0 bg-slate-100 overflow-auto p-3">
        {!src ? (
          <Waiting preview={preview} onRetry={onRetry} />
        ) : (
          <div className="mx-auto bg-white rounded-xl shadow-sm overflow-hidden h-full"
            style={{ width: width ? `${width}px` : '100%', maxWidth: '100%' }}>
            <iframe
              key={`${src}-${nonce}`}
              ref={frame}
              src={src}
              title="미리보기"
              className="w-full h-full border-0"
              // 미리보기는 우리가 띄운 개발 서버다. 다만 상위 창을 벗어나는 이동은 막는다.
              sandbox="allow-scripts allow-same-origin allow-forms"
              onLoad={() => {
                frame.current?.contentWindow?.postMessage({ source: HOST, type: 'ping' }, '*')
              }}
            />
          </div>
        )}
      </div>

      {src && !ready && (
        <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin text-gray-300" />
          <span className="text-[11px] text-gray-400">
            미리보기를 여는 중입니다 — 요소 선택은 열린 뒤에 쓸 수 있습니다
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * 아직 볼 것이 없을 때.
 *
 * '미리보기가 없습니다' 한 줄로 끝내면, 기다리면 되는 것인지 뭔가 잘못된
 * 것인지 알 수가 없다. 특히 첫 실행은 의존성 설치로 5~10분이 걸리는데
 * 그동안 아무 말이 없으면 멈춘 줄 알고 새로고침만 누르게 된다.
 */
function Waiting({ preview, onRetry }: {
  preview?: PreviewInfo | null
  onRetry?: () => void
}) {
  const state = preview?.state ?? 'off'
  const meta = PREVIEW_META[state]
  const working = state === 'starting' || state === 'installing'
  const failed = state === 'failed'

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {working ? <Loader2 className="w-9 h-9 text-indigo-300 mx-auto mb-3 animate-spin" />
          : failed ? <AlertTriangle className="w-9 h-9 text-rose-300 mx-auto mb-3" />
            : <Monitor className="w-10 h-10 text-gray-300 mx-auto mb-3" />}

        <p className={`text-sm font-bold ${failed ? 'text-rose-600' : 'text-gray-600'}`}>
          {working ? `미리보기를 준비하고 있습니다 — ${meta.label}`
            : failed ? '미리보기를 띄우지 못했습니다'
              : '미리보기가 아직 없습니다'}
        </p>

        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
          {failed ? (preview?.msg || meta.hint)
            : working ? meta.hint
              : '편집 에이전트가 기준 브랜치로 화면을 띄워 둡니다. 왼쪽에서 화면을 고르면 여기에 나옵니다.'}
        </p>

        {state === 'installing' && (
          <p className="text-[11px] text-gray-400 mt-2">
            처음 한 번만 걸립니다. 다음부터는 바로 뜹니다.
          </p>
        )}

        {!working && (
          <>
            <p className="text-[11px] text-gray-400 mt-3">
              <b className="text-gray-500">운영 화면은 여기서 편집하지 않습니다.</b>
              {' '}보고 있는 것은 언제나 전용 작업 폴더입니다.
            </p>
            {onRetry && (
              <button onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50">
                <RotateCcw size={12} /> 다시 시도
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

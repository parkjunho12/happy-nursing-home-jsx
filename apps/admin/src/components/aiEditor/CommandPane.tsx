import { useState } from 'react'
import {
  Crosshair, FileCode2, Loader2, Play, Search, Square, GitPullRequest,
  Check, RotateCcw, ExternalLink, AlertTriangle,
} from 'lucide-react'
import {
  SCOPE_META, JOB_STATUS_META,
  type AiJob, type PickedTarget, type JobEvent,
} from '@/api/aiEditorClient'

/**
 * 오른쪽 패널 — 고른 요소를 보여주고, 무엇을 고칠지 받는다.
 *
 * 예시 문장을 눌러 넣을 수 있게 둔 이유: 처음 쓰는 사람은 "얼마나 자세히
 * 적어야 하나" 를 모른다. 잘 통하는 문장을 보여주는 편이 설명보다 빠르다.
 */

const EXAMPLES = [
  '이 버튼을 파란색으로 바꾸고 글씨를 더 크게 해줘',
  '이 카드 아래에 상담 신청 버튼을 추가해줘',
  '모바일에서 이 영역이 한 줄씩 나오게 수정해줘',
  '이 페이지 전체를 60대도 사용하기 쉽게 개선해줘',
  '이 문구를 더 친절하게 바꾸고 관련 테스트도 수정해줘',
]

export default function CommandPane({
  target, job, events, busy, canRun, onRun, onAnalyze, onCancel,
  onApprove, onRevise, onRollback,
}: {
  target: PickedTarget | null
  job: AiJob | null
  events: JobEvent[]
  busy: boolean
  canRun: boolean
  onRun: (b: Body) => void
  onAnalyze: (b: Body) => void
  onCancel: () => void
  onApprove: (merge: boolean) => void
  onRevise: (text: string) => void
  onRollback: () => void
}) {
  const [text, setText] = useState('')
  const [scope, setScope] = useState<string>('element')
  const [priority, setPriority] = useState(5)
  const [autoDeploy, setAutoDeploy] = useState(false)
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [tab, setTab] = useState<'cmd' | 'result'>('cmd')
  const [revise, setRevise] = useState('')

  const body = (): Body => ({
    instruction: text.trim(), scope, priority,
    approve_mode: autoDeploy ? 'auto' : 'manual',
    extra_notes: notes.trim() || null,
    images: images.length ? images : undefined,
  })

  const running = !!job && ['QUEUED', 'RUNNING', 'ANALYZING', 'CHECKING'].includes(job.status)
  const meta = job ? JOB_STATUS_META[job.status] : null
  const checksOk = !!job?.checks?.length && job.checks.every(c => c.ok)

  const L = ({ children }: { children: React.ReactNode }) =>
    <p className="text-[11px] font-bold text-gray-500 mb-1">{children}</p>

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 p-1 m-2 bg-gray-100 rounded-xl">
        {([['cmd', '수정 요청'], ['result', job ? `진행 · ${meta?.label}` : '진행']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              tab === k ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-3">
        {tab === 'cmd' ? (<>
          {/* 고른 요소 */}
          <div className="rounded-xl border border-gray-100 bg-white p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Crosshair size={12} className="text-indigo-500" />
              <p className="text-[11px] font-bold text-gray-700">선택한 요소</p>
            </div>
            {!target ? (
              <p className="text-[11px] text-gray-400 leading-relaxed">
                가운데 미리보기에서 <b>「요소 선택」</b>을 누르고 고칠 곳을 클릭하세요.
                고르지 않아도 화면 전체를 대상으로 요청할 수 있습니다.
              </p>
            ) : (
              <div className="space-y-1 text-[11px]">
                <Row k="태그" v={target.tag} />
                <Row k="컴포넌트" v={target.componentName} />
                {target.text && <Row k="글자" v={`"${target.text.slice(0, 60)}"`} />}
                {target.sourceFile && (
                  <div className="flex gap-1.5">
                    <span className="w-12 shrink-0 text-gray-400">소스</span>
                    <span className="font-mono text-[10px] text-indigo-700 break-all">
                      <FileCode2 size={9} className="inline mr-0.5 align-[-1px]" />
                      {target.sourceFile}
                      {target.line ? `:${target.line}` : ''}{target.column ? `:${target.column}` : ''}
                    </span>
                  </div>
                )}
                <Row k="선택자" v={target.selector} mono />
                {!!target.componentPath?.length && (
                  <Row k="경로" v={target.componentPath.join(' › ')} />
                )}
                {target.style && (
                  <details className="pt-1">
                    <summary className="text-[10px] text-gray-400 cursor-pointer">지금 스타일</summary>
                    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {Object.entries(target.style).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} className="flex gap-1 truncate">
                          <span className="text-gray-400">{k}</span>
                          <span className="text-gray-600 truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* 명령 */}
          <div>
            <L>무엇을 고칠까요</L>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
              placeholder="예) 이 버튼을 파란색으로 바꾸고 글씨를 더 크게 해줘"
              className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {EXAMPLES.map(x => (
                <button key={x} onClick={() => setText(x)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 truncate max-w-full">
                  {x}
                </button>
              ))}
            </div>
          </div>

          <div>
            <L>수정 범위</L>
            <div className="space-y-1">
              {SCOPE_META.map(s => (
                <button key={s.v} onClick={() => setScope(s.v)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                    scope === s.v ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="font-bold text-gray-800">{scope === s.v ? '✓ ' : ''}{s.label}</span>
                  <span className="block text-[10px] text-gray-500 mt-0.5">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <L>우선순위</L>
              <select value={priority} onChange={e => setPriority(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white">
                <option value={1}>1 · 급함</option>
                <option value={3}>3 · 높음</option>
                <option value={5}>5 · 보통</option>
                <option value={7}>7 · 낮음</option>
              </select>
            </label>
            <label className="block">
              <L>승인 방식</L>
              <select value={autoDeploy ? 'auto' : 'manual'}
                onChange={e => setAutoDeploy(e.target.value === 'auto')}
                className="w-full px-2 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white">
                <option value="manual">보고 나서 승인</option>
                <option value="auto">검증 통과 시 자동</option>
              </select>
            </label>
          </div>
          {autoDeploy && (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 flex gap-1.5">
              <AlertTriangle size={11} className="shrink-0 mt-px" />
              검증만 통과하면 사람이 보지 않고 병합됩니다. 배포까지 이어지니 익숙한 수정에만 쓰세요.
            </p>
          )}

          <details className="rounded-xl border border-gray-100 bg-white p-2.5">
            <summary className="text-[11px] font-bold text-gray-500 cursor-pointer">추가 요구사항 · 이미지</summary>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="예) 기존 색 규칙을 따라주세요 / 테스트도 같이 고쳐주세요"
              className="w-full mt-1.5 px-2.5 py-2 text-[11px] border border-gray-200 rounded-lg resize-none" />
            <input value={images.join(',')} onChange={e =>
              setImages(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="참고 이미지 주소 (쉼표로 구분)"
              className="w-full mt-1.5 px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-lg" />
          </details>

          <div className="grid grid-cols-2 gap-2 sticky bottom-0 bg-white pt-1">
            <button onClick={() => onAnalyze(body())}
              disabled={busy || !text.trim() || !canRun || running}
              title="파일을 고치지 않고 무엇을 어떻게 바꿀지만 봅니다"
              className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-600 disabled:opacity-40">
              <Search size={12} /> 변경안 분석
            </button>
            <button onClick={() => onRun(body())}
              disabled={busy || !text.trim() || !canRun || running}
              className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-bold disabled:opacity-40">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              수정 실행
            </button>
          </div>
          {!canRun && (
            <p className="text-[10px] text-rose-600">
              편집 에이전트가 붙어 있지 않습니다. 접수해도 아무 일이 일어나지 않습니다.
            </p>
          )}
        </>) : (
          /* ── 진행 ── */
          <div className="space-y-3">
            {!job ? (
              <p className="text-[11px] text-gray-400 text-center py-10">아직 진행 중인 작업이 없습니다.</p>
            ) : (<>
              <div className="rounded-xl border border-gray-100 bg-white p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${meta?.dot} ${running ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta?.cls}`}>{meta?.label}</span>
                  <span className="text-[11px] text-gray-600 truncate">{job.step}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${job.progress}%` }} />
                </div>
                {job.branch && (
                  <p className="text-[10px] text-gray-400 mt-1.5 font-mono truncate">{job.branch}</p>
                )}
                {job.error && (
                  <p className="text-[11px] text-rose-600 mt-1.5 bg-rose-50 rounded-lg px-2 py-1.5">{job.error}</p>
                )}
              </div>

              {!!job.checks?.length && (
                <div className="rounded-xl border border-gray-100 bg-white p-2.5">
                  <p className="text-[11px] font-bold text-gray-500 mb-1">검증</p>
                  {job.checks.map((c, i) => (
                    <details key={i} className="text-[10.5px]">
                      <summary className={`cursor-pointer ${c.ok ? 'text-emerald-700' : 'text-rose-600 font-bold'}`}>
                        {c.ok ? '✓' : '✗'} <span className="font-mono">{c.name}</span>
                        {c.ms ? <span className="text-gray-400"> {(c.ms / 1000).toFixed(1)}초</span> : null}
                      </summary>
                      {c.output && (
                        <pre className="mt-1 p-1.5 bg-gray-50 rounded text-[9.5px] overflow-x-auto max-h-40 whitespace-pre-wrap">{c.output}</pre>
                      )}
                    </details>
                  ))}
                </div>
              )}

              {!!job.files?.length && (
                <div className="rounded-xl border border-gray-100 bg-white p-2.5">
                  <p className="text-[11px] font-bold text-gray-500 mb-1">고친 파일 {job.files.length}개</p>
                  {job.files.map(f => (
                    <div key={f.path} className="flex gap-1.5 text-[10.5px]">
                      <span className="font-mono text-gray-600 truncate flex-1">{f.path}</span>
                      <span className="text-emerald-600">+{f.added}</span>
                      <span className="text-rose-500">-{f.removed}</span>
                    </div>
                  ))}
                </div>
              )}

              {job.plan && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-2.5">
                  <p className="text-[11px] font-bold text-sky-800 mb-1">변경안</p>
                  <pre className="text-[10.5px] text-gray-700 whitespace-pre-wrap leading-relaxed">{job.plan}</pre>
                </div>
              )}
              {job.summary && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                  <p className="text-[11px] font-bold text-emerald-800 mb-1">무엇을 고쳤나</p>
                  <pre className="text-[10.5px] text-gray-700 whitespace-pre-wrap leading-relaxed">{job.summary}</pre>
                </div>
              )}

              {/* 진행 기록 */}
              <div className="rounded-xl border border-gray-100 bg-gray-900 p-2 max-h-52 overflow-y-auto">
                {events.length === 0
                  ? <p className="text-[10px] text-gray-500">기록이 없습니다.</p>
                  : events.map((e, i) => (
                    <div key={i} className="text-[10px] font-mono leading-relaxed">
                      <span className="text-gray-500">{(e.at || '').slice(11, 19)} </span>
                      <span className={e.level === 'error' ? 'text-rose-400'
                        : e.level === 'warn' ? 'text-amber-300' : 'text-gray-200'}>{e.message}</span>
                    </div>
                  ))}
              </div>

              {/* 버튼 */}
              <div className="space-y-1.5 sticky bottom-0 bg-white pt-1">
                {running && (
                  <button onClick={onCancel}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-200 text-rose-600 text-[11px] font-bold">
                    <Square size={11} /> 작업 중지
                  </button>
                )}
                {job.preview_url && (
                  <a href={job.preview_url} target="_blank" rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 text-[11px] font-bold">
                    <ExternalLink size={11} /> Preview 확인
                  </a>
                )}
                {job.status === 'PREVIEW' && (
                  <>
                    <div className="flex gap-1.5">
                      <input value={revise} onChange={e => setRevise(e.target.value)}
                        placeholder="더 고칠 것이 있으면 적어주세요"
                        className="flex-1 px-2 py-1.5 text-[11px] border border-gray-200 rounded-lg" />
                      <button onClick={() => { onRevise(revise); setRevise('') }}
                        disabled={!revise.trim()}
                        className="px-2.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 disabled:opacity-40">
                        수정 요청
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => onApprove(false)} disabled={!checksOk}
                        title={checksOk ? '' : '검증을 통과해야 승인할 수 있습니다'}
                        className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-[11px] font-bold disabled:opacity-40">
                        <GitPullRequest size={11} /> PR 생성
                      </button>
                      <button onClick={() => onApprove(true)} disabled={!checksOk}
                        className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-40">
                        <Check size={11} /> 승인 및 배포
                      </button>
                    </div>
                  </>
                )}
                {job.pr_url && (
                  <a href={job.pr_url} target="_blank" rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 text-[11px] font-bold">
                    <GitPullRequest size={11} /> PR #{job.pr_number} 열기
                  </a>
                )}
                {['MERGED', 'DEPLOYED'].includes(job.status) && (
                  <button onClick={onRollback}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-200 text-amber-700 text-[11px] font-bold">
                    <RotateCcw size={11} /> 롤백 (되돌리기 PR)
                  </button>
                )}
              </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  )
}

export interface Body {
  instruction: string
  scope: string
  priority: number
  approve_mode: string
  extra_notes?: string | null
  images?: string[]
}

function Row({ k, v, mono }: { k: string; v?: string | null; mono?: boolean }) {
  if (!v) return null
  return (
    <div className="flex gap-1.5">
      <span className="w-12 shrink-0 text-gray-400">{k}</span>
      <span className={`text-gray-700 break-all ${mono ? 'font-mono text-[10px]' : ''}`}>{v}</span>
    </div>
  )
}

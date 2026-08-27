import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Wand2, Server, GitBranch, FileCode2, Loader2, RefreshCw, Circle, Rocket,
} from 'lucide-react'
import {
  aiEditorAPI, JOB_STATUS_META, PREVIEW_META,
  type AiService, type AiAgent, type AiJob, type JobEvent, type PickedTarget,
  type PreviewInfo, type PendingDeploy,
} from '@/api/aiEditorClient'
import PreviewPane from '@/components/aiEditor/PreviewPane'
import CommandPane, { type Body } from '@/components/aiEditor/CommandPane'
import { mergeConfirmText } from '@/utils/aiEditorDeploy'

/**
 * AI 페이지 편집기 — 화면을 보며 말로 고친다.
 *
 * 흐름
 *   서비스·화면 고르기 → 미리보기에서 요소 클릭 → 무엇을 고칠지 적기
 *   → 접수 → 편집 에이전트가 전용 작업 폴더에서 수정 → 검증 → 미리보기
 *   → 사람이 보고 승인 → PR·병합 → 기존 GitHub Actions 가 배포
 *
 * 이 화면은 소스를 직접 만지지 않는다. 접수하고 진행을 보여줄 뿐이다.
 * 운영 사이트를 iframe 안에서 편집하지도 않는다 — 실수 하나가 곧바로
 * 어르신·직원이 쓰는 화면에 가기 때문이다.
 */
export default function AiEditorPage() {
  const [services, setServices] = useState<AiService[]>([])
  const [agents, setAgents] = useState<AiAgent[]>([])
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [pending, setPending] = useState<PendingDeploy | null>(null)
  const [svcKey, setSvcKey] = useState<string>('')
  const [pageUrl, setPageUrl] = useState<string>('')
  const [jobs, setJobs] = useState<AiJob[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<AiJob | null>(null)
  const [events, setEvents] = useState<JobEvent[]>([])
  const [target, setTarget] = useState<PickedTarget | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const timer = useRef<number | null>(null)

  const svc = useMemo(() => services.find(s => s.key === svcKey) ?? null, [services, svcKey])
  const online = agents.filter(a => a.online).length

  /* ── 미리보기에 무엇을 띄울지 ──
     작업을 고르면 그 결과를, 아니면 기준 브랜치를 본다. 어느 쪽이든 경로는
     지금 고른 화면을 따라간다 — 화면을 고르는 것만으로 옮겨 다닐 수 있어야
     하기 때문이다. */
  const previewUrl = useMemo(() => {
    const isJob = !!job?.preview_url
    const raw = isJob ? job!.preview_url!
      : (preview?.state === 'ready' && preview.kind === 'base' ? preview.url : null)
    if (!raw) return null
    const path = pageUrl || '/'
    // 에이전트가 준 주소에는 경로가 붙어 있을 수 있다. 껍데기만 남기고
    // 지금 고른 화면을 붙인다.
    try { return new URL(raw).origin + (path.startsWith('/') ? path : `/${path}`) }
    catch { return raw }
  }, [job?.preview_url, preview?.state, preview?.kind, preview?.url, pageUrl])

  const showingJob = !!job?.preview_url

  /* ── 목록 ── */
  const loadServices = useCallback(async () => {
    try {
      const r = await aiEditorAPI.services()
      setServices(r.services); setAgents(r.agents); setPreview(r.preview ?? null)
      setPending(r.pending_deploy ?? null)
      setSvcKey(k => k || r.services[0]?.key || '')
    } catch (e: any) { setErr(e?.message ?? '불러오지 못했습니다') }
    finally { setLoading(false) }
  }, [])

  const loadJobs = useCallback(async () => {
    if (!svcKey) return
    try { setJobs(await aiEditorAPI.jobs({ service_key: svcKey, limit: 30 })) }
    catch { /* 목록은 실패해도 화면을 막지 않는다 */ }
  }, [svcKey])

  useEffect(() => { loadServices() }, [loadServices])
  useEffect(() => { loadJobs() }, [loadJobs])
  useEffect(() => {
    if (svc && !pageUrl) setPageUrl(svc.pages?.[0]?.path ?? '/')
  }, [svc, pageUrl])

  /* ── 상시 미리보기 ──
     작업을 걸지 않아도 화면이 보여야 한다. 그래야 '무엇을 고칠지' 를
     보면서 정한다. 서비스를 고르면 그걸 띄워달라고 부탁해 둔다. */
  const asked = useRef<string>('')
  const askPreview = useCallback(async (key: string) => {
    if (!key) return
    asked.current = key
    try { setPreview(await aiEditorAPI.requestPreview(key)) }
    catch { /* 에이전트가 꺼져 있을 수 있다 — 상태는 아래 폴링이 알려준다 */ }
  }, [])

  useEffect(() => {
    if (!svcKey || asked.current === svcKey) return
    askPreview(svcKey)
  }, [svcKey, askPreview])

  /* 준비되기 전에는 자주, 준비된 뒤에는 느슨하게 본다.
     설치가 5~10분 걸리는 동안 화면이 굳어 있으면 멈춘 줄 안다. */
  useEffect(() => {
    const ms = preview?.state === 'ready' ? 20000 : 4000
    const id = window.setInterval(() => { loadServices() }, ms)
    return () => window.clearInterval(id)
  }, [preview?.state, loadServices])

  /* ── 진행 중인 작업을 따라간다 ──
     길게 붙잡는 연결(SSE) 대신 짧게 물어본다. 작업이 몇 분씩 걸리고
     중간에 끊겨도 다시 물어보면 그만이라, 단순한 쪽이 덜 깨진다. */
  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current)
    if (!jobId) return
    const tick = async () => {
      try {
        const r = await aiEditorAPI.job(jobId)
        setJob(r.job); setEvents(r.events)
        if (['MERGED', 'DEPLOYED', 'FAILED', 'CANCELLED'].includes(r.job.status)) {
          if (timer.current) window.clearInterval(timer.current)
          loadJobs()
        }
      } catch { /* 잠깐 못 받아도 다음 차례에 다시 본다 */ }
    }
    tick()
    timer.current = window.setInterval(tick, 2500)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [jobId, loadJobs])

  /* ── 접수 ── */
  const submit = async (b: Body, analyze: boolean) => {
    if (!svc) return
    setBusy(true); setErr('')
    try {
      const j = await aiEditorAPI.create({
        service_key: svc.key, page_url: pageUrl || null,
        instruction: b.instruction, scope: b.scope, priority: b.priority,
        approve_mode: b.approve_mode, extra_notes: b.extra_notes,
        images: b.images, target, analyze_only: analyze,
      })
      setJobId(j.id); setJob(j); setEvents([])
      loadJobs()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '접수 실패') }
    finally { setBusy(false) }
  }

  /**
   * 운영 반영 — 기준 브랜치를 배포 브랜치로 올린다.
   *
   * 무엇이 함께 올라가는지 반드시 보여주고 묻는다. 이 버튼 하나로 어르신·직원이
   * 쓰는 화면이 바뀐다. 내 수정만 올라가는 게 아니라 그 브랜치의 모든 변경이
   * 함께 간다 — 그걸 모르고 누르면 안 된다.
   */
  const deployNow = async () => {
    if (!svc) return
    const list = (pending?.commits ?? [])
      .map(c => `  · ${c.subject}`).join('\n')
    const n = pending?.count ?? 0
    const head = pending?.known
      ? (n === 0
          ? '운영에 이미 최신입니다. 올릴 변경이 없습니다.'
          : `${svc.base_branch} 의 변경 ${n}건을 ${svc.deploy_branch} 로 올립니다.`)
      : `${svc.base_branch} 의 변경을 ${svc.deploy_branch} 로 올립니다.\n(대기 목록을 아직 못 받았습니다)`
    if (pending?.known && n === 0) { alert(head); return }
    if (!confirm(
      `${head}\n${list ? list + '\n' : ''}\n` +
      `올리면 배포가 시작되고, 어르신·직원이 쓰는 화면에 반영됩니다.\n` +
      `내 수정만이 아니라 위 변경이 모두 함께 올라갑니다.\n\n계속할까요?`)) return
    setBusy(true); setErr('')
    try {
      const j = await aiEditorAPI.deploy()
      setJobId(j.id); setJob(j); setEvents([])
      loadJobs()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '운영 반영 실패') }
    finally { setBusy(false) }
  }

  const act = async (fn: () => Promise<AiJob>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setBusy(true); setErr('')
    try { setJob(await fn()) }
    catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '실패') }
    finally { setBusy(false); loadJobs() }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-gray-300" />
    </div>
  )

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* 머리 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-wrap">
        <Wand2 size={18} className="text-indigo-600" />
        <h1 className="text-lg font-bold text-gray-900">AI 페이지 편집기</h1>
        <span className="text-[11px] text-gray-400">
          화면을 보며 말로 고칩니다 · 검증을 통과해야 배포로 갑니다
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg border ${
            online > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                       : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <Circle size={7} className={online > 0 ? 'fill-emerald-500 text-emerald-500' : 'fill-rose-500 text-rose-500'} />
            편집 에이전트 {online}대
          </span>
          {/* 운영 반영 — 기준 브랜치가 배포 브랜치와 다를 때만 의미가 있다.
              같으면 병합 즉시 배포되므로 이 버튼이 있을 이유가 없다. */}
          {svc?.deploy_branch && svc.deploy_branch !== svc.base_branch && (
            <button onClick={deployNow} disabled={busy || online === 0}
              title={pending?.known
                ? (pending.count === 0
                    ? '운영에 이미 최신입니다'
                    : `${svc.base_branch} → ${svc.deploy_branch} · ${pending.count}건이 올라갑니다`)
                : '반영 대기 목록을 아직 받지 못했습니다'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-40 ${
                pending?.known && pending.count > 0
                  ? 'bg-orange-600 border-orange-600 text-white hover:bg-orange-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <Rocket size={12} />
              운영에 반영
              {pending?.known && pending.count > 0 && (
                <span className="bg-white/25 rounded px-1">{pending.count}</span>
              )}
            </button>
          )}
          <button onClick={() => { loadServices(); loadJobs() }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {err && <p className="mx-4 mt-2 text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}

      {services.length === 0 ? (
        <Empty onSeed={async () => {
          setBusy(true); setErr('')
          try { await aiEditorAPI.seed(); await loadServices() }
          catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '등록 실패') }
          finally { setBusy(false) }
        }} busy={busy} />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_340px] gap-0 divide-x divide-gray-100">
          {/* ── 왼쪽 ── */}
          <div className="min-h-0 overflow-y-auto p-3 space-y-3">
            <div>
              <p className="text-[11px] font-bold text-gray-500 mb-1">서비스</p>
              <select value={svcKey} onChange={e => { setSvcKey(e.target.value); setPageUrl(''); setTarget(null) }}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                {services.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
              {svc && (
                <div className="mt-1.5 space-y-0.5 text-[10px] text-gray-400">
                  <p className="flex items-center gap-1 truncate">
                    <Server size={9} /> {svc.repo}
                  </p>
                  <p className="flex items-center gap-1 truncate">
                    <GitBranch size={9} /> {svc.base_branch}
                  </p>
                  <p className="flex items-center gap-1 truncate">
                    <FileCode2 size={9} /> {svc.root_path}
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[11px] font-bold text-gray-500">화면</p>
                <PreviewBadge preview={preview} />
              </div>
              {/* 셀렉트가 아니라 목록이다 — 누르면 곧바로 오른쪽 미리보기가
                  그 화면으로 간다. 한 번에 하나씩 눌러보며 고를 것을 정한다. */}
              <div className="space-y-0.5">
                {(svc?.pages ?? []).map(p => {
                  const on = p.path === pageUrl
                  return (
                    <button key={p.path}
                      onClick={() => { setPageUrl(p.path); setTarget(null) }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg border transition-colors ${
                        on ? 'border-indigo-400 bg-indigo-50' : 'border-transparent hover:bg-gray-50'}`}>
                      <span className={`block text-[11.5px] font-semibold truncate ${
                        on ? 'text-indigo-800' : 'text-gray-700'}`}>
                        {p.label || p.path}
                      </span>
                      <span className="block text-[9.5px] font-mono text-gray-400 truncate">{p.path}</span>
                    </button>
                  )
                })}
                {(svc?.pages ?? []).length === 0 && (
                  <p className="text-[10.5px] text-gray-400 py-3 text-center">등록된 화면이 없습니다.</p>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                레지스트리에 등록된 화면만 고를 수 있습니다.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[11px] font-bold text-gray-500">작업</p>
                <span className="text-[10px] text-gray-400">{jobs.length}건</span>
              </div>
              <div className="space-y-1">
                {jobs.length === 0 && (
                  <p className="text-[10.5px] text-gray-400 py-3 text-center">아직 작업이 없습니다.</p>
                )}
                {jobs.map(j => {
                  const m = JOB_STATUS_META[j.status]
                  const on = j.id === jobId
                  return (
                    <button key={j.id}
                      title={on ? '한 번 더 누르면 기준 화면으로 돌아갑니다' : undefined}
                      onClick={() => {
                        if (on) {
                          // 같은 것을 다시 누르면 선택을 푼다 — 그래야 작업 결과가
                          // 아니라 아무것도 안 고친 기준 화면을 다시 볼 수 있다.
                          setJobId(null); setJob(null); setEvents([])
                          return
                        }
                        setJobId(j.id); setJob(j)
                        if (j.page_url) setPageUrl(j.page_url)
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg border transition-colors ${
                        on ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
                        <span className="text-[11px] font-semibold text-gray-800 truncate flex-1">{j.title}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${m.cls}`}>{m.label}</span>
                        <span className="text-[9.5px] text-gray-400 truncate">
                          {j.page_url} · {(j.created_at || '').slice(5, 16).replace('T', ' ')}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── 가운데 ── */}
          <div className="min-h-0">
            <PreviewPane
              url={previewUrl}
              beforeUrl={null}
              pageUrl={pageUrl}
              preview={preview}
              isJob={showingJob}
              onRetry={() => askPreview(svcKey)}
              picking={picking}
              setPicking={setPicking}
              onPick={t => setTarget(t)}
              onNavigate={p2 => setPageUrl(p2)}
            />
          </div>

          {/* ── 오른쪽 ── */}
          <div className="min-h-0">
            <CommandPane
              baseBranch={svc?.base_branch}
              target={target}
              job={job}
              events={events}
              busy={busy}
              canRun={online > 0 && !!svc}
              onRun={b => submit(b, false)}
              onAnalyze={b => submit(b, true)}
              onCancel={() => jobId && act(() => aiEditorAPI.cancel(jobId),
                '작업을 중지합니다.\n지금 하던 단계를 마치고 멈춥니다.')}
              onDeploy={() => {
                if (!jobId || !job) return
                const files = (job.files ?? []).map(f => `  · ${f.path}`).join('\n')
                if (!confirm(
                  `이 수정을 운영에 배포합니다.\n\n` +
                  `${job.title}\n${files ? files + '\n' : ''}\n` +
                  `${svc?.base_branch} 에 병합한 뒤 ${svc?.deploy_branch} 로 올립니다.\n` +
                  `배포가 끝나면 어르신·직원이 쓰는 화면에 반영됩니다.\n\n` +
                  `※ ${svc?.base_branch} 에 아직 안 올라간 다른 변경이 있으면 함께 갑니다.\n\n` +
                  `계속할까요?`)) return
                act(() => aiEditorAPI.approve(jobId, true, true))
              }}
              onApprove={merge => jobId && act(() => aiEditorAPI.approve(jobId, merge),
                merge ? mergeConfirmText(svc?.base_branch)
                      : 'PR 을 만듭니다. 병합은 GitHub 에서 직접 하시면 됩니다.')}
              onRevise={t => jobId && act(() => aiEditorAPI.revise(jobId, t))}
              onRollback={() => jobId && act(() => aiEditorAPI.rollback(jobId),
                '이 변경을 되돌리는 PR 을 만듭니다.\n이미 나간 커밋은 지우지 않습니다.')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** 미리보기가 지금 어떤 상태인지 — 화면 목록 옆에 작게 붙는다 */
function PreviewBadge({ preview }: { preview: PreviewInfo | null }) {
  const state = preview?.state ?? 'off'
  const meta = PREVIEW_META[state]
  const cls =
    state === 'ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : state === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200'
        : state === 'off' ? 'bg-gray-100 text-gray-400 border-gray-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
  return (
    <span title={preview?.msg || meta.hint || '미리보기 준비됨'}
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {meta.label}
    </span>
  )
}

function Empty({ onSeed, busy }: { onSeed: () => void; busy: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <Wand2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-700">편집할 서비스가 등록되지 않았습니다</p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          아무 저장소나 건드리지 못하도록, 레지스트리에 올린 것만 편집할 수 있습니다.
          <br />이 저장소의 관리자 화면을 기본값으로 등록해 시작하세요.
        </p>
        <button onClick={onSeed} disabled={busy}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          관리자 화면 등록
        </button>
        <p className="text-[10.5px] text-gray-400 mt-3 leading-relaxed">
          등록 뒤에는 편집 에이전트를 켜야 실제로 작업이 돕니다.<br />
          <span className="font-mono">apps/ai-editor-agent/README.md</span> 를 보세요.
        </p>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Wand2, Server, GitBranch, FileCode2, Loader2, RefreshCw, Circle,
} from 'lucide-react'
import {
  aiEditorAPI, JOB_STATUS_META,
  type AiService, type AiAgent, type AiJob, type JobEvent, type PickedTarget,
} from '@/api/aiEditorClient'
import PreviewPane from '@/components/aiEditor/PreviewPane'
import CommandPane, { type Body } from '@/components/aiEditor/CommandPane'

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

  /* ── 목록 ── */
  const loadServices = useCallback(async () => {
    try {
      const r = await aiEditorAPI.services()
      setServices(r.services); setAgents(r.agents)
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
              <p className="text-[11px] font-bold text-gray-500 mb-1">화면</p>
              <select value={pageUrl} onChange={e => { setPageUrl(e.target.value); setTarget(null) }}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                {(svc?.pages ?? []).map(p => (
                  <option key={p.path} value={p.path}>{p.label || p.path}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
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
                    <button key={j.id} onClick={() => { setJobId(j.id); setJob(j) }}
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
              url={job?.preview_url ?? null}
              beforeUrl={null}
              pageUrl={job?.page_url ?? pageUrl}
              picking={picking}
              setPicking={setPicking}
              onPick={t => setTarget(t)}
              onNavigate={p2 => setPageUrl(p2)}
            />
          </div>

          {/* ── 오른쪽 ── */}
          <div className="min-h-0">
            <CommandPane
              target={target}
              job={job}
              events={events}
              busy={busy}
              canRun={online > 0 && !!svc}
              onRun={b => submit(b, false)}
              onAnalyze={b => submit(b, true)}
              onCancel={() => jobId && act(() => aiEditorAPI.cancel(jobId),
                '작업을 중지합니다.\n지금 하던 단계를 마치고 멈춥니다.')}
              onApprove={merge => jobId && act(() => aiEditorAPI.approve(jobId, merge),
                merge ? '승인하고 병합합니다.\n병합되면 GitHub Actions 가 운영에 배포합니다.\n계속할까요?'
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

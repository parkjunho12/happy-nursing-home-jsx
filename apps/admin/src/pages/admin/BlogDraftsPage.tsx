import { useEffect, useMemo, useState } from 'react'
import {
  PenLine, Copy, Check, Loader2, RefreshCw, AlertTriangle, Image as ImageIcon,
  CalendarClock, ShieldCheck, ShieldX, Eye, Info, CircleDollarSign, Send, ExternalLink,
  XCircle, Radio, Pencil, X, Link2,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { blogDraftAPI, type Block, type BlogDraft, type BlogPhoto, type PublisherInfo, type DraftStatus } from '@/api/blogDraftClient'

/**
 * 블로그 자동 초안 — 화·금 오전 10시에 한 편씩 만들어 두고, 검토가 끝나면 발행한다.
 *
 * ■ 발행은 Aside 가 한다
 *
 *   네이버는 공식 글쓰기 API 가 없다. 그래서 사람이 네이버에 로그인해 둔
 *   Aside 브라우저(Mac)에서 브라우저 에이전트가 글쓰기 화면에 제목·본문·사진을
 *   넣고 발행한다. 여기서 「네이버에 발행」을 누르면 발행 줄에 서고, Mac 의
 *   발행기가 가져가 올린 뒤 글 주소를 돌려준다. 발행기가 꺼져 있으면 켜질
 *   때까지 줄에 서 있는다.
 *
 *   검토 없이 나가는 글은 없다. 「검토 완료」 → 「네이버에 발행」 두 번을 눌러야
 *   한다 — 공개로 나가는 사진은 되돌릴 수 없다.
 *
 * ■ 사진 확인이 먼저다
 *
 *   얼굴을 가렸다고 해서 공개 홍보에 써도 되는 것은 아니다. 보호자 앨범을
 *   보시라고 받은 동의는 블로그에 올려도 좋다는 뜻이 아니다. 그래서 사람이
 *   한 장씩 '공개 사용 확인' 을 눌러야 자동 생성 후보가 된다. 확인된 사진이
 *   없으면 예약이 돌아도 글이 만들어지지 않고, 그 사유가 보류로 남는다.
 */

const DUP_TONE: Record<string, { t: string; c: string }> = {
  pass:       { t: '중복 없음',        c: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review:     { t: '겹칩니다 — 확인',  c: 'bg-orange-50 text-orange-700 border-orange-200' },
  incomplete: { t: '기존 글 미확보',   c: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const STATUS_TONE: Record<DraftStatus, { t: string; c: string }> = {
  draft:          { t: '검토 대기', c: 'bg-orange-50 text-orange-700 border-orange-200' },
  approved:       { t: '검토 완료', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  held:           { t: '보류',      c: 'bg-gray-100 text-gray-500 border-gray-200' },
  queued:         { t: '발행 대기', c: 'bg-violet-50 text-violet-700 border-violet-200' },
  publishing:     { t: '발행 중',   c: 'bg-blue-50 text-blue-700 border-blue-200' },
  published:      { t: '발행됨',    c: 'bg-emerald-600 text-white border-emerald-600' },
  publish_failed: { t: '발행 실패', c: 'bg-rose-50 text-rose-700 border-rose-200' },
}

/** 발행기 신호가 이 시간 안이면 '살아 있다' 고 본다(발행기는 5분마다 신호를 보낸다) */
const ALIVE_MS = 15 * 60 * 1000

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 90) return '방금'
  if (s < 3600) return `${Math.round(s / 60)}분 전`
  if (s < 86400) return `${Math.round(s / 3600)}시간 전`
  return `${Math.round(s / 86400)}일 전`
}

export default function BlogDraftsPage() {
  // 대시보드의 '사진 공개 사용 확인' 을 누르면 바로 그 탭으로 온다
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<'drafts' | 'photos'>(sp.get('tab') === 'photos' ? 'photos' : 'drafts')
  const [drafts, setDrafts] = useState<BlogDraft[]>([])
  const [photos, setPhotos] = useState<BlogPhoto[]>([])
  const [pubs, setPubs] = useState<{ configured: boolean; publishers: PublisherInfo[] } | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // 수정 모드 — 제목·본문 블록·해시태그를 고쳐 저장한다. 사진 자리는 못 움직인다.
  const [editing, setEditing] = useState(false)
  const [eTitle, setETitle] = useState('')
  const [eBlocks, setEBlocks] = useState<Block[]>([])
  const [eTags, setETags] = useState('')
  // 발행 실패인데 네이버에는 이미 올라가 있을 때 — 글 주소를 이력으로 등록한다
  const [histOpen, setHistOpen] = useState(false)
  const [histUrl, setHistUrl] = useState('')

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [d, p, pb] = await Promise.all([
        blogDraftAPI.list().catch(() => [] as BlogDraft[]),
        blogDraftAPI.photos().catch(() => [] as BlogPhoto[]),
        blogDraftAPI.publishers().catch(() => null),
      ])
      setDrafts(d); setPhotos(p); setPubs(pb)
      setSel(s => s && d.some(x => x.id === s) ? s : (d.find(x => x.status !== 'held')?.id ?? null))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // 발행 중인 글이 있으면 결과가 오는지 1분마다 본다
  const inFlight = drafts.some(d => d.status === 'queued' || d.status === 'publishing')
  useEffect(() => {
    if (!inFlight) return
    const t = setInterval(() => { load(true) }, 60_000)
    return () => clearInterval(t)
  }, [inFlight])

  const cur = useMemo(() => drafts.find(d => d.id === sel) ?? null, [drafts, sel])
  const unconfirmed = photos.filter(p => p.mask_status === 'masked' && p.publicity === 'unknown').length
  const ready = photos.filter(p => p.usable).length

  const alive = useMemo(() => {
    const p = pubs?.publishers?.[0]
    if (!p) return null
    return { ...p, alive: Date.now() - new Date(p.at).getTime() < ALIVE_MS }
  }, [pubs])

  const replace = (r: BlogDraft) => setDrafts(ds => ds.map(x => x.id === r.id ? r : x))
  const fail = (e: any, fallback: string) => alert(e?.response?.data?.detail ?? fallback)

  // 다른 초안으로 옮기면 고치던 것을 접는다 — 열어 둔 채 옮기면 엉뚱한 글에 저장된다
  useEffect(() => { setEditing(false); setHistOpen(false); setHistUrl('') }, [sel])

  const startEdit = (d: BlogDraft) => {
    setETitle(d.title ?? '')
    setEBlocks(d.blocks.map(b => ({ ...b })))
    setETags(d.hashtags.join(' '))
    setEditing(true)
  }

  const saveEdit = async (d: BlogDraft) => {
    if (!eTitle.trim()) return alert('제목을 적어 주세요.')
    if (eBlocks.some(b => b.type !== 'photo' && !(b.text ?? '').trim()))
      return alert('빈 문단이 있습니다. 지울 문단이면 앞뒤 문단에 합쳐 주세요.')
    const tags = eTags.split(/[\s,]+/).map(t => t.replace(/^#/, '')).filter(Boolean)
    setBusy(d.id)
    try {
      replace(await blogDraftAPI.edit(d.id, { title: eTitle.trim(), blocks: eBlocks, hashtags: tags }))
      setEditing(false)
    } catch (e: any) { fail(e, '저장하지 못했습니다.') }
    finally { setBusy(null) }
  }

  /** 제목 후보를 누르면 그 제목으로 바꾼다 */
  const pickTitle = async (d: BlogDraft, t: string) => {
    setBusy(d.id)
    try { replace(await blogDraftAPI.edit(d.id, { title: t })) }
    catch (e: any) { fail(e, '제목을 바꾸지 못했습니다.') }
    finally { setBusy(null) }
  }

  /** 발행 실패인데 네이버에는 올라가 있는 글 — 주소를 이력에 등록하고 보류로 접는다.
   *  이력에 넣어야 다음 초안의 중복 검사가 이 글을 안다. */
  const registerHistory = async (d: BlogDraft) => {
    const url = histUrl.trim()
    if (!url) return alert('네이버 글 주소를 붙여넣어 주세요.')
    const m = url.match(/logNo=(\d+)/) ?? url.match(/\/(\d{8,})(?:[/?#]|$)/)
    if (!m) return alert('주소에서 글 번호를 찾지 못했습니다.\nblog.naver.com/아이디/글번호 형태의 주소를 넣어 주세요.')
    setBusy(d.id)
    try {
      await blogDraftAPI.addHistory({
        log_no: m[1], url, title: d.title ?? undefined,
        body: `${d.body}\n\n${d.facility}`,
        published_on: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
        topic: d.topic ?? undefined,
      })
      replace(await blogDraftAPI.setStatus(d.id, 'held',
        `이미 네이버에 올라가 있어 발행 이력으로 등록했습니다. (${url})`))
      setHistOpen(false); setHistUrl('')
    } catch (e: any) { fail(e, '이력을 등록하지 못했습니다.') }
    finally { setBusy(null) }
  }

  const generate = async () => {
    setBusy('gen'); setMsg(null)
    try {
      const r = await blogDraftAPI.generate()
      if (!r.created) { setMsg(r.reason ?? '만들 자료가 모자랍니다.') }
      else { setMsg(null); await load(); setSel(r.draft!.id) }
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? '초안을 만들지 못했습니다.')
    } finally { setBusy(null) }
  }

  const setStatus = async (d: BlogDraft, status: 'approved' | 'draft') => {
    setBusy(d.id)
    try { replace(await blogDraftAPI.setStatus(d.id, status)) }
    catch (e: any) { fail(e, '저장하지 못했습니다.') }
    finally { setBusy(null) }
  }

  const publish = async (d: BlogDraft) => {
    const n = d.blocks.filter(b => b.type === 'photo').length
    const retry = d.status === 'publish_failed'
    const ok = confirm(
      (retry ? '네이버에 이 글이 올라가 있지 않은 것을 확인하셨나요?\n\n' : '') +
      `「${d.title}」 을(를) 네이버 블로그에 발행합니다.\n사진 ${n}장 · 전체공개\n\n` +
      '발행된 글은 되돌릴 수 없습니다. 진행할까요?')
    if (!ok) return
    setBusy(d.id)
    try { replace(await blogDraftAPI.publish(d.id)) }
    catch (e: any) { fail(e, '발행 요청을 넣지 못했습니다.') }
    finally { setBusy(null) }
  }

  const cancelPublish = async (d: BlogDraft) => {
    setBusy(d.id)
    try { replace(await blogDraftAPI.cancelPublish(d.id)) }
    catch (e: any) { fail(e, '취소하지 못했습니다.') }
    finally { setBusy(null) }
  }

  /** 본문 + 시설 안내를 한 번에 — 발행기가 없을 때 직접 붙여넣는 길 */
  const copyBody = async (d: BlogDraft) => {
    const text = `${d.title ?? ''}\n\n${d.body}\n\n${d.facility}`.trim()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('복사가 막혀 있습니다. 본문을 직접 선택해 복사해 주세요.')
    }
  }

  const setPhoto = async (p: BlogPhoto, b: Parameters<typeof blogDraftAPI.setPhoto>[1]) => {
    setBusy(p.id)
    try {
      const r = await blogDraftAPI.setPhoto(p.id, b)
      setPhotos(ps => ps.map(x => x.id === p.id ? r : x))
    } catch (e: any) { fail(e, '저장하지 못했습니다.') }
    finally { setBusy(null) }
  }

  const locked = (d: BlogDraft) => d.status === 'queued' || d.status === 'publishing' || d.status === 'published'

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* 머리 */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine size={20} className="text-violet-600" /> 블로그 자동 초안
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <CalendarClock size={12} />
            화요일·금요일 오전 10시에 한 편씩 자동으로 만들어 둡니다 · 검토 후 「네이버에 발행」을 누르면 Aside 가 올립니다
          </p>
          {/* 발행기 상태 */}
          <p className="text-[11px] mt-1 flex items-center gap-1.5">
            <Radio size={11} className={alive?.alive ? 'text-emerald-500' : 'text-gray-300'} />
            {pubs && !pubs.configured ? (
              <span className="text-rose-600">서버에 발행기 토큰이 없습니다 — 발행할 수 없습니다 (BLOG_PUBLISHER_TOKEN)</span>
            ) : alive?.alive ? (
              <span className="text-emerald-700">
                발행기 연결됨 · {alive.worker}{alive.naver_blog_id ? ` · blog.naver.com/${alive.naver_blog_id}` : ''} · {ago(alive.at)} 확인
              </span>
            ) : alive ? (
              <span className="text-orange-600">발행기 신호 끊김 · {alive.worker} · 마지막 {ago(alive.at)} — 발행을 눌러도 켜질 때까지 기다립니다</span>
            ) : (
              <span className="text-gray-400">발행기가 아직 연결되지 않았습니다 — Mac 에서 apps/blog-publisher 를 켜고 네이버에 로그인해 두세요</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} disabled={loading}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
          <button onClick={generate} disabled={busy === 'gen'}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
            {busy === 'gen' ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
            지금 한 편 만들기
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">아직 만들 수 없습니다</p>
            <p className="mt-0.5">{msg}</p>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([['drafts', `초안 ${drafts.filter(d => d.status === 'draft').length}`],
           ['photos', `사진 확인 ${unconfirmed > 0 ? unconfirmed : ''}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              tab === k ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-gray-400 pb-2">
          쓸 수 있는 사진 {ready}장 · 확인 대기 {unconfirmed}장
        </span>
      </div>

      {tab === 'drafts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* 목록 */}
          <div className="space-y-2">
            {drafts.length === 0 && !loading && (
              <p className="text-sm text-gray-400 px-1">아직 만들어진 초안이 없습니다.</p>
            )}
            {drafts.map(d => (
              <button key={d.id} onClick={() => setSel(d.id)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 ${
                  sel === d.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_TONE[d.status]?.c ?? STATUS_TONE.held.c}`}>
                    {STATUS_TONE[d.status]?.t ?? d.status}
                  </span>
                  <span className="text-[10px] text-gray-400">{(d.created_at ?? '').slice(0, 10)}</span>
                  {d.created_by && <span className="text-[10px] text-gray-400">· {d.created_by}</span>}
                </div>
                <p className="text-sm font-bold text-gray-800 line-clamp-2">
                  {d.title ?? (d.hold_reason ? '만들지 못했습니다' : '제목 없음')}
                </p>
                {d.hold_reason && <p className="text-[11px] text-gray-500 mt-1 line-clamp-3">{d.hold_reason}</p>}
                {d.status === 'publish_failed' && d.publish_error && (
                  <p className="text-[11px] text-rose-600 mt-1 line-clamp-3">{d.publish_error}</p>
                )}
                {d.activity_dates.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {d.activity_dates[0]} ~ {d.activity_dates[d.activity_dates.length - 1]} · 사진 {d.blocks.filter(b => b.type === 'photo').length}장
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* 본문 */}
          {cur ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
              {cur.status === 'held' ? (
                <div className="text-sm text-gray-600">
                  <p className="font-bold text-gray-800 mb-1">이 회차는 만들지 못했습니다</p>
                  <p>{cur.hold_reason}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    사유를 해결하시면 (사진 공개 사용 확인 등) 다음 점검 때 같은 회차가 이어서 만들어집니다.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <input value={eTitle} onChange={e => setETitle(e.target.value)}
                          className="w-full text-lg font-bold text-gray-900 rounded-xl border border-violet-300 px-3 py-2 focus:outline-none focus:border-violet-500"
                          placeholder="제목" />
                      ) : (
                        <h2 className="text-lg font-bold text-gray-900">{cur.title}</h2>
                      )}
                      {cur.title_alts.length > 0 && !locked(cur) && !editing && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[11px] text-gray-400">다른 제목 후보 — 누르면 바뀝니다 ·</span>
                          {cur.title_alts.map((t, i) => (
                            <button key={i} onClick={() => pickTitle(cur, t)} disabled={busy === cur.id}
                              className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 disabled:opacity-40">
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {editing ? (
                        <>
                          <button onClick={() => setEditing(false)} disabled={busy === cur.id}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 flex items-center gap-1.5">
                            <X size={14} /> 취소
                          </button>
                          <button onClick={() => saveEdit(cur)} disabled={busy === cur.id}
                            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                            {busy === cur.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            저장
                          </button>
                        </>
                      ) : (
                      <>
                      <button onClick={() => copyBody(cur)}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm flex items-center gap-1.5 hover:bg-gray-50">
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '본문 복사'}
                      </button>
                      {!locked(cur) && (
                        <button onClick={() => startEdit(cur)} disabled={busy === cur.id}
                          className="px-3 py-2 rounded-xl border border-violet-200 text-violet-700 text-sm font-bold hover:bg-violet-50 flex items-center gap-1.5">
                          <Pencil size={14} /> 수정
                        </button>
                      )}

                      {cur.status === 'draft' && (
                        <button onClick={() => setStatus(cur, 'approved')} disabled={busy === cur.id}
                          className="px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-bold hover:bg-emerald-50">
                          검토 완료
                        </button>
                      )}
                      {cur.status === 'approved' && (
                        <>
                          <button onClick={() => setStatus(cur, 'draft')} disabled={busy === cur.id}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
                            되돌리기
                          </button>
                          <button onClick={() => publish(cur)} disabled={busy === cur.id}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                            {busy === cur.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            네이버에 발행
                          </button>
                        </>
                      )}
                      {cur.status === 'queued' && (
                        <button onClick={() => cancelPublish(cur)} disabled={busy === cur.id}
                          className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50 flex items-center gap-1.5">
                          <XCircle size={14} /> 발행 취소
                        </button>
                      )}
                      {cur.status === 'publishing' && (
                        <span className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold flex items-center gap-1.5">
                          <Loader2 size={14} className="animate-spin" /> Aside 가 올리는 중{cur.publish_worker ? ` · ${cur.publish_worker}` : ''}
                        </span>
                      )}
                      {cur.status === 'published' && cur.published_url && (
                        <a href={cur.published_url} target="_blank" rel="noreferrer"
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-emerald-700">
                          <ExternalLink size={14} /> 네이버에서 보기
                        </a>
                      )}
                      {cur.status === 'publish_failed' && (
                        <button onClick={() => publish(cur)} disabled={busy === cur.id}
                          className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5">
                          <Send size={14} /> 다시 발행
                        </button>
                      )}
                      </>
                      )}
                    </div>
                  </div>

                  {/* 승인된 글을 고치면 검토가 무효가 된다 — 저장 전에 알린다 */}
                  {editing && cur.status === 'approved' && (
                    <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-800">
                      저장하면 「검토 대기」로 되돌아갑니다 — 승인된 것과 다른 글이 나가면 승인이 의미가 없기 때문입니다.
                    </div>
                  )}

                  {/* 발행 상태 안내 */}
                  {cur.status === 'queued' && (
                    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-800">
                      발행 줄에 섰습니다 · {cur.publish_requested_by} · {(cur.publish_requested_at ?? '').slice(0, 16).replace('T', ' ')}
                      {alive?.alive ? ' — 발행기가 곧 가져갑니다.' : ' — 발행기가 켜지면 가져갑니다.'}
                    </div>
                  )}
                  {cur.status === 'published' && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                      {(cur.published_at ?? '').slice(0, 16).replace('T', ' ')} 발행 · 글 번호 {cur.published_log_no}
                      {cur.published_verified
                        ? ' · 발행기가 글 페이지를 열어 제목을 확인했습니다'
                        : ' · 발행기가 글 페이지를 확인하지 못했습니다 — 한 번 열어 봐 주세요'}
                      {cur.publish_error && <p className="mt-1 text-emerald-700/80">{cur.publish_error}</p>}
                    </div>
                  )}
                  {cur.status === 'publish_failed' && (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                      <p className="font-bold flex items-center gap-1"><AlertTriangle size={12} />발행하지 못했습니다 ({cur.publish_attempts}회 시도)</p>
                      <p className="mt-1 whitespace-pre-wrap">{cur.publish_error}</p>
                      <p className="mt-1 text-rose-700/80">
                        네이버 블로그에 이 글이 올라가 있지 않은지 먼저 확인한 뒤 「다시 발행」을 누르세요.
                        이미 올라가 있다면 아래에 글 주소를 등록해 주세요 — 다음 초안의 중복 검사가 이 글을 알게 됩니다.
                      </p>
                      {histOpen ? (
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          <input value={histUrl} onChange={e => setHistUrl(e.target.value)}
                            placeholder="https://blog.naver.com/아이디/글번호"
                            className="flex-1 min-w-[240px] px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white text-[12px] text-gray-800 focus:outline-none focus:border-rose-400" />
                          <button onClick={() => registerHistory(cur)} disabled={busy === cur.id}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[12px] font-bold hover:bg-rose-700 disabled:opacity-50">
                            {busy === cur.id ? '등록 중…' : '이력으로 등록'}
                          </button>
                          <button onClick={() => { setHistOpen(false); setHistUrl('') }}
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-[12px] hover:bg-rose-100">
                            닫기
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setHistOpen(true)}
                          className="mt-2 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-[12px] font-bold hover:bg-rose-100 flex items-center gap-1">
                          <Link2 size={12} /> 이미 올라가 있습니다 — 글 주소 등록
                        </button>
                      )}
                    </div>
                  )}

                  {/* 검사 결과 */}
                  <div className="flex flex-wrap gap-1.5 mb-4 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full border font-bold ${DUP_TONE[cur.dup_status]?.c ?? DUP_TONE.incomplete.c}`}>
                      {DUP_TONE[cur.dup_status]?.t ?? cur.dup_status}
                    </span>
                    {cur.topic && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{cur.topic}</span>}
                    {cur.cost_usd != null && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 flex items-center gap-1">
                        <CircleDollarSign size={10} />${cur.cost_usd.toFixed(3)} · {cur.model}
                      </span>
                    )}
                  </div>

                  {cur.dup_status !== 'pass' && !locked(cur) && (
                    <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-800">
                      <p className="font-bold flex items-center gap-1"><Info size={12} />발행 전에 봐 주세요</p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans">{
                        (cur.dup_report?.reasons ?? []).join('\n') || '기존 발행 글을 다 확보하지 못해 중복을 장담할 수 없습니다.'
                      }</pre>
                    </div>
                  )}

                  {/* 올라갈 본문 그대로 · 수정 모드에서는 문단별로 고친다 */}
                  {editing ? (
                    <div className="space-y-2">
                      {eBlocks.map((b, i) => b.type === 'photo' ? (
                        <div key={i} className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-[12px] text-gray-500 flex items-center gap-1.5">
                          <ImageIcon size={12} />
                          [사진 {eBlocks.slice(0, i + 1).filter(x => x.type === 'photo').length}] — 사진 자리는 그대로 둡니다
                        </div>
                      ) : (
                        <textarea key={i} value={b.text ?? ''}
                          onChange={ev => setEBlocks(bs => bs.map((x, j) => j === i ? { ...x, text: ev.target.value } : x))}
                          rows={Math.max(2, Math.ceil((b.text ?? '').length / 55) + 1)}
                          className="w-full rounded-lg border border-violet-200 bg-white p-3 text-[13px] leading-6 font-sans resize-y focus:outline-none focus:border-violet-400" />
                      ))}
                      <div className="mt-1">
                        <p className="text-[11px] font-bold text-gray-500 mb-1">해시태그 — 띄어쓰기로 구분합니다 (# 은 붙여도 되고 안 붙여도 됩니다)</p>
                        <input value={eTags} onChange={e => setETags(e.target.value)}
                          placeholder="예) 요양원일상 어르신프로그램"
                          className="w-full px-3 py-2 rounded-lg border border-violet-200 text-[13px] focus:outline-none focus:border-violet-400" />
                      </div>
                      <p className="text-[11px] text-gray-400">
                        글 끝의 시설 안내는 발행할 때 자동으로 붙습니다 — 여기서 고칠 필요가 없습니다.
                      </p>
                    </div>
                  ) : (
                    <textarea readOnly value={`${cur.body}\n\n${cur.facility}`}
                      rows={26}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-[13px] leading-7 font-sans resize-y" />
                  )}

                  {!editing && cur.hashtags.length > 0 && (
                    <p className="mt-2 text-[12px] text-violet-600">{cur.hashtags.map(h => `#${h}`).join(' ')}</p>
                  )}
                  {cur.source_note && (
                    <details className="mt-3">
                      <summary className="text-[11px] text-gray-400 cursor-pointer">무엇을 근거로 썼는지</summary>
                      <pre className="mt-1 text-[11px] text-gray-500 whitespace-pre-wrap font-sans">{cur.source_note}</pre>
                    </details>
                  )}
                  <p className="mt-3 text-[11px] text-gray-400">
                    [사진 1] [사진 2] 자리에는 얼굴을 가린 사진이 순서대로 들어갑니다 — 발행기가 올릴 때도, 직접 붙여넣을 때도 같습니다.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
              왼쪽에서 초안을 고르세요.
            </div>
          )}
        </div>
      ) : (
        /* ── 사진 확인 ─────────────────────────────────────────────── */
        <div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[12px] text-blue-900 mb-4">
            <p className="font-bold flex items-center gap-1.5"><Info size={13} />공개 사용은 사람이 정합니다</p>
            <p className="mt-1">
              얼굴을 가렸더라도 그것만으로 블로그에 올려도 된다고 보지 않습니다. 보호자 앨범을 보시라고 받은
              동의는 공개 홍보 동의가 아닙니다. 한 장씩 보시고 「공개 사용 가능」을 눌러 주신 사진만 자동 생성에 쓰입니다.
              프로그램 관리 사진과 보호자 앨범 사진이 함께 옵니다.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {photos.length === 0 && !loading && (
              <p className="text-sm text-gray-400 col-span-full">
                아직 처리된 사진이 없습니다. 「지금 한 편 만들기」를 누르면 최근 프로그램·앨범 사진의 얼굴을 가려 여기에 모읍니다.
              </p>
            )}
            {photos.map(p => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
                  {p.mask_url
                    ? <img src={p.mask_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <ImageIcon size={24} className="text-gray-300" />}
                  <span className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    p.source === 'album' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700'}`}>
                    {p.source === 'album' ? '보호자 앨범' : '프로그램'}
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-bold text-gray-700 truncate">{p.program_title ?? '프로그램 미지정'}</p>
                  <p className="text-[10px] text-gray-400">
                    {p.taken_on} · 얼굴 {p.faces}곳 가림
                    {p.quality != null && (
                      <span className={p.quality >= 60 ? 'text-emerald-600' : p.quality >= 35 ? 'text-gray-400' : 'text-orange-500'}>
                        {' '}· 점수 {Math.round(p.quality)}
                      </span>
                    )}
                  </p>
                  {p.mask_status !== 'masked' && (
                    <p className="text-[10px] text-orange-600 mt-0.5">
                      {p.mask_status === 'no_face' ? '얼굴을 찾지 못했습니다' : (p.mask_reason ?? '가리지 못했습니다')}
                    </p>
                  )}

                  <div className="flex gap-1 mt-2">
                    <button onClick={() => setPhoto(p, { publicity: p.publicity === 'allowed' ? 'unknown' : 'allowed' })}
                      disabled={busy === p.id || p.mask_status !== 'masked'}
                      className={`flex-1 text-[10px] font-bold py-1 rounded-lg border flex items-center justify-center gap-0.5 disabled:opacity-40 ${
                        p.publicity === 'allowed'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      <ShieldCheck size={10} />공개 가능
                    </button>
                    <button onClick={() => setPhoto(p, { publicity: p.publicity === 'denied' ? 'unknown' : 'denied' })}
                      disabled={busy === p.id}
                      className={`px-2 text-[10px] font-bold py-1 rounded-lg border ${
                        p.publicity === 'denied'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      <ShieldX size={10} />
                    </button>
                  </div>
                  <button onClick={() => setPhoto(p, { reviewed: !p.reviewed_at })}
                    disabled={busy === p.id || p.mask_status !== 'masked'}
                    className={`w-full mt-1 text-[10px] font-bold py-1 rounded-lg border flex items-center justify-center gap-0.5 disabled:opacity-40 ${
                      p.reviewed_at
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Eye size={10} />{p.reviewed_at ? '가림 확인함' : '가림 눈으로 확인'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

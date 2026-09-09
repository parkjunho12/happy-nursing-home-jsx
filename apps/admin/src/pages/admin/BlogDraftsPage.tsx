import { useEffect, useMemo, useState } from 'react'
import {
  PenLine, Copy, Check, Loader2, RefreshCw, AlertTriangle, Image as ImageIcon,
  CalendarClock, ShieldCheck, ShieldX, Eye, Info, CircleDollarSign,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { blogDraftAPI, type BlogDraft, type BlogPhoto } from '@/api/blogDraftClient'

/**
 * 블로그 자동 초안 — 화·금 오전 10시에 한 편씩 만들어 두는 자리.
 *
 * ■ 여기서 끝난다
 *
 *   네이버는 공식 글쓰기 API 가 없다. 그래서 발행은 사람이 한다 — 본문을
 *   복사해 네이버 글쓰기에 붙여넣고, 사진은 순서대로 올린다. 이 페이지는
 *   그 붙여넣기 직전까지를 준비해 둔다.
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

export default function BlogDraftsPage() {
  // 대시보드의 '사진 공개 사용 확인' 을 누르면 바로 그 탭으로 온다
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<'drafts' | 'photos'>(sp.get('tab') === 'photos' ? 'photos' : 'drafts')
  const [drafts, setDrafts] = useState<BlogDraft[]>([])
  const [photos, setPhotos] = useState<BlogPhoto[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, p] = await Promise.all([
        blogDraftAPI.list().catch(() => [] as BlogDraft[]),
        blogDraftAPI.photos().catch(() => [] as BlogPhoto[]),
      ])
      setDrafts(d); setPhotos(p)
      setSel(s => s && d.some(x => x.id === s) ? s : (d.find(x => x.status !== 'held')?.id ?? null))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const cur = useMemo(() => drafts.find(d => d.id === sel) ?? null, [drafts, sel])
  const unconfirmed = photos.filter(p => p.mask_status === 'masked' && p.publicity === 'unknown').length
  const ready = photos.filter(p => p.usable).length

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
    try {
      const r = await blogDraftAPI.setStatus(d.id, status)
      setDrafts(ds => ds.map(x => x.id === d.id ? r : x))
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장하지 못했습니다.') }
    finally { setBusy(null) }
  }

  /** 본문 + 시설 안내를 한 번에 — 네이버 글쓰기에 그대로 붙여넣는다 */
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
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장하지 못했습니다.') }
    finally { setBusy(null) }
  }

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
            화요일·금요일 오전 10시에 한 편씩 자동으로 만들어 둡니다 · 발행은 직접 복사해 붙여넣습니다
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
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
                  {d.status === 'held' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">보류</span>
                  ) : d.status === 'approved' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">검토 완료</span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">검토 대기</span>
                  )}
                  <span className="text-[10px] text-gray-400">{(d.created_at ?? '').slice(0, 10)}</span>
                  {d.created_by && <span className="text-[10px] text-gray-400">· {d.created_by}</span>}
                </div>
                <p className="text-sm font-bold text-gray-800 line-clamp-2">
                  {d.title ?? (d.hold_reason ? '만들지 못했습니다' : '제목 없음')}
                </p>
                {d.hold_reason && <p className="text-[11px] text-gray-500 mt-1 line-clamp-3">{d.hold_reason}</p>}
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
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-gray-900">{cur.title}</h2>
                      {cur.title_alts.length > 0 && (
                        <p className="text-[11px] text-gray-400 mt-1">다른 제목 후보 · {cur.title_alts.join(' / ')}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => copyBody(cur)}
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold flex items-center gap-1.5">
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '본문 복사'}
                      </button>
                      {cur.status === 'draft' ? (
                        <button onClick={() => setStatus(cur, 'approved')} disabled={busy === cur.id}
                          className="px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-bold hover:bg-emerald-50">
                          검토 완료
                        </button>
                      ) : (
                        <button onClick={() => setStatus(cur, 'draft')} disabled={busy === cur.id}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
                          되돌리기
                        </button>
                      )}
                    </div>
                  </div>

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

                  {cur.dup_status !== 'pass' && (
                    <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-800">
                      <p className="font-bold flex items-center gap-1"><Info size={12} />붙여넣기 전에 봐 주세요</p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans">{
                        (cur.dup_report?.reasons ?? []).join('\n') || '기존 발행 글을 다 확보하지 못해 중복을 장담할 수 없습니다.'
                      }</pre>
                    </div>
                  )}

                  {/* 붙여넣을 본문 그대로 */}
                  <textarea readOnly value={`${cur.body}\n\n${cur.facility}`}
                    rows={26}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-[13px] leading-7 font-sans resize-y" />

                  {cur.hashtags.length > 0 && (
                    <p className="mt-2 text-[12px] text-violet-600">{cur.hashtags.map(h => `#${h}`).join(' ')}</p>
                  )}
                  {cur.source_note && (
                    <details className="mt-3">
                      <summary className="text-[11px] text-gray-400 cursor-pointer">무엇을 근거로 썼는지</summary>
                      <pre className="mt-1 text-[11px] text-gray-500 whitespace-pre-wrap font-sans">{cur.source_note}</pre>
                    </details>
                  )}
                  <p className="mt-3 text-[11px] text-gray-400">
                    사진은 본문의 [사진 1] [사진 2] 자리에 순서대로 올려 주세요 — 얼굴이 가려진 사진입니다.
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
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {photos.length === 0 && !loading && (
              <p className="text-sm text-gray-400 col-span-full">
                아직 처리된 사진이 없습니다. 「지금 한 편 만들기」를 누르면 최근 프로그램 사진의 얼굴을 가려 여기에 모읍니다.
              </p>
            )}
            {photos.map(p => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {p.mask_url
                    ? <img src={p.mask_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <ImageIcon size={24} className="text-gray-300" />}
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-bold text-gray-700 truncate">{p.program_title ?? '프로그램 미지정'}</p>
                  <p className="text-[10px] text-gray-400">{p.taken_on} · 얼굴 {p.faces}곳 가림</p>
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

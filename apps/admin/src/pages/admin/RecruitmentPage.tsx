import { useEffect, useMemo, useState } from 'react'
import {
  recruitmentAPI,
  type RecruitmentPost, type RecruitmentApplication,
  type AppStatus, type PostInput,
  type Interview, type IvStatus, type IvResult,
} from '@/api/recruitmentClient'

const APP_STATUSES: AppStatus[] = ['접수', '검토중', '면접예정', '합격', '불합격']
const appStatusStyle: Record<string, string> = {
  '접수': 'bg-gray-100 text-gray-600',
  '검토중': 'bg-blue-50 text-blue-700',
  '면접예정': 'bg-violet-50 text-violet-700',
  '합격': 'bg-green-50 text-green-700',
  '불합격': 'bg-red-50 text-red-600',
}
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-')
const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (s?: string | null) => { if (!s) return ''; const d = new Date(s); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
const hmOf = (s?: string | null) => { if (!s) return ''; const d = new Date(s); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const IV_STATUS: Record<IvStatus, { label: string; cls: string }> = {
  scheduled: { label: '예정', cls: 'bg-violet-50 text-violet-700' },
  done: { label: '면접완료', cls: 'bg-blue-50 text-blue-700' },
  canceled: { label: '취소', cls: 'bg-gray-100 text-gray-400' },
  no_show: { label: '노쇼', cls: 'bg-amber-50 text-amber-700' },
}
const IV_RESULT: Record<IvResult, { label: string; cls: string }> = {
  pass: { label: '합격', cls: 'bg-green-50 text-green-700' },
  fail: { label: '불합격', cls: 'bg-red-50 text-red-600' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-600' },
}
async function copyText(t: string) { try { await navigator.clipboard.writeText(t); alert('안내 문구가 복사되었습니다.') } catch { alert('복사에 실패했습니다. 길게 눌러 복사해 주세요.') } }

export default function RecruitmentPage() {
  const [view, setView] = useState<'posts' | 'apps' | 'interviews'>('posts')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">채용 관리</h1>
        <p className="text-sm text-gray-500 mt-1">채용 공고를 등록·관리하고, 홈페이지로 접수된 지원자를 확인합니다.</p>
      </div>

      <div className="flex items-center gap-2 mb-5">
        {([['posts', '공고 관리'], ['apps', '지원자 관리'], ['interviews', '면접 일정']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${view === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'posts' && <PostsTab />}
      {view === 'apps' && <ApplicationsTab />}
      {view === 'interviews' && <InterviewsTab />}
    </div>
  )
}

/* ─────────────────── 공고 관리 ─────────────────── */
const emptyPost: PostInput = { title: '', category: '', employment_type: '', work_time: '', salary: '', description: '', status: '모집중', is_public: true }

function PostsTab() {
  const [posts, setPosts] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<RecruitmentPost | null>(null)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try { setPosts(await recruitmentAPI.posts()) }
    catch (e: any) { setError(e?.message ?? '공고를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const togglePublic = async (p: RecruitmentPost) => {
    try { await recruitmentAPI.updatePost(p.id, { is_public: !p.is_public }); await load() }
    catch (e: any) { setError(e?.message ?? '변경 실패') }
  }
  const toggleStatus = async (p: RecruitmentPost) => {
    try { await recruitmentAPI.updatePost(p.id, { status: p.status === '모집중' ? '마감' : '모집중' }); await load() }
    catch (e: any) { setError(e?.message ?? '변경 실패') }
  }
  const remove = async (p: RecruitmentPost) => {
    if (!confirm(`'${p.title}' 공고를 삭제할까요?`)) return
    try { await recruitmentAPI.deletePost(p.id); await load() }
    catch (e: any) { setError(e?.message ?? '삭제 실패') }
  }

  return (
    <div>
      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="flex justify-end mb-3">
        <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white hover:bg-black">+ 새 공고 등록</button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['제목', '분야', '근무형태', '모집상태', '공개', '관리'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '등록된 공고가 없습니다.'}</td></tr>
            )}
            {posts.map(p => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-orange-50/30">
                <td className="px-4 py-3 font-semibold text-gray-900">{p.title}</td>
                <td className="px-4 py-3 text-gray-600">{p.category || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.employment_type || '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleStatus(p)} className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${p.status === '모집중' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status}</button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => togglePublic(p)} className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${p.is_public ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>{p.is_public ? '공개' : '비공개'}</button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 mr-1.5">수정</button>
                  <button onClick={() => remove(p)} className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-100 text-red-500 hover:bg-red-50">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <PostModal
          initial={editing ?? null}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={async () => { setEditing(null); setCreating(false); await load() }}
        />
      )}
    </div>
  )
}

function PostModal({ initial, onClose, onSaved }: { initial: RecruitmentPost | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PostInput>(initial ? { ...initial } : { ...emptyPost })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof PostInput, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title?.trim()) { setError('제목을 입력해주세요.'); return }
    setSaving(true); setError('')
    try {
      if (initial) await recruitmentAPI.updatePost(initial.id, form)
      else await recruitmentAPI.createPost(form)
      onSaved()
    } catch (e: any) { setError(e?.message ?? '저장 실패'); setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{initial ? '공고 수정' : '새 공고 등록'}</h3>
        {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <div className="space-y-3">
          <div><label className={labelCls}>제목 *</label><input value={form.title ?? ''} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="예) 요양보호사 (정규직)" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>분야</label><input value={form.category ?? ''} onChange={e => set('category', e.target.value)} className={inputCls} placeholder="요양보호사" /></div>
            <div><label className={labelCls}>근무형태</label><input value={form.employment_type ?? ''} onChange={e => set('employment_type', e.target.value)} className={inputCls} placeholder="정규직" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>근무시간</label><input value={form.work_time ?? ''} onChange={e => set('work_time', e.target.value)} className={inputCls} placeholder="주간 09~18시" /></div>
            <div><label className={labelCls}>급여(선택)</label><input value={form.salary ?? ''} onChange={e => set('salary', e.target.value)} className={inputCls} placeholder="면접 후 협의" /></div>
          </div>
          <div><label className={labelCls}>소개</label><textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={3} className={inputCls} placeholder="간단한 공고 소개" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>모집상태</label>
              <select value={form.status ?? '모집중'} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="모집중">모집중</option><option value="마감">마감</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>공개여부</label>
              <select value={form.is_public ? '1' : '0'} onChange={e => set('is_public', e.target.value === '1')} className={inputCls}>
                <option value="1">공개</option><option value="0">비공개</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">취소</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90 disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── 지원자 관리 ─────────────────── */
function ApplicationsTab() {
  const [items, setItems] = useState<RecruitmentApplication[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<RecruitmentApplication | null>(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const d = await recruitmentAPI.applications(filter ? { status: filter } : undefined)
      setItems(d.items); setCounts(d.counts)
    } catch (e: any) { setError(e?.message ?? '목록을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  const openDetail = (a: RecruitmentApplication) => { setSel(a); setMemo(a.admin_memo ?? '') }

  const changeStatus = async (status: AppStatus) => {
    if (!sel) return
    setSaving(true); setError('')
    try {
      const updated = await recruitmentAPI.updateApplication(sel.id, { status })
      setSel(updated); setItems(rows => rows.map(r => (r.id === updated.id ? updated : r))); await load()
    } catch (e: any) { setError(e?.message ?? '상태 변경 실패') }
    finally { setSaving(false) }
  }
  const saveMemo = async () => {
    if (!sel) return
    setSaving(true); setError('')
    try {
      const updated = await recruitmentAPI.updateApplication(sel.id, { admin_memo: memo })
      setSel(updated); setItems(rows => rows.map(r => (r.id === updated.id ? updated : r))); alert('메모를 저장했습니다.')
    } catch (e: any) { setError(e?.message ?? '메모 저장 실패') }
    finally { setSaving(false) }
  }

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  return (
    <div>
      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === '' ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          전체 ({total})
        </button>
        {APP_STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === s ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['이름', '지원분야', '연락처', '이메일', '상태', '지원일'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '지원자가 없습니다.'}</td></tr>
            )}
            {items.map(a => (
              <tr key={a.id} onClick={() => openDetail(a)} className="border-t border-gray-50 hover:bg-orange-50/40 cursor-pointer">
                <td className="px-4 py-3 font-semibold text-gray-900">{a.name}</td>
                <td className="px-4 py-3 text-gray-600">{a.category || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{a.phone}</td>
                <td className="px-4 py-3 text-gray-500">{a.email || '-'}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${appStatusStyle[a.status]}`}>{a.status}</span></td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{sel.name}</h3>
                <p className="text-sm text-gray-500">{fmt(sel.created_at)} 지원 · {sel.category || '-'}</p>
              </div>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${appStatusStyle[sel.status]}`}>{sel.status}</span>
            </div>

            <dl className="space-y-2.5 text-sm mb-5">
              {[
                ['지원분야', sel.category],
                ['연락처', sel.phone],
                ['이메일', sel.email],
                ['생년월일', sel.birth],
                ['경력', sel.experience],
                ['자기소개', sel.introduction],
              ].map(([k, val]) => (
                <div key={k as string} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-gray-400 font-medium">{k}</dt>
                  <dd className="text-gray-800 whitespace-pre-wrap flex-1">{val || '-'}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5 text-xs text-orange-700 mb-4">
              📎 이력서는 지원자가 별도 이메일로 보냅니다. {sel.email ? '지원자 이메일로 회신해 안내하세요.' : ''}
            </div>

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">상태 변경</p>
              <div className="flex flex-wrap gap-2">
                {APP_STATUSES.map(s => (
                  <button key={s} onClick={() => changeStatus(s)} disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${sel.status === s ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">관리자 메모</p>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="면접 일정, 평가 등 내부 메모"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <button onClick={saveMemo} disabled={saving} className="mt-2 px-4 py-2 rounded-lg text-sm font-bold bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50">메모 저장</button>
            </div>

            <div className="flex justify-end gap-2">
              <a href={`tel:${sel.phone}`} className="px-4 py-2 rounded-lg text-sm font-semibold border border-orange-200 text-orange-600 hover:bg-orange-50">📞 전화</a>
              {sel.email && <a href={`mailto:${sel.email}`} className="px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 text-blue-600 hover:bg-blue-50">✉️ 메일</a>}
              <button onClick={() => setSel(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────── 면접 일정 (캘린더 + 7일 통보 추적) ─────────────────── */
function InterviewsTab() {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [items, setItems] = useState<Interview[]>([])
  const [pending, setPending] = useState<Interview[]>([])
  const [error, setError] = useState('')
  const [sel, setSel] = useState<Interview | null>(null)
  const [addDate, setAddDate] = useState<Date | null>(null)

  const load = async () => {
    setError('')
    const start = `${ym.y}-${pad2(ym.m)}-01`
    const end = `${ym.y}-${pad2(ym.m)}-${pad2(new Date(ym.y, ym.m, 0).getDate())}`
    try {
      const [list, pend] = await Promise.all([
        recruitmentAPI.interviews({ start_date: start, end_date: end }),
        recruitmentAPI.interviews({ notify: 'pending' }),
      ])
      setItems(list); setPending(pend)
    } catch (e: any) { setError(e?.message ?? '면접 일정을 불러오지 못했습니다.') }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [ym.y, ym.m])

  const byDay = useMemo(() => {
    const m: Record<string, Interview[]> = {}
    items.forEach(iv => { const k = ymd(iv.interview_at); (m[k] ||= []).push(iv) })
    Object.values(m).forEach(a => a.sort((x, y) => (x.interview_at || '').localeCompare(y.interview_at || '')))
    return m
  }, [items])

  const shift = (d: number) => { const nd = new Date(ym.y, ym.m - 1 + d, 1); setYm({ y: nd.getFullYear(), m: nd.getMonth() + 1 }) }

  // 달력 셀
  const firstDow = new Date(ym.y, ym.m - 1, 1).getDay()
  const daysIn = new Date(ym.y, ym.m, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const todayKey = ymd(new Date().toISOString())

  const dday = (dueIso?: string | null) => {
    if (!dueIso) return null
    return Math.ceil((new Date(dueIso).getTime() - Date.now()) / 86400000)
  }

  return (
    <div>
      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {/* 결과 통보 대기(면접 후 7일) */}
      {pending.length > 0 && (
        <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
          <p className="text-sm font-bold text-gray-900 mb-2">결과 통보 대기 <span className="text-xs font-normal text-gray-400">(면접 후 7일 이내 통보)</span></p>
          <div className="space-y-1.5">
            {pending.sort((a, b) => (a.notify_due || '').localeCompare(b.notify_due || '')).map(iv => {
              const d = dday(iv.notify_due)
              const late = d != null && d < 0
              return (
                <div key={iv.id} className="flex items-center gap-2 text-sm">
                  <button onClick={() => setSel(iv)} className="font-semibold text-gray-900 hover:underline">{iv.name}</button>
                  <span className="text-gray-400 text-xs">{iv.category || ''} · 면접 {ymd(iv.interview_at)}</span>
                  <span className={`ml-auto text-xs font-bold ${late ? 'text-red-600' : d != null && d <= 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                    {late ? `통보 ${Math.abs(d!)}일 초과` : `통보 D-${d}`}
                  </span>
                  <button onClick={async () => { await recruitmentAPI.updateInterview(iv.id, { notified: true }); await load() }}
                    className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 font-semibold hover:bg-green-50">통보 완료</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 월 네비 */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => shift(-1)} className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50">‹</button>
        <span className="text-lg font-bold text-gray-900 tabular-nums w-28 text-center">{ym.y}년 {ym.m}월</span>
        <button onClick={() => shift(1)} className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50">›</button>
        <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() + 1 })} className="text-xs font-semibold text-primary-orange hover:underline ml-1">오늘</button>
        <button onClick={() => setAddDate(new Date())} className="ml-auto px-3 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white hover:bg-black">+ 면접 추가</button>
      </div>

      {/* 캘린더 */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 text-center text-xs font-semibold text-gray-500">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={`py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const key = day ? `${ym.y}-${pad2(ym.m)}-${pad2(day)}` : ''
            const list = day ? (byDay[key] || []) : []
            const isToday = key === todayKey
            return (
              <div key={i} className={`min-h-[92px] border-t border-r border-gray-50 p-1.5 ${i % 7 === 0 ? 'border-l' : ''} ${day ? 'hover:bg-orange-50/30 cursor-pointer' : 'bg-gray-50/40'}`}
                onClick={() => day && setAddDate(new Date(ym.y, ym.m - 1, day, 10, 0))}>
                {day && <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-white bg-primary-orange rounded-full w-5 h-5 flex items-center justify-center' : i % 7 === 0 ? 'text-red-400' : 'text-gray-500'}`}>{day}</div>}
                <div className="space-y-1">
                  {list.slice(0, 3).map(iv => (
                    <button key={iv.id} onClick={e => { e.stopPropagation(); setSel(iv) }}
                      className={`w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded truncate ${iv.status === 'canceled' ? 'bg-gray-100 text-gray-400 line-through' : iv.result === 'pass' ? 'bg-green-100 text-green-700' : iv.result === 'fail' ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-700'}`}>
                      {hmOf(iv.interview_at)} {iv.name}
                    </button>
                  ))}
                  {list.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{list.length - 3}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {addDate && <AddInterviewModal date={addDate} onClose={() => setAddDate(null)} onSaved={async () => { setAddDate(null); await load() }} />}
      {sel && <InterviewDetailModal iv={sel} onClose={() => setSel(null)} onChanged={async () => { await load() }} setSel={setSel} />}
    </div>
  )
}

function AddInterviewModal({ date, onClose, onSaved }: { date: Date; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState('')
  const [at, setAt] = useState(toLocalInput(date))
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Interview | null>(null)

  const save = async () => {
    if (!name.trim()) { setError('이름을 입력하세요.'); return }
    if (!at) { setError('면접 일시를 선택하세요.'); return }
    setSaving(true); setError('')
    try {
      const iv = await recruitmentAPI.createInterview({ name: name.trim(), phone: phone.trim() || null, category: category.trim() || null, interview_at: at, location: location.trim() || null, note: note.trim() || null })
      setCreated(iv)
    } catch (e: any) { setError(e?.message ?? '저장 실패'); setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <Modal title={created ? '면접 등록 완료 · 안내 문구' : '면접 일정 추가'} onClose={onClose}>
      {created ? (
        <div>
          <p className="text-sm text-gray-600 mb-2">아래 문구를 복사해 지원자에게 <b>문자·카카오톡</b>으로 보내세요.</p>
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 border border-gray-100 rounded-xl p-3 text-gray-800">{created.message}</pre>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => copyText(created.message)} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90">문구 복사</button>
            <button onClick={onSaved} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">닫기</button>
          </div>
        </div>
      ) : (
        <>
          {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>이름 *</label><input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="지원자 성함" /></div>
              <div><label className={labelCls}>연락처</label><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>지원 분야</label><input value={category} onChange={e => setCategory(e.target.value)} className={inputCls} placeholder="요양보호사" /></div>
              <div><label className={labelCls}>면접 일시 *</label><input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>장소</label><input value={location} onChange={e => setLocation(e.target.value)} className={inputCls} placeholder="비우면 시설 주소로 안내" /></div>
            <div><label className={labelCls}>메모</label><input value={note} onChange={e => setNote(e.target.value)} className={inputCls} /></div>
          </div>
          <ModalFooter onClose={onClose} onSave={save} saving={saving} saveLabel="등록 + 안내문구 생성" />
        </>
      )}
    </Modal>
  )
}

function InterviewDetailModal({ iv, onClose, onChanged, setSel }: { iv: Interview; onClose: () => void; onChanged: () => void; setSel: (i: Interview | null) => void }) {
  const [memo, setMemo] = useState(iv.memo ?? '')
  const patch = async (body: any) => { const u = await recruitmentAPI.updateInterview(iv.id, body); setSel(u); await onChanged() }
  const remove = async () => { if (!confirm('이 면접 일정을 삭제할까요?')) return; await recruitmentAPI.deleteInterview(iv.id); onClose(); await onChanged() }
  const due = iv.notify_due ? Math.ceil((new Date(iv.notify_due).getTime() - Date.now()) / 86400000) : null

  return (
    <Modal title="면접 상세" onClose={onClose}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{iv.name} <span className="text-sm font-normal text-gray-400">{iv.category || ''}</span></h3>
          <p className="text-sm text-gray-500">{fmt(iv.interview_at)}{iv.phone ? ` · ${iv.phone}` : ''}</p>
        </div>
        <div className="flex gap-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${IV_STATUS[iv.status].cls}`}>{IV_STATUS[iv.status].label}</span>
          {iv.result && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${IV_RESULT[iv.result].cls}`}>{IV_RESULT[iv.result].label}</span>}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">면접 상태</p>
        <div className="flex flex-wrap gap-1.5">
          {(['scheduled', 'done', 'no_show', 'canceled'] as IvStatus[]).map(st => (
            <button key={st} onClick={() => patch({ status: st })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${iv.status === st ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{IV_STATUS[st].label}</button>
          ))}
        </div>
      </div>

      {iv.status === 'done' && (
        <>
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">결과</p>
            <div className="flex gap-1.5">
              {(['pass', 'hold', 'fail'] as IvResult[]).map(rs => (
                <button key={rs} onClick={() => patch({ result: rs })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${iv.result === rs ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{IV_RESULT[rs].label}</button>
              ))}
            </div>
          </div>
          {/* 7일 통보 추적 */}
          <div className={`mb-3 rounded-xl border px-3 py-2.5 ${iv.notified ? 'border-green-100 bg-green-50/50' : due != null && due < 0 ? 'border-red-100 bg-red-50/50' : 'border-orange-100 bg-orange-50/50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">결과 통보 (면접 후 7일)</p>
                <p className="text-[11px] text-gray-500">기한 {ymd(iv.notify_due)} · {iv.notified ? `통보 완료 (${ymd(iv.notified_at)})` : due != null && due < 0 ? `${Math.abs(due)}일 초과` : `D-${due}`}</p>
              </div>
              <button onClick={() => patch({ notified: !iv.notified })}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold ${iv.notified ? 'border border-gray-200 text-gray-500 hover:bg-gray-50' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                {iv.notified ? '통보 취소' : '통보 완료'}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">안내 문구</p>
        <pre className="whitespace-pre-wrap text-xs bg-gray-50 border border-gray-100 rounded-xl p-3 text-gray-700 max-h-40 overflow-y-auto">{iv.message}</pre>
        <button onClick={() => copyText(iv.message)} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 font-semibold hover:bg-orange-50">문구 복사</button>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">메모</p>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
        <button onClick={() => patch({ memo })} className="mt-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-bold hover:bg-gray-900">메모 저장</button>
      </div>

      <div className="flex justify-between">
        {iv.phone ? <a href={`tel:${iv.phone}`} className="px-4 py-2 rounded-lg text-sm font-semibold border border-orange-200 text-orange-600 hover:bg-orange-50">📞 전화</a> : <span />}
        <div className="flex gap-2">
          <button onClick={remove} className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-100 text-red-500 hover:bg-red-50">삭제</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">닫기</button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
function ModalFooter({ onClose, onSave, saving, saveLabel = '저장' }: { onClose: () => void; onSave: () => void; saving: boolean; saveLabel?: string }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">취소</button>
      <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90 disabled:opacity-50">{saving ? '저장 중…' : saveLabel}</button>
    </div>
  )
}

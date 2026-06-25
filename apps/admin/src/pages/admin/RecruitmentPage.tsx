import { useEffect, useMemo, useState } from 'react'
import {
  recruitmentAPI,
  type RecruitmentPost, type RecruitmentApplication,
  type AppStatus, type PostInput,
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

export default function RecruitmentPage() {
  const [view, setView] = useState<'posts' | 'apps'>('posts')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">채용 관리</h1>
        <p className="text-sm text-gray-500 mt-1">채용 공고를 등록·관리하고, 홈페이지로 접수된 지원자를 확인합니다.</p>
      </div>

      <div className="flex items-center gap-2 mb-5">
        {([['posts', '공고 관리'], ['apps', '지원자 관리']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${view === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'posts' ? <PostsTab /> : <ApplicationsTab />}
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

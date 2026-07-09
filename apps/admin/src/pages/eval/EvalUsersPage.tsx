import StickyToolbar from '../../components/common/StickyToolbar'
import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, Search, X, Eye, EyeOff, KeyRound } from 'lucide-react'
import { apiClient } from '@/api/client'

// ── 허용 직종 (백엔드 enum과 동일) ───────────────────────────────────────────
const POSITIONS = [
  '대표', '시설장', '이사',
  '사회복지사', '간호사', '간호조무사',
  '물리치료사', '요양보호사', '요양팀장', '앨범담당',
] as const

const ROLES = [
  { value: 'ADMIN', label: '관리자' },
  { value: 'STAFF', label: '직원' },
] as const

interface UserAccount {
  id:         string
  email:      string
  name:       string
  role:       'ADMIN' | 'STAFF'
  position?:  string | null
  created_at: string | null
}

const ic = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

// ── API 함수 ──────────────────────────────────────────────────────────────────
async function fetchUsers(): Promise<UserAccount[]> {
  const res = await apiClient.get('/api/v1/users')
  return (res.data as any)?.data ?? []
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function EvalUsersPage() {
  const [users,   setUsers]   = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [addOpen,    setAddOpen]    = useState(false)
  const [editUser,   setEditUser]   = useState<UserAccount | null>(null)
  const [pwUser,     setPwUser]     = useState<UserAccount | null>(null)

  const load = async () => {
    setLoading(true)
    try { setUsers(await fetchUsers()) }
    catch { setUsers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    users.filter(u =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.position ?? '').includes(search)
    ), [users, search])

  const handleDelete = async (u: UserAccount) => {
    if (!confirm(`${u.name} 계정을 삭제하시겠습니까?`)) return
    try {
      await apiClient.delete(`/api/v1/users/${u.id}`)
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '삭제에 실패했습니다')
    }
  }

  const roleLabel: Record<string, string> = { ADMIN: '관리자', STAFF: '직원' }
  const roleCls:   Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700',
    STAFF: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원 계정 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">로그인 계정과 권한을 관리합니다</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 bg-primary-orange text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-orange/90 shadow-sm">
          <Plus size={15}/> 직원 추가
        </button>
      </div>

      {/* 검색 (상단 고정) */}
      <StickyToolbar>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름, 이메일, 직종 검색..."
          className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"/>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={13} className="text-gray-400"/>
          </button>
        )}
      </div>
      </StickyToolbar>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-5 h-5 border-2 border-primary-orange border-t-transparent rounded-full animate-spin mr-2"/>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {search ? '검색 결과가 없습니다' : '등록된 직원이 없습니다'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>{u.name[0]}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{u.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleCls[u.role] ?? roleCls.STAFF}`}>
                      {roleLabel[u.role] ?? u.role}
                    </span>
                    {u.position && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">
                        {u.position}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setPwUser(u)} title="비밀번호 변경"
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    <KeyRound size={13} className="text-gray-400"/>
                  </button>
                  <button onClick={() => setEditUser(u)}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    <Edit2 size={13} className="text-gray-500"/>
                  </button>
                  <button onClick={() => handleDelete(u)}
                    className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} className="text-red-400"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen  && <UserFormModal onClose={() => setAddOpen(false)}   onSaved={load} />}
      {editUser && <UserFormModal existing={editUser} onClose={() => setEditUser(null)} onSaved={load} />}
      {pwUser   && <PasswordModal user={pwUser} onClose={() => setPwUser(null)} />}
    </div>
  )
}

// ── 직원 추가/수정 모달 ────────────────────────────────────────────────────────
function UserFormModal({ existing, onClose, onSaved }: {
  existing?: UserAccount; onClose: ()=>void; onSaved: ()=>void
}) {
  const [form, setForm] = useState({
    name:     existing?.name     ?? '',
    email:    existing?.email    ?? '',
    password: '',
    role:     existing?.role     ?? 'STAFF',
    position: existing?.position ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [showPw, setShowPw] = useState(false)

  const submit = async () => {
    if (!form.name || !form.email) { setError('이름과 이메일은 필수입니다'); return }
    if (!existing && !form.password) { setError('비밀번호를 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      if (existing) {
        const body: any = {}
        if (form.name     !== existing.name)     body.name     = form.name
        if (form.role     !== existing.role)     body.role     = form.role
        if (form.position !== existing.position) body.position = form.position || null
        await apiClient.patch(`/api/v1/users/${existing.id}`, body)
      } else {
        await apiClient.post('/api/v1/users', {
          ...form,
          position: form.position || null,
        })
      }
      onSaved(); onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">{existing ? '직원 정보 수정' : '직원 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">이름 *</label>
            <input className={ic} value={form.name}
              onChange={e => setForm({...form, name: e.target.value})} placeholder="홍길동"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              이메일 * {existing && <span className="font-normal text-gray-400">(수정 불가)</span>}
            </label>
            <input className={ic} type="email" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              placeholder="staff@example.com" disabled={!!existing}/>
          </div>

          {!existing && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">비밀번호 *</label>
              <div className="relative">
                <input className={ic} type={showPw ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  placeholder="초기 비밀번호 입력"/>
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">권한 *</label>
              <select className={ic} value={form.role}
                onChange={e => setForm({...form, role: e.target.value as any})}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">직종</label>
              <select className={ic} value={form.position}
                onChange={e => setForm({...form, position: e.target.value})}>
                <option value="">선택 안 함</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500">
            <span className="font-semibold">권한 안내:</span>{' '}
            관리자는 전체 체크리스트 조회 및 담당자 지정 가능 · 직원은 본인 담당 항목만 조회
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button type="button" onClick={submit} disabled={saving}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">
            {saving ? '저장 중...' : existing ? '수정' : '추가'}
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 비밀번호 변경 모달 ────────────────────────────────────────────────────────
function PasswordModal({ user, onClose }: { user: UserAccount; onClose: ()=>void }) {
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  const submit = async () => {
    if (!password || password.length < 4) { setError('4자 이상 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await apiClient.patch(`/api/v1/users/${user.id}/password`, { password })
      setDone(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">비밀번호 변경</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{user.name}</span>님의 비밀번호를 변경합니다.
          </p>
          {done ? (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
              ✅ 비밀번호가 변경되었습니다.
            </div>
          ) : (
            <>
              <div className="relative">
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-10"
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="새 비밀번호"/>
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {error && <p className="text-xs text-red-600">⚠️ {error}</p>}
            </>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          {!done && (
            <button type="button" onClick={submit} disabled={saving}
              className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? '변경 중...' : '변경'}
            </button>
          )}
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
            {done ? '닫기' : '취소'}
          </button>
        </div>
      </div>
    </div>
  )
}

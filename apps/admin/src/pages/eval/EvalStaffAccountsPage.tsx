import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, X, User, Power, Edit2, Eye, EyeOff } from 'lucide-react'
import { staffAccountAPI, type StaffUser } from '@/api/staffAccountClient'
import { useAuthStore } from '@/store/auth'

const ROLE_CONFIG = {
  ADMIN:   { label: '관리자', cls: 'bg-red-100 text-red-700',    desc: '전체 권한' },
  MANAGER: { label: '팀장',   cls: 'bg-blue-100 text-blue-700',  desc: '담당자 지정, 진행률 확인' },
  STAFF:   { label: '직원',   cls: 'bg-gray-100 text-gray-600',  desc: '본인 담당 항목 완료 처리' },
}

export default function EvalStaffAccountsPage() {
  const { user }        = useAuthStore()
  const [staff,  setStaff]  = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<StaffUser | null>(null)

  const isAdmin = user?.role === 'ADMIN'

  const load = async () => {
    setLoading(true)
    try { setStaff(await staffAccountAPI.list()) }
    catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search) return staff
    const q = search.toLowerCase()
    return staff.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.position ?? '').toLowerCase().includes(q) ||
      (s.department ?? '').toLowerCase().includes(q)
    )
  }, [staff, search])

  const toggleActive = async (s: StaffUser) => {
    if (!confirm(`${s.name} 계정을 ${s.is_active ? '비활성화' : '활성화'}하시겠습니까?`)) return
    s.is_active ? await staffAccountAPI.deactivate(s.id) : await staffAccountAPI.activate(s.id)
    load()
  }

  const counts = {
    total:  staff.length,
    active: staff.filter(s => s.is_active).length,
    admin:  staff.filter(s => s.role === 'ADMIN').length,
    manager:staff.filter(s => s.role === 'MANAGER').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원 계정 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">체크리스트 담당자 지정을 위한 직원 계정을 관리합니다</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-primary-orange text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-orange/90 shadow-sm">
            <Plus size={15}/> 직원 추가
          </button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '전체 직원', value: counts.total,   color: 'bg-gray-50' },
          { label: '활성',      value: counts.active,  color: 'bg-green-50' },
          { label: '관리자',    value: counts.admin,   color: 'bg-red-50' },
          { label: '팀장',      value: counts.manager, color: 'bg-blue-50' },
        ].map(c => (
          <div key={c.label} className={`${c.color} rounded-xl p-4 border border-white shadow-sm`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900">{c.value}명</p>
          </div>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름, 이메일, 직책, 부서 검색..."
          className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"/>
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={13} className="text-gray-400"/></button>}
      </div>

      {/* 직원 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-6 h-6 border-2 border-primary-orange border-t-transparent rounded-full animate-spin mr-2"/>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <User size={32} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">{search ? '검색 결과 없음' : '등록된 직원이 없습니다'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(s => {
              const rc = ROLE_CONFIG[s.role] ?? ROLE_CONFIG.STAFF
              return (
                <div key={s.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                  {/* 아바타 */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${s.role==='ADMIN'?'bg-red-100 text-red-700':s.role==='MANAGER'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>
                    {s.name[0]}
                  </div>
                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rc.cls}`}>{rc.label}</span>
                      {!s.is_active && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">비활성</span>}
                    </div>
                    <p className="text-xs text-gray-500">{s.email}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {[s.position, s.department].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {/* 액션 */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setEditUser(s)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <Edit2 size={13} className="text-gray-500"/>
                      </button>
                      <button onClick={() => toggleActive(s)}
                        className={`p-1.5 rounded-lg border transition-colors ${s.is_active?'border-red-100 hover:bg-red-50':'border-green-100 hover:bg-green-50'}`}>
                        <Power size={13} className={s.is_active ? 'text-red-400' : 'text-green-500'}/>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {addOpen && <StaffFormModal onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load() }}/>}
      {editUser && <StaffFormModal existing={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load() }}/>}
    </div>
  )
}

// ── 직원 추가/수정 모달 ────────────────────────────────────────────────────────
function StaffFormModal({ existing, onClose, onSaved }: {
  existing?: StaffUser; onClose: ()=>void; onSaved: ()=>void
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    email: existing?.email ?? '',
    password: '',
    role: existing?.role ?? 'STAFF',
    position: existing?.position ?? '',
    department: existing?.department ?? '',
    phone: existing?.phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [showPw, setShowPw] = useState(false)

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

  const submit = async () => {
    if (!form.name || !form.email) { setError('이름과 이메일은 필수입니다'); return }
    if (!existing && !form.password) { setError('비밀번호를 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      if (existing) {
        const body: any = {}
        if (form.name !== existing.name) body.name = form.name
        if (form.role !== existing.role) body.role = form.role
        if (form.position !== existing.position) body.position = form.position
        if (form.department !== existing.department) body.department = form.department
        if (form.phone !== existing.phone) body.phone = form.phone
        if (form.password) body.password = form.password
        await staffAccountAPI.update(existing.id, body)
      } else {
        await staffAccountAPI.create(form)
      }
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">{existing ? '직원 정보 수정' : '직원 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">이름 *</label>
              <input className={ic} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="홍길동"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">권한 *</label>
              <select className={ic} value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                <option value="STAFF">직원</option>
                <option value="MANAGER">팀장</option>
                <option value="ADMIN">관리자</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">이메일 * (로그인 ID)</label>
            <input className={ic} type="email" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              placeholder="hong@facility.com" disabled={!!existing}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              비밀번호 {existing ? '(변경 시만 입력)' : '*'}
            </label>
            <div className="relative">
              <input className={ic} type={showPw ? 'text' : 'password'}
                value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                placeholder={existing ? '변경하지 않으면 비워두세요' : '비밀번호 입력'}/>
              <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">직책</label>
              <input className={ic} value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="요양보호사"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">부서</label>
              <input className={ic} value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="요양팀"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">전화번호</label>
            <input className={ic} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="010-0000-0000"/>
          </div>
          {/* 권한 설명 */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500">
            <p className="font-semibold mb-1">권한 안내</p>
            {Object.entries(ROLE_CONFIG).map(([k,v]) => (
              <p key={k}><span className="font-medium">{v.label}</span>: {v.desc}</p>
            ))}
          </div>
          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600">⚠️ {error}</div>}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">
            {saving ? '저장 중...' : existing ? '수정' : '추가'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
        </div>
      </div>
    </div>
  )
}

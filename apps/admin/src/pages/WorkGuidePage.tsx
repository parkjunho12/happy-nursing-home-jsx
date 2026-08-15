import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen, ArrowRight, AlertTriangle, Clock, Users, Loader2, ShieldAlert,
  ChevronRight, ClipboardList, FileWarning, Info,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useLtcStore } from '@/store/ltc'
import { getNavConfig } from '@/components/layout/navConfig'
import { workGuideAPI, type GuidePermission } from '@/api/workGuideClient'
import {
  GUIDE_ITEMS, GUIDE_FLOWS, OFF_SYSTEM, ROLE_META, EXEC_MODE, isValidRoute,
  type GuideRole, type RoleGuideItem,
} from '@/config/workGuide'

const ACCENT: Record<string, { bg: string; text: string; ring: string; btn: string }> = {
  teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   ring: 'border-teal-200',   btn: 'bg-teal-600 hover:bg-teal-700' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-700',   ring: 'border-rose-200',   btn: 'bg-rose-600 hover:bg-rose-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'border-indigo-200', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'border-orange-200', btn: 'bg-primary-orange hover:bg-primary-orange/90' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'border-violet-200', btn: 'bg-violet-600 hover:bg-violet-700' },
}

export default function WorkGuidePage() {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { user } = useAuthStore()
  const { checklists, loadAll } = useLtcStore()
  const [perm, setPerm] = useState<GuidePermission | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    workGuideAPI.roles().then(setPerm).catch(() => setPerm(null)).finally(() => setLoading(false))
  }, [])

  // 서버가 허용한 직종만 열람 (다른 직종 URL 직접 접근 차단)
  const requested = sp.get('role') as GuideRole | null
  const role: GuideRole | null = useMemo(() => {
    if (!perm) return null
    if (requested && perm.allowed_roles.includes(requested)) return requested
    return perm.my_role ?? (perm.can_view_all ? perm.allowed_roles[0] ?? null : null)
  }, [perm, requested])
  const blocked = !!requested && !!perm && !perm.allowed_roles.includes(requested)

  // 로그인 사용자가 실제 접근 가능한 라우트 = 사이드바 메뉴 집합
  const allowedRoutes = useMemo(() => {
    const nav = getNavConfig(user)
    const set = new Set<string>(nav.sections.flatMap(s => s.items.map(i => i.to)))
    set.add('/guide'); set.add('/work-guide')
    return set
  }, [user])

  const canOpen = (r?: string) => isValidRoute(r) && allowedRoutes.has(r!)

  const items = useMemo(() => {
    if (!role) return []
    return GUIDE_ITEMS
      .filter(i => i.isActive && i.roles.includes(role))
      .filter(i => !i.route || canOpen(i.route))   // 권한 없는/없는 라우트는 가이드에도 미노출
      .sort((a, b) => a.order - b.order)
  }, [role, allowedRoutes])

  const flows = useMemo(() => (role ? GUIDE_FLOWS.filter(f => f.roles.includes(role)) : []), [role])
  const offSystem = useMemo(() => (role ? OFF_SYSTEM.filter(o => o.roles.includes(role)).flatMap(o => o.items) : []), [role])

  // 확인이 필요한 기록 (실제 데이터)
  const todoCount = checklists.filter(c => c.active && !c.completed).length

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>

  if (!perm?.has_position) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-900">직종 정보가 없습니다</h1>
        <p className="text-sm text-gray-500 mt-2">계정에 직종이 지정되어 있지 않아 업무 가이드를 표시할 수 없습니다. 관리자에게 직종 지정을 요청해 주세요.</p>
      </div>
    )
  }
  if (!role) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <Info className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-900">해당 직종 가이드가 준비되지 않았습니다</h1>
        <p className="text-sm text-gray-500 mt-2">현재 사회복지사 · 간호사 · 간호조무사 · 요양보호사 가이드를 제공합니다. ({perm.position})</p>
        <button onClick={() => navigate('/guide')} className="mt-4 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">기본 사용법 보기</button>
      </div>
    )
  }

  const meta = ROLE_META[role]
  const ac = ACCENT[meta.accent]
  // 요양보호사 선생님들은 50대 이상 — 글씨를 키우고 곁가지 정보를 줄인다
  const big = role === 'caregiver'

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className={`rounded-2xl border ${ac.ring} ${ac.bg} p-4`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm"><BookOpen className={`w-5 h-5 ${ac.text}`} /></div>
            <div>
              <p className="text-xs font-semibold text-gray-500">내 업무 가이드</p>
              <h1 className={`text-xl font-extrabold ${ac.text}`}>{meta.label}</h1>
              <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
            </div>
          </div>
          <button onClick={() => navigate('/guide')} className="text-xs font-semibold text-gray-500 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50">기본 사용법 →</button>
        </div>

        {/* 관리자: 직종 전환 */}
        {perm.can_view_all && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-500 mr-1">관리자 · 직종 전환</span>
            {perm.allowed_roles.map(r => (
              <button key={r} onClick={() => setSp({ role: r })}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${r === role ? 'bg-white shadow-sm ' + ACCENT[ROLE_META[r].accent].text + ' ' + ACCENT[ROLE_META[r].accent].ring : 'bg-white/60 border-gray-200 text-gray-500 hover:bg-white'}`}>
                {ROLE_META[r].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {blocked && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" /> 본인 직종의 가이드만 볼 수 있습니다. 내 직종 가이드를 표시합니다.
        </div>
      )}

      {/* 확인이 필요한 기록 */}
      <button onClick={() => navigate('/eval/checklist')}
        className={`w-full text-left rounded-2xl border p-4 transition-colors ${todoCount > 0 ? 'border-amber-200 bg-amber-50 hover:border-amber-300' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ClipboardList className={`w-5 h-5 ${todoCount > 0 ? 'text-amber-600' : 'text-gray-300'}`} />
            <div>
              <p className={`${big ? 'text-base' : 'text-sm'} font-bold text-gray-800`}>{big ? '아직 체크 안 한 일' : '확인이 필요한 기록'}</p>
              <p className={`${big ? 'text-sm' : 'text-xs'} text-gray-500`}>{big ? '누르면 오늘 할 일 목록이 열려요.' : '완료하지 않은 체크리스트가 있으면 누락으로 집계됩니다.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-extrabold ${todoCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{todoCount}<span className="text-xs font-bold text-gray-400">건</span></span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>
      </button>

      {/* 주요 업무 카드 */}
      <div>
        <h2 className={`${big ? 'text-base' : 'text-sm'} font-bold text-gray-800 mb-2`}>내가 주로 하는 업무</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map(it => <ItemCard key={it.id} item={it} accent={meta.accent} big={big} onGo={() => it.route && navigate(it.route)} canOpen={canOpen(it.route)} />)}
        </div>
        {items.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">표시할 업무가 없습니다.</p>}
      </div>

      {/* 업무 흐름 */}
      {flows.map(f => (
        <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className={`${big ? 'text-base' : 'text-sm'} font-bold text-gray-800 mb-3`}>{f.title}</h2>
          <ol className="space-y-2">
            {f.steps.map((s, i) => {
              const open = canOpen(s.route)
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${ac.bg} ${ac.text}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`${big ? 'text-base' : 'text-sm'} text-gray-700`}>{s.label}</p>
                    {s.note && <p className={`${big ? 'text-xs' : 'text-[11px]'} text-amber-600 mt-0.5`}>※ {s.note}</p>}
                  </div>
                  {open && (
                    <button onClick={() => navigate(s.route!)}
                      className="shrink-0 text-[11px] font-semibold text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1">
                      {s.menuLabel} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ))}

      {/* 시스템 외 처리 업무 */}
      {offSystem.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <FileWarning className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">시스템에 전용 화면이 없는 업무</h2>
          </div>
          <p className="text-xs text-gray-400 mb-2">아래 업무는 현재 Admin에 전용 입력 화면이 없습니다. <b>체크리스트에 수행 기록</b>을 남기고 서식은 수기로 보관하세요.</p>
          <ul className="space-y-1">
            {offSystem.map((t, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-gray-300 mt-0.5">•</span>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, accent, big, onGo, canOpen }: { item: RoleGuideItem; accent: string; big?: boolean; onGo: () => void; canOpen: boolean }) {
  const ac = ACCENT[accent]
  const mode = item.mode ? EXEC_MODE[item.mode] : null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`${big ? 'text-xs' : 'text-[10px]'} font-bold px-1.5 py-0.5 rounded ${ac.bg} ${ac.text}`}>{item.category}</span>
          <p className={`${big ? 'text-base' : 'text-sm'} font-bold text-gray-900 mt-1.5 leading-snug`}>{item.title}</p>
        </div>
        {mode && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${mode.tone}`}>{mode.label}</span>}
      </div>
      <p className={`${big ? 'text-sm text-gray-600' : 'text-xs text-gray-500'} mt-1.5 leading-relaxed flex-1`}>{item.description}</p>

      {item.timing && (
        <p className={`${big ? 'text-xs' : 'text-[11px]'} text-gray-500 mt-2 flex items-start gap-1`}><Clock className="w-3 h-3 mt-0.5 shrink-0 text-gray-300" />{item.timing}</p>
      )}
      {/* 큰 글씨 모드에선 '연계 직종' 같은 곁가지 정보는 숨긴다 — 핵심만 */}
      {!big && item.relatedRoles && item.relatedRoles.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-1 flex items-start gap-1"><Users className="w-3 h-3 mt-0.5 shrink-0 text-gray-300" />연계: {item.relatedRoles.join(' · ')}</p>
      )}
      {item.caution && (
        <p className={`${big ? 'text-xs' : 'text-[11px]'} text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2 flex items-start gap-1`}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{item.caution}
        </p>
      )}

      {canOpen && item.route && (
        <button onClick={onGo}
          className={`mt-3 w-full ${big ? 'py-3 text-base' : 'py-2.5 text-sm'} rounded-xl text-white font-bold inline-flex items-center justify-center gap-1.5 ${ac.btn}`}>
          {item.menuLabel} 열기 <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

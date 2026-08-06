import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, FileText, Landmark, Loader2, Pencil, UserRound } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { calcAge, isItemDone } from '@/utils/period'
import type { ChecklistItem } from '@/utils/period'
import { hrAPI, DOC_FIELDS, type HrRecord } from '@/api/hrClient'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'

/**
 * 직원 상세 — 어르신 상세와 같은 결.
 * 기본 정보 · 근로계약/서류 제출 현황 · 입사 체크리스트(토글·기한·완료자)를 한 화면에.
 */
function Sec({ icon: Icon, title, children, right, className = '' }: {
  icon: any; title: string; children: React.ReactNode; right?: React.ReactNode; className?: string
}) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-indigo-600" />
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  )
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start gap-2 py-1">
    <span className="w-24 shrink-0 text-xs text-gray-400 pt-0.5">{k}</span>
    <span className="text-sm text-gray-800 font-medium break-all">{v ?? <span className="text-gray-300">—</span>}</span>
  </div>
)

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { staffList, checklists, loaded, loadAll, toggleComplete, updateChecklist } = useLtcStore()
  const [hr, setHr] = useState<HrRecord | null>(null)
  const [hrLoading, setHrLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingCl, setEditingCl] = useState<ChecklistItem | null>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])
  useEffect(() => {
    if (!id) return
    setHrLoading(true)
    hrAPI.list(true).then(rows => setHr(rows.find(r => r.staff_id === id) ?? null))
      .catch(() => setHr(null)).finally(() => setHrLoading(false))
  }, [id])

  const s = staffList.find(x => x.id === id)
  const cls = useMemo(() => checklists.filter(c => c.personId === id), [checklists, id])
  const done = cls.filter(isItemDone).length
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

  if (!loaded) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-300" /></div>
  if (!s) return (
    <div className="p-6 text-center text-gray-400">
      <p className="text-sm">직원을 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/eval/staff')} className="mt-3 text-sm font-bold text-indigo-600 hover:underline">← 직원 관리로</button>
    </div>
  )

  const workYears = (() => {
    const h = new Date(s.hireDate); const e = s.resignDate ? new Date(s.resignDate) : new Date()
    const y = e.getFullYear() - h.getFullYear(); const mo = e.getMonth() - h.getMonth()
    return y > 0 ? `${y}년 ${mo >= 0 ? mo : 12 + mo}개월` : `${Math.max(0, Math.abs(mo))}개월`
  })()
  const contractsText = (() => {
    const list = (hr?.contracts as any[]) ?? []
    if (list.length > 0) return list.map((c: any) => `${c.start ?? '?'} ~ ${c.end ?? '진행'}`).join(' · ')
    return hr?.contract_period || null
  })()

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/eval/staff')}
          className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50"><ArrowLeft size={16} /></button>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${s.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>{s.name[0]}</div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{s.name}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : s.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {s.status === 'active' ? '재직 중' : s.status === 'pending' ? '입사 예정' : '퇴사'}
            </span>
            {s.position && <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{s.position}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {s.gender === 'female' ? '여' : '남'} · 만 {calcAge(s.birthDate)}세 · 입사 {s.hireDate} · 근속 {workYears}{s.resignDate && ` · 퇴사 ${s.resignDate}`}
          </p>
        </div>
        <button onClick={() => navigate('/eval/staff')}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
          <Pencil size={13} /> 직원 관리에서 수정
        </button>
      </div>

      {/* 입사 체크리스트 — 풀폭, 토글·기한·완료자 */}
      <Sec icon={CalendarDays} title={`입사 체크리스트 ${cls.length ? `(${done}/${cls.length})` : ''}`}
        right={cls.length > 0 ? (
          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-2 rounded-full ${done === cls.length ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${cls.length ? (done / cls.length) * 100 : 0}%` }} />
          </div>
        ) : undefined}>
        {cls.length === 0 ? (
          <p className="text-xs text-gray-400">연결된 체크리스트가 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {cls.map(c => {
              const ok = isItemDone(c)
              const late = !ok && !!c.dueDate && c.dueDate < today
              const dday = c.dueDate ? Math.round((new Date(c.dueDate).getTime() - new Date(today).getTime()) / 86400000) : null
              return (
                <li key={c.id} className={`flex items-center gap-2.5 pl-2.5 pr-2 py-2 rounded-xl border text-xs ${ok ? 'bg-green-50/60 border-green-100' : late ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                  <button type="button" disabled={busyId === c.id}
                    onClick={async () => {
                      setBusyId(c.id)
                      try { await toggleComplete(c.id, !ok) }
                      catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
                      finally { setBusyId(null) }
                    }}
                    className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${ok ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400 bg-white'} ${busyId === c.id ? 'opacity-40' : ''}`}>
                    {ok && <span className="text-white text-[11px] font-black leading-none">✓</span>}
                  </button>
                  <span className={`flex-1 min-w-0 truncate text-[12.5px] ${ok ? 'line-through text-gray-400' : 'font-semibold text-gray-700'}`}>{c.title}</span>
                  {ok && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-white border border-green-200 px-2 py-0.5 rounded-full">
                      ✓ {(c as any).completedBy ?? '담당자 미기록'}
                      {c.completedDate && <span className="font-semibold text-green-500">{Number(c.completedDate.slice(5, 7))}/{Number(c.completedDate.slice(8, 10))}</span>}
                    </span>
                  )}
                  {!ok && dday != null && (
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${late ? 'bg-red-100 text-red-600' : dday <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                      {late ? `지연 ${-dday}일` : dday === 0 ? '오늘까지' : `D-${dday}`}
                    </span>
                  )}
                  <input type="date" value={c.dueDate ?? ''}
                    onChange={async e => {
                      try { await updateChecklist(c.id, { dueDate: e.target.value } as any) }
                      catch (e2: any) { alert(e2?.response?.data?.detail ?? '기한 저장 실패') }
                    }}
                    className="shrink-0 w-[8.2rem] px-1.5 py-1 text-[11px] border border-gray-200 rounded-lg bg-white text-gray-500 hidden sm:block" />
                  <button type="button" onClick={() => setEditingCl(c)} className="shrink-0 p-1 text-gray-300 hover:text-gray-600 rounded"><Pencil size={12} /></button>
                </li>
              )
            })}
          </ul>
        )}
      </Sec>

      <div className="grid md:grid-cols-2 gap-3">
        {/* 기본 정보 */}
        <Sec icon={UserRound} title="기본 정보">
          <Row k="생년월일" v={`${s.birthDate || '-'} (만 ${calcAge(s.birthDate)}세)`} />
          <Row k="연락처" v={(s as any).phone || null} />
          <Row k="주소" v={[(s as any).address, (s as any).addressDetail].filter(Boolean).join(' ') || null} />
          <Row k="자격증" v={(s as any).licenseNo ? `${(s as any).licenseNo}${(s as any).licenseDate ? ` (발급 ${(s as any).licenseDate})` : ''}` : null} />
          <Row k="통장" v={(s as any).bankAccount || null} />
          {(s.leaves ?? []).length > 0 && (
            <Row k="휴직" v={(s.leaves ?? []).map(l => `${l.start ?? '?'} ~ ${l.end ?? '진행'}${l.reason ? ` (${l.reason})` : ''}`).join(' · ')} />
          )}
          <Row k="메모" v={s.memo || null} />
        </Sec>

        {/* 근로계약 · 서류 */}
        <Sec icon={FileText} title="근로계약 · 서류" right={
          <button onClick={() => navigate('/staff-hr')} className="text-[11px] font-bold text-indigo-600 hover:underline">직원 상세 표 ›</button>
        }>
          {hrLoading ? <Loader2 size={14} className="animate-spin text-gray-300" /> : !hr ? (
            <p className="text-xs text-gray-400">근로계약·서류 표에 연동된 행이 없습니다.</p>
          ) : (
            <>
              <Row k="계약 기간" v={contractsText} />
              <Row k="재계약일" v={hr.renewal_date || null} />
              <div className="flex items-start gap-2 py-1">
                <span className="w-24 shrink-0 text-xs text-gray-400 pt-0.5">서류 제출</span>
                <div className="flex flex-wrap gap-1">
                  {DOC_FIELDS.map(d => {
                    const v = (hr.docs as any)?.[d.key]
                    return (
                      <span key={d.key} title={d.label}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          v === true ? 'bg-green-50 text-green-700 border-green-200'
                          : v === false ? 'bg-red-50 text-red-500 border-red-200'
                          : 'bg-gray-50 text-gray-300 border-gray-200'}`}>
                        {d.short}
                      </span>
                    )
                  })}
                </div>
              </div>
              {hr.doc_note && <Row k="서류 메모" v={hr.doc_note} />}
              {hr.note && <Row k="기타" v={hr.note} />}
            </>
          )}
        </Sec>
      </div>

      {/* 바로가기 */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => navigate('/work-schedule-view')} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 inline-flex items-center gap-1.5">
          <CalendarDays size={12} /> 전체 근무표 ›
        </button>
        <button onClick={() => navigate('/staff-hr')} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 inline-flex items-center gap-1.5">
          <Landmark size={12} /> 연차대장 · 급여명세서 ›
        </button>
        <button onClick={() => navigate('/pension')} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">퇴직연금 ›</button>
      </div>

      {editingCl && <ChecklistFormModal existing={editingCl} onClose={() => setEditingCl(null)} />}
    </div>
  )
}

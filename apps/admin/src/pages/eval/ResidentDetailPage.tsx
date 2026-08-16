import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BedDouble, CalendarDays, FileText, HeartHandshake, Loader2, Pencil, Printer, UserRound } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { calcAge, isItemDone } from '@/utils/period'
import { residentDocAPI, type ResidentDoc } from '@/api/residentDocClient'
import { assignmentAPI, type AssignRow } from '@/api/assignmentClient'
import { currentCert, certState, fmtD, gradeLabel } from '@/utils/cert'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'
import { ResidentForm } from './EvalResidentsPage'
import type { ChecklistItem } from '@/utils/period'

/**
 * 수급자 상세 — 흩어져 있던 정보(기본·그룹·담당자·서류·체크리스트)를 한 화면에.
 * 수정은 이 페이지에서 바로 (수급자 관리와 같은 폼 재사용).
 */
const GRP = [
  ['인지', 'groupCognitive', 'bg-violet-50 text-violet-700 border-violet-200'],
  ['여가', 'groupLeisure', 'bg-sky-50 text-sky-700 border-sky-200'],
  ['신체', 'groupPhysical', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
] as const

// 입소 체크리스트 영역 — 제목의 [태그]로 묶는다 (템플릿과 동일 순서)
// 색은 계열별로 통일 — 업무(하늘) · 서류(남색) · 전산(보라) · 대상자별(주황)
const FAM = {
  work: { name: '업무',  accent: 'text-sky-700 bg-sky-50 border-sky-200',         bar: 'bg-sky-400',    dot: 'bg-sky-400' },
  docs: { name: '서류',  accent: 'text-indigo-700 bg-indigo-50 border-indigo-200', bar: 'bg-indigo-400', dot: 'bg-indigo-400' },
  it:   { name: '전산',  accent: 'text-violet-700 bg-violet-50 border-violet-200', bar: 'bg-violet-400', dot: 'bg-violet-400' },
  cond: { name: '대상자별', accent: 'text-orange-700 bg-orange-50 border-orange-200', bar: 'bg-orange-400', dot: 'bg-orange-400' },
} as const
const CL_GROUPS: { tag: string; no: number; label: string; fam: keyof typeof FAM; accent: string; bar: string }[] = ([
  { tag: '입소전',   no: 1, label: '입소 전 업무',                          fam: 'work' },
  { tag: '제출서류', no: 2, label: '제출 서류 확인',                        fam: 'docs' },
  { tag: '입소서류', no: 3, label: '입소 서류 확인',                        fam: 'docs' },
  { tag: '기초의료', no: 4, label: '기초 · 의료 대상자',                    fam: 'cond' },
  { tag: '신체제재', no: 5, label: '신체 제재 대상자',                      fam: 'cond' },
  { tag: '전산',     no: 6, label: '롱텀 · 희망이음 · 구글 · 케어포 · 관리자', fam: 'it' },
  { tag: '당일',     no: 7, label: '입소 당일 업무',                        fam: 'work' },
  { tag: '다음날',   no: 8, label: '입소 후 다음날 업무',                    fam: 'work' },
  { tag: '욕창',     no: 9, label: '욕창 대상자',                            fam: 'cond' },
  { tag: '희망이음', no: 10, label: '퇴소 — 희망이음',                        fam: 'it' },
  { tag: '롱텀케어', no: 11, label: '퇴소 — 롱텀케어',                        fam: 'it' },
] as const).map(g => ({ ...g, accent: FAM[g.fam].accent, bar: FAM[g.fam].bar }))
const TAG_RE = new RegExp(`^\\[(${CL_GROUPS.map(g => g.tag).join('|')})\\]\\s*`)
/** 담당 팀 — 배정된 직종으로 가른다 (인쇄 쪽 teamOf 와 같은 규칙) */
const TEAMS = [
  { key: '간호', label: '간호팀',   dot: 'bg-rose-500',  on: 'bg-rose-600 border-rose-600' },
  { key: '물리', label: '물리치료', dot: 'bg-blue-500',  on: 'bg-blue-600 border-blue-600' },
  { key: '복지', label: '복지팀',   dot: 'bg-teal-500',  on: 'bg-teal-600 border-teal-600' },
] as const
const teamKeyOf = (c: any) =>
  c.assignee === '간호팀' ? '간호' : c.assignee === '물리치료사' ? '물리' : '복지'

/** '[오경애] [전산] 상담 4회차' → { tag: '전산', text: '상담 4회차' } */
function splitClTitle(title: string): { tag: string | null; text: string } {
  let t = title.replace(/^\[[^\]]+\]\s*/, '')   // 이름 프리픽스 제거
  const m = t.match(TAG_RE)
  if (m) return { tag: m[1], text: t.replace(TAG_RE, '') }
  return { tag: null, text: t }
}

function Sec({ icon: Icon, title, children, right, className = '' }: { icon: any; title: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-teal-600" />
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  )
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start gap-2 py-1">
    <span className="w-20 shrink-0 text-xs text-gray-400 pt-0.5">{k}</span>
    <span className="text-sm text-gray-800 font-medium">{v ?? <span className="text-gray-300">—</span>}</span>
  </div>
)

export default function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { residents, checklists, loaded, loadAll, toggleComplete, updateChecklist } = useLtcStore()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingCl, setEditingCl] = useState<ChecklistItem | null>(null)
  const [editingRes, setEditingRes] = useState(false)
  const [batchTag, setBatchTag] = useState<string | null>(null)   // 영역 전체 체크 진행 중
  const [doc, setDoc] = useState<ResidentDoc | null>(null)
  const [assign, setAssign] = useState<AssignRow | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    if (!id) return
    setSubLoading(true)
    Promise.all([
      residentDocAPI.list(true).then(rows => rows.find(d => d.resident_id === id) ?? null).catch(() => null),
      assignmentAPI.roster().then(r => r.rows.find(x => x.resident_id === id) ?? null).catch(() => null),
    ]).then(([d, a]) => { setDoc(d); setAssign(a) }).finally(() => setSubLoading(false))
  }, [id])

  const r = residents.find(x => x.id === id)
  // 퇴소자는 입소 체크리스트를 숨기고 퇴소 업무만 보여준다
  const cls = useMemo(() => checklists.filter(c => c.personId === id
    && (r?.status !== 'discharged' || c.frequency === 'on_discharge')), [checklists, id, r?.status])
  const done = cls.filter(isItemDone).length

  // 체크리스트 보기 — 스무 개 넘는 항목에서 '아직 안 한 것'만 빨리 보려고 둔다.
  // 거르는 것은 보기일 뿐이라 체크·전체 체크는 원래 항목 그대로 동작한다.
  const [onlyLeft, setOnlyLeft] = useState(false)
  const [partTag, setPartTag] = useState<string | null>(null)   // null = 전체 파트
  const [teamKey, setTeamKey] = useState<string | null>(null)   // null = 전체 팀

  if (!loaded) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-300" /></div>
  if (!r) return (
    <div className="p-6 text-center text-gray-400">
      <p className="text-sm">수급자를 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/eval/residents')} className="mt-3 text-sm font-bold text-teal-600 hover:underline">← 수급자 관리로</button>
    </div>
  )

  const cert = currentCert((doc?.certifications as any) ?? [])
  const st = cert ? certState(cert) : null
  const dEnd = st?.daysToEnd ?? null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/eval/residents')}
          className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50"><ArrowLeft size={16} /></button>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${r.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>{r.name[0]}</div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{r.name}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-green-100 text-green-700' : r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {r.status === 'active' ? '입소 중' : r.status === 'pending' ? '입소 예정' : '퇴소'}
            </span>
            {(r.floor || r.room) && (
              <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                {r.floor}{r.room ? ` ${r.room}호` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{r.gender === 'female' ? '여' : '남'} · 만 {calcAge(r.birthDate)}세 · 입소 {r.admissionDate}{r.dischargeDate && ` · 퇴소 ${r.dischargeDate}${(r as any).dischargeTime ? ` ${(r as any).dischargeTime}` : ''}`}</p>
        </div>
        <button onClick={() => setEditingRes(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
          <Pencil size={13} /> 수정
        </button>
      </div>

      {/* 체크리스트 — 영역별 구분 · 전체 체크 · 담당자 표시 */}
      <Sec icon={CalendarDays} title={`${r.status === 'discharged' ? '퇴소 업무 체크리스트' : '입소 (서류/준비) 체크리스트'} ${cls.length ? `— 전체 ${done}/${cls.length}` : ''}`}
        right={cls.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-36 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-2 rounded-full transition-all ${done === cls.length ? 'bg-green-500' : 'bg-teal-400'}`} style={{ width: `${cls.length ? (done / cls.length) * 100 : 0}%` }} />
            </div>
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[11px] font-bold hover:bg-gray-50">
              <Printer size={11} /> 출력
            </button>
          </div>
        ) : undefined}>
        {cls.length > 0 && (
          <p className="flex items-center gap-3 text-[10.5px] text-gray-400 mb-3 -mt-1">
            {Object.values(FAM).map(f => (
            <span key={f.name} className="inline-flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${f.dot}`} /> {f.name}
            </span>
            ))}
            <span className="w-px h-3 bg-gray-200" />
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> 간호팀</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 물리치료사</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" /> 복지팀</span>
          </p>
        )}
        {cls.length > 0 && (() => {
          // 파트 단추 — 남은 건수를 같이 보여줘야 어디부터 볼지 정할 수 있다
          const parts = CL_GROUPS
            .map(g => ({ ...g, items: cls.filter(c => splitClTitle(c.title).tag === g.tag) }))
            .filter(g => g.items.length > 0)
          const etcN = cls.filter(c => splitClTitle(c.title).tag === null)
          if (etcN.length) parts.push({ tag: '', no: parts.length + 1, label: '기타',
            accent: 'text-gray-600 bg-gray-50 border-gray-200', bar: 'bg-gray-300', items: etcN } as any)
          const leftOf = (list: typeof cls) => list.filter(c => !isItemDone(c)).length
          return (
            <div className="flex flex-wrap items-center gap-1.5 mb-3 print:hidden">
              <button type="button" onClick={() => setOnlyLeft(v => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  onlyLeft ? 'bg-amber-500 border-amber-500 text-white'
                           : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {onlyLeft ? '✓ ' : ''}안 된 것만 {cls.length - done}건
              </button>
              <span className="w-px h-4 bg-gray-200 mx-0.5" />
              <button type="button" onClick={() => setPartTag(null)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  partTag === null ? 'bg-gray-800 border-gray-800 text-white'
                                   : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                전체
              </button>
              {parts.map(g => {
                const left = leftOf(g.items as any)
                return (
                  <button key={g.tag || '기타'} type="button"
                    onClick={() => setPartTag(t => t === g.tag ? null : g.tag)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                      partTag === g.tag ? 'bg-gray-800 border-gray-800 text-white'
                        : left === 0 ? 'border-gray-100 text-gray-300 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {g.label}
                    <span className={`ml-1 font-black ${
                      partTag === g.tag ? 'text-white/70' : left === 0 ? 'text-green-500' : 'text-amber-600'}`}>
                      {left === 0 ? '✓' : left}
                    </span>
                  </button>
                )
              })}

              {/* 팀별 — '우리 팀이 해야 할 것'만 보려고 쓴다. 파트 필터와 같이 걸린다 */}
              <span className="w-full h-0 md:hidden" />
              <span className="w-px h-4 bg-gray-200 mx-0.5 hidden md:inline-block" />
              {TEAMS.map(t => {
                const list = cls.filter(c => teamKeyOf(c) === t.key)
                if (list.length === 0) return null
                const left = leftOf(list as any)
                const on = teamKey === t.key
                return (
                  <button key={t.key} type="button"
                    onClick={() => setTeamKey(k => k === t.key ? null : t.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                      on ? `${t.on} text-white`
                        : left === 0 ? 'border-gray-100 text-gray-300 hover:bg-gray-50'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <span className={`w-2 h-2 rounded-full ${on ? 'bg-white/70' : t.dot}`} />
                    {t.label}
                    <span className={`font-black ${
                      on ? 'text-white/70' : left === 0 ? 'text-green-500' : 'text-amber-600'}`}>
                      {left === 0 ? '✓' : left}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}
        {cls.length === 0 ? (
          <p className="text-xs text-gray-400">연결된 체크리스트가 없습니다.</p>
        ) : (() => {
          const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
          // 진행률은 늘 전체 기준으로 낸다 — 걸러 놓고 '3/3 완료'로 보이면 안 된다
          const allGroups = CL_GROUPS
            .map(g => ({ ...g, items: cls.filter(c => splitClTitle(c.title).tag === g.tag) }))
            .filter(g => g.items.length > 0)
          const etcAll = cls.filter(c => splitClTitle(c.title).tag === null)
          if (etcAll.length) allGroups.push({ tag: '', no: allGroups.length + 1, label: '기타', accent: 'text-gray-600 bg-gray-50 border-gray-200', bar: 'bg-gray-300', items: etcAll } as any)

          const keep = (c: any) =>
            (!onlyLeft || !isItemDone(c)) && (teamKey === null || teamKeyOf(c) === teamKey)
          const groups = allGroups
            .filter(g => partTag === null || g.tag === partTag)
            .map(g => ({ ...g, shown: g.items.filter(keep) }))
            .filter(g => g.shown.length > 0)
          // 팀을 걸러 보고 있으면 그 팀 것만 체크한다.
          // 안 그러면 간호팀만 보다가 누른 한 번에 복지팀 것까지 완료로 찍힌다.
          const teamLabel = TEAMS.find(t => t.key === teamKey)?.label
          const todoOf = (g: typeof groups[number]) =>
            g.items.filter(c => !isItemDone(c) && (teamKey === null || teamKeyOf(c) === teamKey))
          const checkAll = async (g: typeof groups[number]) => {
            const todo = todoOf(g)
            if (todo.length === 0) return
            if (!confirm(`「${g.label}」${teamLabel ? ` · ${teamLabel}` : ''} 미완료 ${todo.length}건을 전부 완료 처리할까요?\n체크한 담당자로 내 이름이 기록됩니다.`)) return
            setBatchTag(g.tag)
            try { for (const c of todo) await toggleComplete(c.id, true) }
            catch (e: any) { alert(e?.response?.data?.detail ?? '일괄 처리 중 오류') }
            finally { setBatchTag(null) }
          }
          if (groups.length === 0) return (
            <p className="text-xs text-gray-400 text-center py-6">
              {onlyLeft
                ? (teamKey ? `${TEAMS.find(t => t.key === teamKey)?.label}이 할 일은 모두 마쳤어요`
                   : partTag === null ? '남은 항목이 없습니다 — 모두 마쳤어요' : '이 파트는 모두 마쳤어요')
                : '해당하는 항목이 없습니다'}
              <button type="button" onClick={() => { setOnlyLeft(false); setPartTag(null); setTeamKey(null) }}
                className="ml-2 font-bold text-teal-600 hover:underline">전체 보기</button>
            </p>
          )
          return (
            <div className="space-y-4">
            {groups.map(g => {
              const gd = g.items.filter(isItemDone).length
              const allDone = gd === g.items.length
              return (
                <div key={g.tag || '기타'}>
                  {/* 영역 머리 — 번호·이름·진행률·전체 체크 */}
                  <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg border ${g.accent}`}>{g.no}. {g.label}</span>
                  <span className={`text-[11px] font-bold ${allDone ? 'text-green-600' : 'text-gray-400'}`}>{gd}/{g.items.length}{allDone && ' ✓'}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[40px]">
                    <div className={`h-1.5 rounded-full transition-all ${allDone ? 'bg-green-400' : g.bar}`} style={{ width: `${(gd / g.items.length) * 100}%` }} />
                  </div>
                  {todoOf(g).length > 0 && (
                    <button type="button" onClick={() => checkAll(g)} disabled={batchTag !== null}
                      className="shrink-0 text-[11px] font-bold text-teal-600 border border-teal-200 px-2 py-1 rounded-lg hover:bg-teal-50 disabled:opacity-40">
                      {batchTag === g.tag ? <Loader2 size={11} className="animate-spin" /> : '전체 체크'}
                    </button>
                  )}
                  </div>
                  {/* 항목 — 가로 풀폭 행 (거른 결과만 그린다) */}
                  <ul className="space-y-1">
                  {g.shown.map(c => {
                    const ok = isItemDone(c)
                    const late = !ok && !!c.dueDate && c.dueDate < today
                    const dday = c.dueDate ? Math.round((new Date(c.dueDate).getTime() - new Date(today).getTime()) / 86400000) : null
                    const { text } = splitClTitle(c.title)
                    const team = c.assignee === '간호팀' ? '간호' : c.assignee === '물리치료사' ? '물리'
                      : (c.assignee === '복지팀' || c.assignee === '담당 사회복지사') ? '복지' : null
                    const rowCls = ok ? 'bg-green-50/60 border-green-100'
                      : late ? 'bg-red-50 border-red-100'
                      : team === '간호' ? 'bg-rose-50/70 border-rose-300'
                      : team === '물리' ? 'bg-blue-50/70 border-blue-300'
                      : team === '복지' ? 'bg-teal-50/60 border-teal-200'
                      : c.riskLevel === 'high' ? 'bg-rose-50 border-rose-200'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                    return (
                      <li key={c.id} className={`flex items-center gap-2.5 pl-2.5 pr-2 py-2 rounded-xl border text-xs transition-colors ${rowCls}`}>
                        {/* 체크 토글 */}
                        <button type="button" disabled={busyId === c.id || batchTag !== null}
                        onClick={async () => {
                          setBusyId(c.id)
                          try { await toggleComplete(c.id, !ok) }
                          catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
                          finally { setBusyId(null) }
                        }}
                        title={ok ? '완료 취소' : '완료 처리'}
                        className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${ok ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400 bg-white'} ${busyId === c.id ? 'opacity-40' : ''}`}>
                        {ok && <span className="text-white text-[11px] font-black leading-none">✓</span>}
                        </button>
                        {team && (
                        <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white ${team === '간호' ? 'bg-rose-500' : team === '물리' ? 'bg-blue-500' : 'bg-teal-500'}`}>{team}</span>
                        )}
                        <span className={`flex-1 min-w-0 truncate text-[12.5px] ${ok ? 'line-through text-gray-400' : team === '간호' ? 'font-bold text-rose-800' : team === '물리' ? 'font-bold text-blue-800' : team === '복지' ? 'font-semibold text-teal-900' : 'font-semibold text-gray-700'}`} title={text}>
                        {text}
                        </span>
                        {/* 담당자 — 명확하게 */}
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
                        title="기한 설정 — 비우면 기한 없음"
                        className="shrink-0 w-[8.2rem] px-1.5 py-1 text-[11px] border border-gray-200 rounded-lg bg-white text-gray-500 hidden sm:block" />
                        <button type="button" onClick={() => setEditingCl(c)} title="항목 수정"
                        className="shrink-0 p-1 text-gray-300 hover:text-gray-600 rounded"><Pencil size={12} /></button>
                        {!c.active && <span className="shrink-0 text-[9px] text-gray-400">중단</span>}
                      </li>
                    )
                  })}
                  </ul>
                </div>
              )
            })}
            </div>
          )
        })()}
      </Sec>

      <div className="grid md:grid-cols-2 gap-3">
        {/* 기본 정보 */}
        <Sec icon={UserRound} title="기본 정보">
          <Row k="생년월일" v={`${r.birthDate} (만 ${calcAge(r.birthDate)}세)`} />
          <Row k="입소일" v={`${r.admissionDate}${(r as any).admissionTime ? ` ${(r as any).admissionTime}` : ''}`} />
          <Row k="종교" v={r.religion || null} />
          <Row k="프로그램" v={
            GRP.some(([, key]) => (r as any)[key]) ? (
              <span className="flex gap-1.5 flex-wrap">
                {GRP.map(([label, key, cls2]) => (r as any)[key] && (
                  <span key={key} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls2}`}>{label} {(r as any)[key]}그룹</span>
                ))}
              </span>
            ) : null
          } />
          <Row k="메모" v={r.memo || null} />
        </Sec>

        {/* 담당자 */}
        <Sec icon={HeartHandshake} title="담당자" right={
          <button onClick={() => navigate('/assignments')} className="text-[11px] font-bold text-teal-600 hover:underline">담당 명단 ›</button>
        }>
          {subLoading ? <Loader2 size={14} className="animate-spin text-gray-300" /> : (
            <>
              <Row k="요양팀" v={assign?.care_staff_name || null} />
              <Row k="재활팀" v={assign?.rehab_staff_name || null} />
              <Row k="호실" v={assign ? `${assign.floor} ${assign.room}호` : (r.floor ? `${r.floor}${r.room ? ` ${r.room}호` : ''}` : null)} />
              {assign?.note && <Row k="비고" v={assign.note} />}
            </>
          )}
        </Sec>

        {/* 서류 현황 */}
        <Sec icon={FileText} title="서류 현황" right={
          <button onClick={() => navigate('/resident-docs')} className="text-[11px] font-bold text-teal-600 hover:underline">서류현황 페이지 ›</button>
        }>
          {subLoading ? <Loader2 size={14} className="animate-spin text-gray-300" /> : !doc ? (
            <p className="text-xs text-gray-400">서류현황에 연동된 행이 없습니다.</p>
          ) : (
            <>
              <Row k="등급" v={cert ? gradeLabel(cert) : (doc.grade ? `${doc.grade}등급` : null)} />
              <Row k="인정서" v={cert ? (
                <span>
                  {fmtD(cert.start)} ~ {fmtD(cert.end)}
                  {dEnd != null && (
                    <span className={`ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded ${st?.status === 'expired' ? 'bg-red-100 text-red-600' : st?.status === 'renew' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {dEnd < 0 ? `만료 ${-dEnd}일 지남` : `D-${dEnd}`}
                    </span>
                  )}
                </span>
              ) : null} />
              <Row k="급여" v={doc.care_type || null} />
              <Row k="계약서" v={(doc.contract_lines ?? []).length ? (doc.contract_lines ?? []).map(e => fmtD((e as any).date)).join(' · ') : null} />
              <Row k="계획서" v={(doc.plan_lines ?? []).length ? (doc.plan_lines ?? []).map(e => fmtD((e as any).date)).join(' · ') : null} />
              <Row k="평가" v={(doc.eval_lines ?? []).length ? (doc.eval_lines ?? []).map(e => fmtD((e as any).date)).join(' · ') : null} />
            </>
          )}
        </Sec>

      </div>

      {/* ── 인쇄 전용: 체크리스트 전체를 A4 한 장에 ── */}
      <style>{`@media print {
        @page { size: A4 portrait; margin: 7mm; }
        body * { visibility: hidden; }
        #cl-print, #cl-print * { visibility: visible; }
        #cl-print { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        #cl-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`}</style>
      {cls.length > 0 && (() => {
        const groups = CL_GROUPS
          .map(g => ({ ...g, items: cls.filter(c => splitClTitle(c.title).tag === g.tag) }))
          .filter(g => g.items.length > 0)
        const etc = cls.filter(c => splitClTitle(c.title).tag === null)
        if (etc.length) groups.push({ tag: '', no: groups.length + 1, label: '기타', fam: 'work', accent: '', bar: '', items: etc } as any)
        // 계열별 파스텔 팔레트 — 인쇄에서 부드럽게
        const FAMP: Record<string, { bg: string; edge: string; text: string }> = {
          work: { bg: '#eff8ff', edge: '#38bdf8', text: '#075985' },
          docs: { bg: '#eef2ff', edge: '#818cf8', text: '#3730a3' },
          it:   { bg: '#f5f3ff', edge: '#a78bfa', text: '#5b21b6' },
          cond: { bg: '#fff7ed', edge: '#fb923c', text: '#9a3412' },
        }
        const teamOf = teamKeyOf
        const TEAMC: Record<string, { c: string; bg: string }> = {
          간호: { c: '#be123c', bg: '#ffe4e6' }, 물리: { c: '#1d4ed8', bg: '#dbeafe' }, 복지: { c: '#0f766e', bg: '#ccfbf1' },
        }
        const pct = cls.length ? Math.round((done / cls.length) * 100) : 0
        const teamStat = (['간호', '물리', '복지'] as const).map(t => {
          const list = cls.filter(c => teamOf(c) === t)
          return { t, d: list.filter(isItemDone).length, n: list.length }
        }).filter(x => x.n > 0)
        return (
          <div id="cl-print" className="hidden bg-white" style={{ fontFamily: 'inherit' }}>
            {/* ── 머리글: 좌 상아이덴티티 · 우 진행 요약 ── */}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginBottom: 7 }}>
              <div style={{ width: 4, borderRadius: 3, background: 'linear-gradient(#14b8a6, #0d9488)' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 7.5, fontWeight: 800, color: '#0d9488', letterSpacing: '0.22em', margin: 0 }}>
                  행복한요양원 녹양역점 · 입소 (서류/준비) 체크리스트
                </p>
                <p style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '1px 0 0', letterSpacing: '0.02em' }}>
                  {r.name}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginLeft: 7 }}>
                    {r.gender === 'female' ? '여' : '남'} · 만 {calcAge(r.birthDate)}세
                    {(r.floor || r.room) && ` · ${r.floor ?? ''}${r.room ? ` ${r.room}호` : ''}`} · 입소 {r.admissionDate}
                  </span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: pct === 100 ? '#16a34a' : '#0d9488', lineHeight: 1 }}>
                  {pct}<span style={{ fontSize: 9 }}>%</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', marginLeft: 4 }}>{done}/{cls.length} 완료</span>
                </p>
                <div style={{ width: 130, height: 5, background: '#f1f5f9', borderRadius: 3, marginTop: 3, marginLeft: 'auto', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: 5, borderRadius: 3, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg,#2dd4bf,#0d9488)' }} />
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 7, color: '#94a3b8' }}>출력 {new Date().toLocaleDateString('ko-KR')}</p>
              </div>
            </div>

            {/* ── 팀 요약 칩 ── */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
              {teamStat.map(x => (
                <span key={x.t} style={{
                  fontSize: 7.5, fontWeight: 800, color: TEAMC[x.t].c, background: TEAMC[x.t].bg,
                  border: `0.8px solid ${TEAMC[x.t].c}33`, borderRadius: 999, padding: '2px 8px',
                }}>
                  {x.t === '간호' ? '간호팀' : x.t === '물리' ? '물리치료사' : '복지팀'} {x.d}/{x.n}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 7, color: '#94a3b8', alignSelf: 'center' }}>
                ✓ 완료(담당자 · 날짜) · <span style={{ color: '#b45309', fontWeight: 700 }}>~날짜</span> = 기한
              </span>
            </div>

            {/* ── 본문: 2단 컬럼 ── */}
            <div style={{ columnCount: 2, columnGap: 14 }}>
              {groups.map(g => {
                const pal = FAMP[(g as any).fam] ?? { bg: '#f8fafc', edge: '#94a3b8', text: '#334155' }
                const gd = g.items.filter(isItemDone).length
                return (
                  <div key={g.tag || '기타'} style={{ marginBottom: 6 }}>
                    <div style={{
                      breakInside: 'avoid', breakAfter: 'avoid', display: 'flex', alignItems: 'center', gap: 4,
                      background: pal.bg, borderLeft: `3px solid ${pal.edge}`, borderRadius: '3px 6px 6px 3px',
                      padding: '2.5px 6px', marginBottom: 2.5,
                    }}>
                      <span style={{ fontSize: 8.5, fontWeight: 900, color: pal.text }}>{g.no}. {g.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 7, fontWeight: 800, color: gd === g.items.length ? '#16a34a' : pal.text, opacity: 0.75 }}>
                        {gd === g.items.length ? '✓ 완료' : `${gd}/${g.items.length}`}
                      </span>
                    </div>
                    {g.items.map(c => {
                      const ok = isItemDone(c)
                      const t = teamOf(c)
                      return (
                        <div key={c.id} style={{
                          breakInside: 'avoid', display: 'flex', alignItems: 'flex-start', gap: 3.5,
                          padding: '1.4px 2px 1.4px 4px', fontSize: 7.6, lineHeight: 1.35,
                          borderBottom: '0.5px solid #f1f5f9',
                          background: ok ? '#fafffe' : 'transparent',
                        }}>
                          <span style={{
                            width: 8.5, height: 8.5, marginTop: 0.8, flexShrink: 0, borderRadius: 2.5,
                            border: `1.2px solid ${ok ? '#16a34a' : '#cbd5e1'}`,
                            background: ok ? '#16a34a' : 'white',
                            color: 'white', fontSize: 6.5, fontWeight: 900,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>{ok ? '✓' : ''}</span>
                          <span style={{
                            flexShrink: 0, fontSize: 6.2, fontWeight: 800, marginTop: 1,
                            color: TEAMC[t].c, background: TEAMC[t].bg, borderRadius: 3, padding: '0 3px',
                          }}>{t}</span>
                          <span style={{ flex: 1, color: ok ? '#94a3b8' : '#1e293b', textDecoration: ok ? 'line-through' : 'none', fontWeight: 600 }}>
                            {splitClTitle(c.title).text}
                          </span>
                          <span style={{ flexShrink: 0, fontSize: 6.4, fontWeight: 700, marginTop: 0.8,
                            color: ok ? '#16a34a' : c.dueDate ? '#b45309' : '#cbd5e1' }}>
                            {ok ? `${(c as any).completedBy ?? ''}${c.completedDate ? ` · ${Number(c.completedDate.slice(5, 7))}/${Number(c.completedDate.slice(8, 10))}` : ''}`
                              : c.dueDate ? `~${Number(c.dueDate.slice(5, 7))}/${Number(c.dueDate.slice(8, 10))}` : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* ── 확인 서명란 ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
              {['복지팀', '간호팀', '시설장'].map(role => (
                <div key={role} style={{ width: 76, border: '0.8px solid #e2e8f0', borderRadius: 6, padding: '3px 6px 10px' }}>
                  <p style={{ margin: 0, fontSize: 6.5, fontWeight: 800, color: '#64748b' }}>{role} 확인</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 6.2, color: '#cbd5e1', textAlign: 'center', margin: '4px 0 0' }}>
              행복한요양원 관리자 페이지에서 자동 생성된 문서입니다
            </p>
          </div>
        )
      })()}

      {editingCl && <ChecklistFormModal existing={editingCl} onClose={() => setEditingCl(null)} />}
      {editingRes && <ResidentForm existing={r} onClose={() => setEditingRes(false)} />}

      {/* 하단 바로가기 */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => navigate('/programs')} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 inline-flex items-center gap-1.5">
          <BedDouble size={12} /> 프로그램 분류에서 보기
        </button>
        <button onClick={() => navigate('/eval/albums')} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">보호자 앨범 ›</button>
        <button onClick={() => navigate('/incidents')} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">낙상·사고 보고서 ›</button>
      </div>
    </div>
  )
}

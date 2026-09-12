import { useEffect, useState } from 'react'
import { X, History, Loader2, RotateCcw, Clock, ChevronDown } from 'lucide-react'
import { workScheduleAPI, type ScheduleVersion, type ScheduleVersionFull } from '@/api/workScheduleClient'

const fmtDay = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d)
}
const fmtTime = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}
const dayLabel = (day: string) => {
  if (!day) return ''
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
  const yest = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() - 86400000))
  const [, m, d] = day.split('-')
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${day}T00:00:00+09:00`).getDay()]
  const base = `${Number(m)}월 ${Number(d)}일(${w})`
  return day === today ? `오늘 · ${base}` : day === yest ? `어제 · ${base}` : base
}

/**
 * 근무표 저장 이력 — 되돌릴 시점을 고른다.
 *
 * ■ 하루에 한 줄로 보여준다
 *
 *   근무표는 한 번 앉아서 고칠 때 열 번도 저장한다. 그걸 다 늘어놓으면
 *   한 달에 수백 줄이 되고, 정작 '며칠 자 표로 돌아가고 싶다' 를 못 찾는다.
 *   그래서 날짜마다 한 줄만 내놓는다 — 그날 마지막 저장본이다.
 *
 *   중간 저장본은 지우지 않는다. 「그날 저장 N번」 을 누르면 펼쳐진다.
 *   '아까 실수로 지운 것' 을 되돌릴 길까지 없애면 안 된다.
 */
export default function ScheduleHistoryModal({ month, onClose, onLoad }: {
  month: string
  onClose: () => void
  onLoad: (v: ScheduleVersionFull) => void
}) {
  const [list, setList] = useState<ScheduleVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    workScheduleAPI.versions(month).then(setList).catch(() => setList([])).finally(() => setLoading(false))
  }, [month])

  const load = async (v: ScheduleVersion) => {
    if (!confirm(`${dayLabel(fmtDay(v.saved_at))} ${fmtTime(v.saved_at)} 저장본을 불러올까요?\n\n화면에만 적용되며, 저장을 눌러야 확정됩니다.`)) return
    setBusy(v.id)
    try {
      onLoad(await workScheduleAPI.version(v.id))
      onClose()
    } catch (e: any) { alert(e?.message ?? '불러오기 실패') } finally { setBusy(null) }
  }

  // 날짜별로 묶는다. 목록은 최신순이라 각 묶음의 첫 줄이 그날 마지막 저장본이다.
  const groups: [string, ScheduleVersion[]][] = []
  for (const v of list) {
    const d = fmtDay(v.saved_at)
    const last = groups[groups.length - 1]
    if (last && last[0] === d) last[1].push(v); else groups.push([d, [v]])
  }
  const [y, m] = month.split('-').map(Number)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (d: string) => setOpen(p => {
    const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-indigo-600" />
            <h3 className="font-bold text-gray-900">{y}년 {m}월 저장 이력</h3>
            {list.length > 0 && (
              <span className="text-[11px] text-gray-400">{groups.length}일 · {list.length}번 저장</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
          ) : list.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-12 px-6 leading-relaxed">
              저장 이력이 없습니다.<br />
              근무표를 저장할 때마다 그 시점이 기록되어, 나중에 되돌릴 수 있습니다.
            </p>
          ) : (
            groups.map(([day, items]) => {
              // 그날 마지막 저장본만 기본으로. 나머지는 펼쳐야 보인다.
              const shown = open.has(day) ? items : items.slice(0, 1)
              const hidden = items.length - shown.length
              return (
                <div key={day}>
                  <div className="sticky top-0 z-10 bg-gray-50 border-y border-gray-100 px-5 py-1.5 flex items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-gray-600">{dayLabel(day)}</span>
                    <span className="text-[10.5px] text-gray-400">저장 {items.length}번</span>
                    {/* 펼칠 때는 아래 '더 보기' 가 있으니 여기엔 접기만 둔다 —
                        같은 일을 하는 버튼이 한 화면에 둘 있으면 어느 쪽을
                        눌러야 하는지 잠깐 멈칫하게 된다 */}
                    {items.length > 1 && open.has(day) && (
                      <button onClick={() => toggle(day)}
                        className="ml-auto text-[10.5px] font-bold text-indigo-600 inline-flex items-center gap-0.5 hover:underline">
                        접기 <ChevronDown size={11} className="rotate-180" />
                      </button>
                    )}
                  </div>
                  <ul>
                    {shown.map((v, i) => {
                      const newest = list[0]?.id === v.id
                      const dayLast = i === 0 && !open.has(day) && items.length > 1
                      return (
                        <li key={v.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Clock size={11} className="text-gray-300 shrink-0" />
                              <span className="text-[13px] font-semibold text-gray-800 tabular-nums">{fmtTime(v.saved_at)}</span>
                              {newest && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">현재</span>}
                              {dayLast && !newest && <span className="text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">그날 마지막</span>}
                              <span className="text-[11px] text-gray-400 ml-auto">{v.saved_by ?? '알 수 없음'}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              근무 {v.cells}칸
                              {v.changed > 0 && <span className="text-indigo-600 font-semibold"> · {v.changed}칸 변경</span>}
                              {v.base_hours && <span className="text-gray-400"> · 기준 {v.base_hours}시간</span>}
                            </p>
                          </div>
                          <button onClick={() => load(v)} disabled={busy === v.id || newest}
                            title={newest ? '현재 화면과 같은 저장본입니다' : '이 시점으로 되돌리기'}
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1.5 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed">
                            {busy === v.id ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} /> 불러오기</>}
                          </button>
                        </li>
                      )
                    })}
                    {hidden > 0 && (
                      <li className="px-5 py-1.5">
                        <button onClick={() => toggle(day)} className="text-[11px] text-gray-400 hover:text-indigo-600">
                          그날 중간 저장 {hidden}개 더 보기 ▾
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        <div className="px-5 py-3 border-t shrink-0">
          <p className="text-[11px] text-gray-400">
            날짜마다 <b className="text-gray-500">그날 마지막 저장본</b>을 보여드립니다 · 중간 저장본은 펼치면 나옵니다.<br />
            불러오면 화면에만 적용됩니다. 확인 후 <b className="text-gray-500">저장</b>을 눌러야 확정되고, 되돌린 내용도 새 이력으로 남습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

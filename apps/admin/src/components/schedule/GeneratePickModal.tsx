import { useMemo, useState } from 'react'
import { X, Sparkles, CheckSquare, Square } from 'lucide-react'
import { canJoinTeam, TEAM_BAND, type StaffRow } from './shared'
import { filterByFloor, countHiddenNoFloor } from '@/utils/floorFilter'

/**
 * 자동 생성 대상 선택 — 전원이 기본이지만, 빼야 할 사람이 있다.
 * (장기 병가, 이번 달만 다른 스케줄, 수습 중이라 따로 짜는 경우 등)
 * 뺀 사람의 칸은 자동 생성이 전혀 건드리지 않는다.
 */
export default function GeneratePickModal({ staff, onClose, onConfirm, title = '자동 생성 대상', verb = '생성', hint = '뺀 사람의 근무 칸은 그대로 둡니다', floorStrict = false }: {
  staff: StaffRow[]
  onClose: () => void
  onConfirm: (ids: Set<string>) => void
  title?: string
  verb?: string
  hint?: string
  /** 「N층만」이 그 층으로 나뉜 조(요양보호사)만 고른다 — 층 없는 직종은 빼고.
   *  인쇄에서 쓴다: 2층 벽보에는 2층 조만 올라간다. */
  floorStrict?: boolean
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(staff.map(s => s.id)))

  /** 표에 실제로 쓰인 층 — 아무도 없는 층은 버튼을 내지 않는다.
   *  인쇄(floorStrict)에서는 층이 붙은 주간 근무자(사회복지사·물리치료사·간호팀장 등)의 층도 센다. */
  const floors = useMemo(() => {
    const set = new Set<string>()
    staff.forEach(s => { if ((floorStrict || canJoinTeam(s.pos)) && s.floor) set.add(s.floor) })
    return [...set].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
  }, [staff, floorStrict])

  const [floorNote, setFloorNote] = useState<{ floor: string; hidden: number; others: number } | null>(null)

  /** 층 하나만 고른다 — 두 가지 규칙이 있다.
   *
   *  · 기본(자동 생성): 화면 층 필터(utils/floorFilter)와 같은 규칙. 그 층
   *    요양보호사에 더해 층이 없는 직종(간호·사회복지·치료)도 남긴다.
   *  · floorStrict(인쇄): 조 편성에서 그 층을 맡은 사람만 고른다 — 그 층으로
   *    나뉜 조(요양보호사)와, 그 층이 지정된 주간 근무자(사회복지사·물리치료사·
   *    간호팀장 등). 층이 없는 사람은 어느 층 벽보에도 자동으로 들어가지 않는다.
   *
   *  인쇄만 다른 이유: 벽보는 그 층 사람들을 위한 것이다. 층이 없는 직종 줄이
   *  층마다 반복해 붙으면 그 층 인원이 한눈에 안 들어온다. 화면(shownStaff)은
   *  여전히 filterByFloor 를 쓰므로 화면과 인쇄가 일부러 다르다.
   */
  const pickFloor = (f: string) => {
    const ids = floorStrict
      ? staff.filter(s => (s.floor || '') === f).map(s => s.id)
      : filterByFloor(staff, f, canJoinTeam).map(s => s.id)
    setPicked(new Set(ids))
    // 층을 지정 안 한 요양보호사는 어느 층 벽보에도 안 나온다.
    // 조용히 빠지면 그 선생님만 근무표가 없는 채로 한 달을 보낸다.
    // 인쇄(floorStrict)에서는 층 없는 주간 근무자도 빠지므로 그 수까지 보여준다.
    setFloorNote({
      floor: f,
      hidden: countHiddenNoFloor(staff, f, canJoinTeam),
      others: floorStrict ? staff.filter(s => !canJoinTeam(s.pos) && !s.floor).length : 0,
    })
  }

  // 조별 → 주간 순으로 묶어서 보여준다 (근무표와 같은 눈높이).
  // 층으로 나뉜 조는 층까지 붙여 따로 묶는다 — '2층 A조' 와 '3층 A조' 는 다른 조다.
  const groups = useMemo(() => {
    const g = new Map<string, StaffRow[]>()
    for (const s of staff) {
      const cg = canJoinTeam(s.pos)
      // 인쇄에서는 층이 붙은 주간 근무자도 그 층 아래 보인다 — '2층 주간 · 사회복지사'
      const key = cg && s.team && s.team !== '주간'
        ? (floorStrict ? `${s.floor || '층 미지정'} ${s.team}` : s.team)
        : (floorStrict && s.floor ? `${s.floor} 주간 · ${s.pos || '기타'}` : `주간 · ${s.pos || '기타'}`)
      if (!g.has(key)) g.set(key, [])
      g.get(key)!.push(s)
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko', { numeric: true }))
  }, [staff, floorStrict])

  const toggle = (id: string) => setPicked(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const toggleGroup = (rows: StaffRow[]) => setPicked(prev => {
    const n = new Set(prev)
    const allOn = rows.every(r => n.has(r.id))
    rows.forEach(r => { if (allOn) n.delete(r.id); else n.add(r.id) })
    return n
  })

  const excluded = staff.length - picked.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" />
            <h3 className="font-bold text-gray-900">{title}</h3>
            <span className="text-[11px] text-gray-400">{picked.size}/{staff.length}명</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-2.5 border-b shrink-0 flex items-center gap-2">
          <button onClick={() => { setPicked(new Set(staff.map(s => s.id))); setFloorNote(null) }}
            className="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">전체 선택</button>
          <button onClick={() => { setPicked(new Set()); setFloorNote(null) }}
            className="text-[11px] font-bold text-gray-400 hover:bg-gray-50 px-2 py-1 rounded">전체 해제</button>
          {floors.length > 0 && (
            <>
              <span className="text-gray-200">|</span>
              {floors.map(f => (
                <button key={f} onClick={() => pickFloor(f)}
                  title={floorStrict
                    ? `조 편성에서 ${f}를 맡은 사람만 고릅니다 — 그 층 조와 그 층이 지정된 주간 근무자`
                    : `${f} 요양보호사 + 층 없는 직종(간호·사회복지 등)만 고릅니다`}
                  className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 px-2 py-1 rounded">
                  {f}만
                </button>
              ))}
            </>
          )}
          <span className="ml-auto text-[11px] text-gray-400">{hint}</span>
        </div>

        {floorNote && (floorNote.hidden > 0 || floorNote.others > 0) && (
          <p className="px-5 py-2 text-[11px] text-amber-800 bg-amber-50 border-b border-amber-200 shrink-0">
            {floorNote.hidden > 0 && <>
              층을 지정하지 않은 요양보호사 <b>{floorNote.hidden}명</b>은 빠졌습니다 —
              어느 층 인쇄물에도 나오지 않으니, 근무표에서 층을 넣어주세요.{' '}
            </>}
            {floorNote.others > 0 && <>
              층이 지정되지 않은 주간 근무자 <b>{floorNote.others}명</b>은 {floorNote.floor} 인쇄물에서 빠집니다 —
              조 편성에서 층을 넣으면 함께 고르고, 지금은 아래에서 체크해 넣을 수 있습니다.
            </>}
          </p>
        )}

        <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3 space-y-3">
          {groups.map(([label, rows]) => {
            const allOn = rows.every(r => picked.has(r.id))
            return (
              <div key={label}>
                <button onClick={() => toggleGroup(rows)}
                  className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-gray-600 hover:text-indigo-600">
                  {allOn ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-gray-300" />}
                  {(() => { const t = label.split(' ').find(w => TEAM_BAND[w]); return t ? <span className={`w-1.5 h-3.5 rounded-sm ${TEAM_BAND[t]}`} /> : null })()}
                  {label} <span className="font-normal text-gray-400">{rows.length}명</span>
                </button>
                <div className="grid grid-cols-2 gap-1">
                  {rows.map(s => (
                    <label key={s.id}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer min-h-[40px] ${picked.has(s.id) ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50/50 opacity-60'}`}>
                      <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="accent-indigo-600" />
                      <span className="text-sm font-semibold text-gray-700 truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-semibold">취소</button>
          <button onClick={() => onConfirm(picked)} disabled={picked.size === 0}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold">
            {excluded > 0 ? `${picked.size}명만 ${verb} (${excluded}명 제외)` : `전원 ${picked.size}명 ${verb}`}
          </button>
        </div>
      </div>
    </div>
  )
}

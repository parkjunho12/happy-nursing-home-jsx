import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import { caregiverDayAPI, type DayTask, type Routine } from '@/api/caregiverDayClient'
import { evalStaffAPI } from '@/api/evalClient'

/**
 * 요양보호사 하루 일정 정하기 — 관리자·시설장.
 *
 * ■ 왜 사람마다 날마다 적지 않는가
 *
 *   요양보호사 스무 명 × 서른 날 = 육백 칸이다. 매달 그걸 채울 사람은 없고,
 *   안 채워진 앱은 한 번 보고 다시 안 본다.
 *
 *   하루를 가르는 것은 사람이 아니라 무슨 근무인가다. 주간은 기상 도움으로
 *   시작하고 야간은 소등과 순회로 흐른다. 그래서 근무별로 한 벌만 만든다.
 *   누가 그날 무슨 근무인지는 근무표가 이미 알고 있으니, 둘을 맞추면 각자의
 *   하루가 저절로 나온다. 한 번 만들면 매달 다시 만들 일이 없다.
 *
 * ■ 오늘만의 일
 *
 *   '오늘 10시 교육', '오늘 2층 대청소' 는 일과표에 넣을 수 없다. 날짜를
 *   붙여 따로 넣고, 앱에서는 노란색 「오늘만」 으로 구분해 보여준다.
 *   늘 하던 것과 같은 색이면 놓친다.
 */
const SHIFTS = [
  { code: 'D',  label: '주간', hint: '08:50~18:00' },
  { code: 'N',  label: '야간', hint: '18:00~익일 09:00' },
  { code: 'M',  label: '모닝', hint: '06:50~16:00' },
  { code: 'AD', label: '오전', hint: '09:00~13:30' },
  { code: 'PD', label: '오후', hint: '13:30~18:00' },
]

const todayISO = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

export default function CaregiverDayPage() {
  const [tab, setTab] = useState<'routine' | 'day'>('routine')

  /* ── 일과표 ── */
  const [shift, setShift] = useState('D')
  const [rows, setRows] = useState<Routine[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  /* ── 그날 일정 ── */
  const [date, setDate] = useState(todayISO())
  const [tasks, setTasks] = useState<DayTask[] | null>(null)
  const [staff, setStaff] = useState<{ id: string; name: string; position?: string | null }[]>([])
  const [nt, setNt] = useState({ staff_id: '', floor: '', start_time: '', title: '', note: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => { caregiverDayAPI.routines().then(r => setRows(r.items)).catch(() => setRows([])) }, [])
  useEffect(() => {
    if (tab !== 'day') return
    setTasks(null)
    caregiverDayAPI.day(date).then(setTasks).catch(() => setTasks([]))
  }, [tab, date])
  useEffect(() => {
    evalStaffAPI.list()
      .then(rs => setStaff(rs.filter((s: any) => (s.status ?? 'active') === 'active'
        && ['요양보호사', '요양팀장'].includes(s.position ?? ''))))
      .catch(() => setStaff([]))
  }, [])

  const mine = useMemo(
    () => (rows ?? []).filter(r => r.shift_code === shift)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [rows, shift])

  const setRow = (r: Routine, patch: Partial<Routine>) =>
    setRows(rs => (rs ?? []).map(x => x === r ? { ...x, ...patch } : x))

  const addRow = () => setRows(rs => [...(rs ?? []), {
    shift_code: shift, floor: '', start_time: '', end_time: '', title: '', note: '',
  }])

  const delRow = (r: Routine) => setRows(rs => (rs ?? []).filter(x => x !== r))

  const save = async () => {
    // 시각과 할 일이 다 있는 줄만 보낸다. 쓰다 만 줄을 저장하면
    // 앱에서 시각 없는 빈 줄이 하루 사이에 끼어 보인다.
    const ready = (rows ?? []).filter(r => /^\d{2}:\d{2}$/.test(r.start_time ?? '') && (r.title ?? '').trim())
    const dropped = (rows ?? []).length - ready.length
    if (dropped > 0 && !confirm(`시각이나 할 일이 비어 있는 ${dropped}줄은 저장하지 않습니다.\n계속할까요?`)) return
    setSaving(true)
    try {
      await caregiverDayAPI.saveRoutines(ready)
      const fresh = await caregiverDayAPI.routines()
      setRows(fresh.items)
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) {
      alert(e?.message ?? '저장에 실패했습니다.')
    } finally { setSaving(false) }
  }

  const addTask = async () => {
    if (!nt.title.trim()) return alert('할 일을 적어주세요.')
    if (nt.start_time && !/^\d{2}:\d{2}$/.test(nt.start_time)) return alert('시각은 09:30 처럼 적어주세요.')
    setAdding(true)
    try {
      const t = await caregiverDayAPI.addDay({
        date, staff_id: nt.staff_id || null, floor: nt.floor || null,
        start_time: nt.start_time || null, title: nt.title.trim(), note: nt.note.trim() || null,
      })
      setTasks(ts => [...(ts ?? []), t])
      setNt({ staff_id: '', floor: '', start_time: '', title: '', note: '' })
    } catch (e: any) {
      alert(e?.message ?? '추가에 실패했습니다.')
    } finally { setAdding(false) }
  }

  const delTask = async (t: DayTask) => {
    if (!confirm(`「${t.title}」 을(를) 지울까요?`)) return
    try {
      await caregiverDayAPI.removeDay(t.id)
      setTasks(ts => (ts ?? []).filter(x => x.id !== t.id))
    } catch (e: any) { alert(e?.message ?? '삭제에 실패했습니다.') }
  }

  const ic = 'px-2 py-1.5 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:border-teal-400'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <CalendarClock size={18} className="text-teal-600" /> 요양보호사 하루 일정
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          여기서 정한 일과가 근무표와 맞춰져 각 선생님 앱 첫 화면에 오늘의 하루로 나옵니다.
        </p>
      </div>

      <div className="flex gap-1.5">
        {([['routine', '근무별 일과표'], ['day', '오늘만의 일정']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${tab === v ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'routine' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {SHIFTS.map(s => (
              <button key={s.code} onClick={() => setShift(s.code)}
                className={`px-3 py-2 rounded-xl border text-sm font-bold ${shift === s.code ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s.label} <span className="font-mono text-[11px] opacity-60">{s.code}</span>
                <span className="block text-[10px] font-medium opacity-60">{s.hint}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {savedAt && <span className="text-[11px] text-emerald-600 font-bold">{savedAt} 저장됨</span>}
              <button onClick={save} disabled={saving || rows === null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 저장
              </button>
            </div>
          </div>

          {rows === null ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] font-bold text-gray-400 text-left">
                    <th className="px-1 py-1 w-20">시작</th>
                    <th className="px-1 py-1 w-20">끝<span className="font-normal">(선택)</span></th>
                    <th className="px-1 py-1">할 일</th>
                    <th className="px-1 py-1 w-24">층</th>
                    <th className="px-1 py-1 w-56">설명<span className="font-normal">(선택)</span></th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {mine.map((r, i) => (
                    <tr key={i}>
                      <td className="px-1 py-1">
                        <input value={r.start_time ?? ''} onChange={e => setRow(r, { start_time: e.target.value })}
                          placeholder="06:50" className={`${ic} w-full tabular-nums`} />
                      </td>
                      <td className="px-1 py-1">
                        <input value={r.end_time ?? ''} onChange={e => setRow(r, { end_time: e.target.value })}
                          placeholder="07:30" className={`${ic} w-full tabular-nums`} />
                      </td>
                      <td className="px-1 py-1">
                        <input value={r.title ?? ''} onChange={e => setRow(r, { title: e.target.value })}
                          placeholder="기상 · 세면 도움" className={`${ic} w-full font-bold`} />
                      </td>
                      <td className="px-1 py-1">
                        {/* 비워두면 모든 층에 들어간다 — 대부분의 일과가 그렇다 */}
                        <select value={r.floor ?? ''} onChange={e => setRow(r, { floor: e.target.value })}
                          className={`${ic} w-full bg-white`}>
                          <option value="">모든 층</option>
                          <option value="2층">2층만</option>
                          <option value="3층">3층만</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input value={r.note ?? ''} onChange={e => setRow(r, { note: e.target.value })}
                          placeholder="" className={`${ic} w-full text-gray-500`} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => delRow(r)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {mine.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">
                  {SHIFTS.find(s => s.code === shift)?.label} 근무의 일과가 아직 없습니다 — 아래에서 한 줄씩 더해주세요.
                </p>
              )}

              <button onClick={addRow}
                className="mt-2 inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-bold text-gray-500 hover:bg-gray-50">
                <Plus size={13} /> 줄 추가
              </button>
              <p className="text-[11px] text-gray-400 mt-2">
                한 번 만들면 매달 다시 만들지 않아도 됩니다 · 근무표에서 그날 {SHIFTS.find(s => s.code === shift)?.label} 근무인 선생님께 자동으로 보입니다
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={ic} />
            <span className="text-xs text-gray-400">그날 하루만 들어가는 일정입니다</span>
          </div>

          {/* 새로 추가 */}
          <div className="rounded-xl border border-gray-200 p-3 mb-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input value={nt.start_time} onChange={e => setNt({ ...nt, start_time: e.target.value })}
                placeholder="10:00 (선택)" className={`${ic} tabular-nums`} />
              <input value={nt.title} onChange={e => setNt({ ...nt, title: e.target.value })}
                placeholder="할 일 — 예) 감염관리 교육" className={`${ic} md:col-span-2 font-bold`} />
              <select value={nt.staff_id} onChange={e => setNt({ ...nt, staff_id: e.target.value, floor: e.target.value ? '' : nt.floor })}
                className={`${ic} bg-white`}>
                <option value="">누구에게 (전체)</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={nt.floor} onChange={e => setNt({ ...nt, floor: e.target.value })}
                disabled={!!nt.staff_id} className={`${ic} bg-white disabled:bg-gray-50 disabled:text-gray-300`}>
                <option value="">층 전체</option>
                <option value="2층">2층만</option>
                <option value="3층">3층만</option>
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input value={nt.note} onChange={e => setNt({ ...nt, note: e.target.value })}
                placeholder="설명 (선택)" className={`${ic} flex-1`} />
              <button onClick={addTask} disabled={adding}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-40">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 추가
              </button>
            </div>
          </div>

          {tasks === null ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">이 날 따로 정해진 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map(t => (
                <li key={t.id} className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="shrink-0 w-14 text-[13px] font-extrabold text-amber-700 tabular-nums">
                    {t.start_time ?? <span className="text-[11px] font-bold text-amber-500">시간 무관</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-gray-900">{t.title}</span>
                    <span className="ml-2 text-[11px] font-bold text-amber-700">
                      {t.staff_name ? `${t.staff_name} 선생님` : t.floor ? `${t.floor} 전체` : '전체'}
                    </span>
                    {t.note && <span className="block text-[11px] text-gray-500">{t.note}</span>}
                  </span>
                  <button onClick={() => delTask(t)} className="text-amber-400 hover:text-red-500"><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

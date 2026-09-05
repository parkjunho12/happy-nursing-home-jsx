import { useMemo, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { evalResidentsAPI } from '@/api/evalClient'

/**
 * 그룹·종교 바꾸기 — 이 표 안에서 바로.
 *
 * 지금까지는 한 분의 인지 그룹을 A에서 B로 바꾸려면 수급자 관리로 가서
 * 이름을 찾고, 수정 창을 열고, 아래로 내려 드롭다운을 고르고, 저장을
 * 눌러야 했다. 한 분에 여섯 번 누른다. 새로 오신 분 다섯 분을 나누려면
 * 서른 번이다. 그래서 미루게 되고, 미룬 것은 비어 있는 채로 남는다.
 *
 * 여기서는 이름 옆 칸을 한 번 누르면 그게 곧 저장이다.
 *
 * 왜 버튼인가
 *   드롭다운은 눌러서 열고, 고르고, 닫힌 뒤에야 무엇이 골라졌는지 보인다.
 *   A·B·C 셋뿐이라면 처음부터 셋을 다 보여주고 하나를 누르게 하는 편이
 *   눈으로 확인하기 쉽다. 지금 무엇인지도 표를 훑으면 바로 보인다.
 *   종교는 일곱 가지라 줄이 길어져 드롭다운으로 둔다.
 *
 * 왜 저장 버튼이 없는가
 *   누르는 즉시 저장한다. 저장 버튼을 두면 '눌렀는데 저장은 안 한' 채로
 *   창을 닫는 일이 반드시 생긴다. 대신 저장됐다는 표시를 그 줄에 낸다 —
 *   표시가 없으면 저장을 믿을 수 없다.
 *
 * 실패하면 화면을 되돌린다. 화면만 바뀌고 서버는 그대로면, 다음에 열었을 때
 * 왜 되돌아가 있는지 아무도 모른다.
 */

type Props = {
  /** 수급자 목록 (snake_case 원본) */
  residents: any[]
  /** 저장된 뒤 부모의 목록도 같이 고치기 위한 알림 */
  onSaved: (id: string, patch: Record<string, string>) => void
}

const CATS = [
  { key: 'group_cognitive', label: '인지', on: 'bg-violet-600 border-violet-600 text-white', off: 'hover:bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'group_leisure',   label: '여가', on: 'bg-sky-600 border-sky-600 text-white',       off: 'hover:bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'group_physical',  label: '신체', on: 'bg-emerald-600 border-emerald-600 text-white', off: 'hover:bg-emerald-50 text-emerald-700 border-emerald-200' },
] as const

const RELIGIONS = ['기독교', '천주교', '불교', '원불교', '무교', '기타']
const GRADES = ['A', 'B', 'C']

export default function GroupEditor({ residents, onSaved }: Props) {
  const [q, setQ] = useState('')
  const [floor, setFloor] = useState('')          // '' = 전체
  const [onlyBlank, setOnlyBlank] = useState(false)
  // 줄마다의 상태 — 저장 중이거나, 방금 저장됐거나
  const [busy, setBusy] = useState<Record<string, 'saving' | 'ok'>>({})

  const act = useMemo(() => residents.filter(r => r.status === 'active'), [residents])
  const floors = useMemo(
    () => [...new Set(act.map(r => r.floor).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true })),
    [act])

  const blank = (r: any) => !r.group_cognitive || !r.group_leisure || !r.group_physical || !r.religion

  const shown = useMemo(() => {
    const key = q.trim()
    return act
      .filter(r => !floor || (floor === '미지정' ? !r.floor : r.floor === floor))
      .filter(r => !onlyBlank || blank(r))
      .filter(r => !key || String(r.name).includes(key) || String(r.room ?? '').includes(key))
      // 호실 순서대로 — 종이 명단과 같은 차례여야 눈으로 짚어가며 채울 수 있다
      .sort((a, b) =>
        String(a.floor ?? '힣').localeCompare(String(b.floor ?? '힣'), 'ko', { numeric: true }) ||
        String(a.room ?? '힣').localeCompare(String(b.room ?? '힣'), 'ko', { numeric: true }) ||
        String(a.name).localeCompare(String(b.name), 'ko'))
  }, [act, q, floor, onlyBlank])

  const blankCount = act.filter(blank).length

  /** 한 칸 바꾸기 = 한 번 저장. 실패하면 화면을 되돌린다. */
  const set = async (r: any, field: string, value: string) => {
    // 같은 것을 다시 누르면 해제 — 잘못 누른 것을 되돌릴 길이 있어야 한다
    const next = r[field] === value ? '' : value
    setBusy(b => ({ ...b, [r.id]: 'saving' }))
    onSaved(r.id, { [field]: next })                       // 화면 먼저 (누른 느낌이 바로 와야 한다)
    try {
      await evalResidentsAPI.update(r.id, { [field]: next })
      setBusy(b => ({ ...b, [r.id]: 'ok' }))
      setTimeout(() => setBusy(b => { const n = { ...b }; delete n[r.id]; return n }), 1500)
    } catch (e: any) {
      onSaved(r.id, { [field]: r[field] ?? '' })            // 되돌린다
      setBusy(b => { const n = { ...b }; delete n[r.id]; return n })
      alert(`${r.name} 어르신 저장에 실패했습니다.\n${e?.message ?? ''}\n\n다시 눌러주세요.`)
    }
  }

  const cell = 'border-b border-gray-100 px-2 py-1'

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
      {/* 찾기 — 층으로 좁히고, 안 채워진 분만 보고, 이름으로 찾는다 */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
          {[['', '전체'], ...floors.map(f => [f, f] as const), ['미지정', '층 미지정']].map(([v, label]) => (
            <button key={String(v)} onClick={() => setFloor(String(v))}
              className={`px-3 py-1.5 ${floor === v ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${onlyBlank ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-gray-200 text-gray-500'}`}>
          <input type="checkbox" checked={onlyBlank} onChange={e => setOnlyBlank(e.target.checked)} className="accent-amber-600" />
          안 채워진 분만 <span className="font-extrabold">{blankCount}</span>
        </label>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="성함 · 호실"
            className="w-40 pl-7 pr-6 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-teal-400" />
          {q && <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={12} /></button>}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">
          {onlyBlank ? '이 조건에 안 채워진 분이 없습니다.' : '해당하는 어르신이 없습니다.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] font-bold text-gray-400 text-left">
                <th className="px-2 py-1 w-16">호실</th>
                <th className="px-2 py-1 w-24">성함</th>
                {CATS.map(c => <th key={c.key} className="px-2 py-1 text-center">{c.label} 그룹</th>)}
                <th className="px-2 py-1 w-28">종교</th>
                <th className="px-2 py-1 w-12" />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/70">
                  <td className={`${cell} text-[12px] text-gray-500 whitespace-nowrap`}>
                    {r.room ? `${r.room}호` : <span className="text-gray-300">미배정</span>}
                  </td>
                  <td className={`${cell} text-[13px] font-bold text-gray-900 whitespace-nowrap`}>{r.name}</td>
                  {CATS.map(c => (
                    <td key={c.key} className={`${cell} text-center`}>
                      <div className="inline-flex gap-1">
                        {GRADES.map(g => (
                          <button key={g} onClick={() => set(r, c.key, g)}
                            title={`${r.name} — ${c.label} ${g}그룹${r[c.key] === g ? ' (다시 누르면 해제)' : ''}`}
                            className={`w-8 h-7 rounded-md border text-[12px] font-extrabold transition-colors ${r[c.key] === g ? c.on : `bg-white ${c.off}`}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </td>
                  ))}
                  <td className={cell}>
                    <select value={r.religion ?? ''} onChange={e => set(r, 'religion', e.target.value)}
                      className="w-full h-7 px-1.5 rounded-md border border-gray-200 text-[12px] bg-white focus:outline-none focus:border-teal-400">
                      <option value="">없음</option>
                      {RELIGIONS.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className={`${cell} text-center`}>
                    {busy[r.id] === 'saving' && <Loader2 size={13} className="animate-spin text-gray-300 inline" />}
                    {busy[r.id] === 'ok' && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600"><Check size={11} />저장</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-2">
        누르면 바로 저장됩니다 · 같은 것을 다시 누르면 해제됩니다 · 바뀐 내용은 아래 「그룹 변경 이력」에 남습니다
      </p>
    </div>
  )
}

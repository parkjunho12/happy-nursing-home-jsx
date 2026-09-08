import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, NotebookPen } from 'lucide-react'
import { programAPI, type ProgramLog } from '@/api/programClient'

/**
 * 그 회차에 무엇을 했는가 — 사진을 올리면서 함께 적는다.
 *
 * ■ 왜 필요한가
 *
 *   지금 남는 것은 프로그램명과 시간뿐이다. 그래서 블로그 초안을 만들면
 *   "기록에 활동 설명이 없어 활동명만 안내드립니다" 라는 글이 나온다.
 *   여기 한두 줄만 있으면 그대로 본문이 된다.
 *
 * ■ 왜 사진마다가 아니라 회차마다인가
 *
 *   한 프로그램에 사진이 스무 장씩 올라온다. 사진마다 적게 하면 같은 내용을
 *   스무 번 쓰게 되고, 그러면 아무도 안 쓴다.
 *
 * ■ 왜 칸을 여섯으로 나누는가
 *
 *   빈 상자 하나를 주면 무엇을 적을지 몰라 "즐겁게 진행함" 한 줄로 끝난다.
 *   그 한 줄로는 글이 안 나온다. 무엇을 물어보는지 칸 이름으로 알려주면
 *   적을 것이 떠오른다. 다 채울 필요는 없다 — 한 칸만 있어도 글이 달라진다.
 *
 * ■ 저장 버튼이 없다
 *
 *   칸을 벗어나면 저장한다. 사진을 올리는 김에 적는 자리라, 저장을 눌러야
 *   하면 안 누르고 닫는다.
 */

type Field = { key: keyof Pick<ProgramLog, 'goal' | 'doing' | 'tools' | 'support' | 'joined' | 'outcome'>
              label: string; ph: string; rows: number }

const FIELDS: Field[] = [
  { key: 'goal',    label: '목표',        ph: '예) 앉은 자세로 상지 근력과 균형 감각을 쓰는 시간', rows: 2 },
  { key: 'doing',   label: '진행 내용',   ph: '예) 준비체조 → 두 팀으로 나눠 공 굴리기 → 정리체조', rows: 3 },
  { key: 'tools',   label: '도구 · 재료', ph: '예) 폼볼, 미니 골대, 스피커', rows: 1 },
  { key: 'joined',  label: '참여',        ph: '예) 2층 12명 · 휠체어 이용 어르신 포함', rows: 1 },
  { key: 'support', label: '직원 도움',   ph: '예) 공 방향을 잡아드리고 순서를 안내함', rows: 2 },
  { key: 'outcome', label: '마무리 · 반응', ph: '예) 정리체조 후 마침 · 다음 회차 재참여 희망 표시', rows: 2 },
]

const EMPTY = { goal: '', doing: '', tools: '', support: '', joined: '', outcome: '' }

export default function SessionLogForm({ month, day, title, grp, log, onSaved }: {
  month: string
  day: number
  title: string
  grp?: string | null
  log?: ProgramLog | null
  onSaved: (l: ProgramLog | null) => void
}) {
  const [v, setV] = useState({ ...EMPTY })
  const [busy, setBusy] = useState<'saving' | 'ok' | null>(null)
  const saved = useRef({ ...EMPTY })

  useEffect(() => {
    const next = log
      ? { goal: log.goal, doing: log.doing, tools: log.tools,
          support: log.support, joined: log.joined, outcome: log.outcome }
      : { ...EMPTY }
    setV(next)
    saved.current = next
  }, [log, month, day, title])

  const save = async () => {
    // 안 바뀌었으면 서버를 부르지 않는다 — 칸을 지나가기만 해도 저장되면
    // '저장됨' 표시가 계속 깜빡여 무엇이 실제로 바뀌었는지 모른다
    if (JSON.stringify(v) === JSON.stringify(saved.current)) return
    setBusy('saving')
    try {
      const r = await programAPI.saveLog({ month, day, title, grp, ...v })
      saved.current = { ...v }
      onSaved(r?.deleted ? null : r)
      setBusy('ok')
      setTimeout(() => setBusy(null), 1500)
    } catch (e: any) {
      setV({ ...saved.current })      // 되돌린다
      setBusy(null)
      alert(e?.response?.data?.detail ?? '기록을 저장하지 못했습니다.')
    }
  }

  const filled = Object.values(v).filter(x => (x ?? '').trim()).length

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <NotebookPen size={13} className="text-violet-600" />
        <p className="text-xs font-bold text-gray-800">{title} · 활동 기록</p>
        <span className="text-[10px] text-gray-400">{filled}/6</span>
        <span className="ml-auto text-[10px]">
          {busy === 'saving' && <Loader2 size={11} className="animate-spin text-gray-300 inline" />}
          {busy === 'ok' && <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600"><Check size={10} />저장</span>}
          {!busy && log?.updated_by && <span className="text-gray-300">{log.updated_by}</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {FIELDS.map(f => (
          <div key={f.key} className={f.rows > 2 ? 'md:col-span-2' : ''}>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">{f.label}</label>
            <textarea
              value={v[f.key] ?? ''}
              rows={f.rows}
              maxLength={f.key === 'tools' || f.key === 'joined' ? 300 : 1000}
              onChange={e => setV(s => ({ ...s, [f.key]: e.target.value }))}
              onBlur={save}
              // 키보드만으로 끝낼 수 있게
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur() }}
              placeholder={f.ph}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] resize-none focus:outline-none focus:border-violet-400" />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 mt-1.5">
        칸을 벗어나면 바로 저장됩니다 · 아는 것만 적으셔도 됩니다 · 여기 적힌 내용이 블로그 초안의 본문이 됩니다
      </p>
    </div>
  )
}

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
 * ■ 왜 두 칸인가
 *
 *   아래 FIELDS 주석에 적었다 — 여섯 칸으로 두었더니 한 달 동안 한 건도
 *   안 적혔다.
 *
 * ■ 저장 버튼이 없다
 *
 *   칸을 벗어나면 저장한다. 사진을 올리는 김에 적는 자리라, 저장을 눌러야
 *   하면 안 누르고 닫는다.
 */

type Field = { key: keyof Pick<ProgramLog, 'goal' | 'doing'>
              label: string; ph: string; rows: number }

/** 두 칸만 둔다.
 *
 *  처음에는 목표·진행·도구·참여·직원 도움·마무리 여섯 칸이었다. 무엇을 적을지
 *  알려주려던 것인데, 여섯 칸이 비어 있으면 '다 채워야 하나' 싶어 손이 안 간다.
 *  실제로 한 달 동안 한 건도 안 적혔다.
 *
 *  두 칸이면 적는다. 도구·참여·마무리는 '프로그램 내용' 한 줄에 자연스럽게
 *  들어간다 — 칸을 나눠 물을 필요가 없다. */
const FIELDS: Field[] = [
  { key: 'goal',  label: '오늘의 목표', rows: 2,
    ph: '예) 앉은 자세로 상지 근력과 균형 감각을 쓰는 시간' },
  { key: 'doing', label: '프로그램 내용', rows: 4,
    ph: '예) 준비체조로 몸을 풀고, 두 팀으로 나눠 폼볼을 굴려 미니 골대에 넣었습니다.\n직원이 공 방향을 잡아드렸고, 정리체조로 마쳤습니다. 2층 12명 참여.' },
]

const EMPTY = { goal: '', doing: '' }

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
    const next = log ? { goal: log.goal, doing: log.doing } : { ...EMPTY }
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
        <span className="text-[10px] text-gray-400">{filled}/2</span>
        <span className="ml-auto text-[10px]">
          {busy === 'saving' && <Loader2 size={11} className="animate-spin text-gray-300 inline" />}
          {busy === 'ok' && <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600"><Check size={10} />저장</span>}
          {!busy && log?.updated_by && <span className="text-gray-300">{log.updated_by}</span>}
        </span>
      </div>

      <div className="space-y-2">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">{f.label}</label>
            <textarea
              value={v[f.key] ?? ''}
              rows={f.rows}
              maxLength={2000}
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
        칸을 벗어나면 바로 저장됩니다 · 한 칸만 적으셔도 됩니다 · 여기 적힌 내용이 블로그 초안의 본문이 됩니다
      </p>
    </div>
  )
}

import { useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import { useShiftConfig } from '@/store/shiftConfig'
import { resolveCodeHours, CODE_MAP } from '@/utils/shiftCodes'

/**
 * 이 달 실 근무시간 — 주간·야간을 그 달 하나만 다르게 센다.
 *
 *  야간이 9시간인지 10시간인지는 시설이 정하고, 「조 편성 → 근무 코드 시간」
 *  에서 '언제부터' 로 바꾼다. 그런데 그 달만 실제로 달랐던 경우가 있다.
 *  시점으로 적으면 다음 달까지 함께 끌려가서, 그 달만 되돌리려고 시점을
 *  하나 더 적어야 한다. 그러면 설정이 금세 읽기 어려워진다.
 *
 *  여기서 적는 값은 그 달 하나에만 얹힌다. 다음 달은 원래 규칙 그대로다.
 *  총시간이 이 값으로 다시 계산된다 — 급여로 이어지는 숫자다.
 */
const CODES = ['D', 'N'] as const

export default function MonthHoursPanel({ ym, locked, onChanged }: {
  ym: string
  locked?: boolean
  /** 시간이 바뀌었다 — 총시간을 다시 담아 저장해야 엑셀도 같은 숫자가 된다 */
  onChanged?: () => void
}) {
  const base = useShiftConfig(st => st.base)
  const rules = useShiftConfig(st => st.rules)
  const months = useShiftConfig(st => st.months)
  const saveMonth = useShiftConfig(st => st.saveMonth)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, string> | null>(null)

  // 이 달 설정을 뺐을 때의 값 — '되돌리면 몇 시간이 되는지' 와 '무엇이 바뀐
  // 값인지' 를 둘 다 이 값으로 판단한다.
  const under = resolveCodeHours(ym, base, rules, null)
  const mine = months[ym] ?? {}
  // 이 달에 실제로 쓰이는 값. 저장소의 '지금 풀어놓은 달' 에 기대지 않고
  // 여기서 직접 푼다 — 달을 넘기는 찰나에 지난달 값이 칸에 남으면 안 된다.
  const nowOf = (c: string) => mine[c] ?? under[c]
  const cur = draft ?? Object.fromEntries(CODES.map(c => [c, String(nowOf(c))]))
  const dirty = draft !== null
  const has = CODES.some(c => c in mine)

  const num = (v: string) => {
    const t = String(v ?? '').trim()
    if (t === '') return NaN
    const n = Number(t)
    return Number.isFinite(n) ? n : NaN
  }

  const label = `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`

  const save = async () => {
    const next: Record<string, number> = { ...mine }
    const lines: string[] = []
    for (const c of CODES) {
      const n = num(cur[c])
      if (!Number.isFinite(n) || n < 0 || n > 24) {
        alert(`${c}(${CODE_MAP[c]?.label}) 시간을 0~24 사이 숫자로 적어주세요.`); return
      }
      // 원래 규칙과 같은 값은 담지 않는다. 담아두면 나중에 규칙을 고쳐도
      // 이 달만 옛 값에 묶여, 왜 이 달만 다른지 아무도 모르게 된다.
      if (Math.abs(n - under[c]) < 1e-9) delete next[c]
      else next[c] = n
      if (Math.abs(n - nowOf(c)) > 1e-9) {
        lines.push(`  ${c} ${CODE_MAP[c]?.label}: ${nowOf(c)}h → ${n}h`)
      }
    }
    if (!confirm(
      `${label} 실 근무시간을 저장합니다.\n\n` + (lines.join('\n') || '  (바뀐 것 없음)') +
      `\n\n이 달 총시간이 새 값으로 다시 계산됩니다.\n다른 달은 그대로입니다.\n\n※ 엑셀에도 반영하려면 근무표를 한 번 「저장」해 주세요.\n\n계속할까요?`)) return
    setBusy(true)
    try { await saveMonth(ym, next); setDraft(null); onChanged?.() }
    catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '저장에 실패했습니다.') }
    finally { setBusy(false) }
  }

  const clear = async () => {
    if (!confirm(`${label}만의 설정을 지웁니다.\n\n` +
      CODES.map(c => `  ${c} ${CODE_MAP[c]?.label}: ${under[c]}h 로 돌아감`).join('\n') +
      `\n\n계속할까요?`)) return
    setBusy(true)
    try { await saveMonth(ym, {}); setDraft(null); onChanged?.() }
    catch (e: any) { alert(e?.response?.data?.detail ?? e?.message ?? '저장에 실패했습니다.') }
    finally { setBusy(false) }
  }

  return (
    <div className={`mb-3 rounded-2xl border px-3 py-2.5 ${has ? 'border-amber-300 bg-amber-50/70' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Clock size={13} className={has ? 'text-amber-600' : 'text-gray-400'} />
        <span className="text-xs font-bold text-gray-700">이 달 실 근무시간</span>
        {has && <span className="text-[10px] font-extrabold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">이 달만 다름</span>}

        {CODES.map(c => {
          const changed = Math.abs(num(cur[c]) - under[c]) > 1e-9
          return (
            <label key={c}
              className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 bg-white ${changed ? 'border-amber-400' : 'border-gray-200'}`}
              title={changed ? `원래 규칙은 ${under[c]}시간` : undefined}>
              <span className="text-[11px] font-bold text-gray-700">{c}</span>
              <span className="text-[10px] text-gray-400">{CODE_MAP[c]?.label}</span>
              <input type="number" min={0} max={24} step={0.5} value={cur[c]}
                disabled={!!locked}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setDraft({ ...cur, [c]: e.target.value })}
                className="w-14 px-1 py-0.5 text-[12px] text-right border border-gray-200 rounded disabled:bg-gray-50" />
              <span className="text-[10px] text-gray-400">h</span>
            </label>
          )
        })}

        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <button type="button" onClick={() => setDraft(null)}
              className="text-[11px] text-gray-500 hover:underline">되돌리기</button>
          )}
          <button type="button" onClick={save} disabled={busy || !dirty || !!locked}
            title={locked ? '확정 잠금 상태입니다' : undefined}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold disabled:opacity-40">
            {busy && <Loader2 size={11} className="animate-spin" />} 이 달만 저장
          </button>
          {has && !dirty && (
            <button type="button" onClick={clear} disabled={busy || !!locked}
              className="text-[11px] font-bold text-rose-600 hover:underline disabled:opacity-40">
              이 달 설정 지우기
            </button>
          )}
        </div>
      </div>
      <p className="text-[10.5px] text-gray-500 mt-1.5">
        {has
          ? <>이 달 총시간을 이 값으로 셉니다. 다음 달은 원래 규칙({CODES.map(c => `${c} ${under[c]}h`).join(' · ')})으로 돌아갑니다.</>
          : <>그 달만 실제 근무시간이 달랐을 때 여기서 고칩니다. 앞으로 쭉 바꾸려면 「조 편성 → 근무 코드 시간」에서 시점을 두세요.</>}
      </p>
    </div>
  )
}

import { useState } from 'react'
import { workScheduleAPI } from '@/api/workScheduleClient'
import { TEAMS, DAY_TEAM, ROTATION, rotationPreview, meta, SHIFT_CODES, type CodeHourRule } from '@/utils/shiftCodes'
import { TEAM_BAND, canJoinTeam, type StaffRow } from './shared'
import type { ScheduleRow } from '@/api/workScheduleClient'
import { useShiftConfig } from '@/store/shiftConfig'

/**
 * 조 편성 패널 — 요양보호사에게 조를 지정하고, 조별 시작 패턴과
 * 정산 설정(회전 기준일·정산 시작월)을 조정한다.
 */
export default function TeamPanel({ staff, patchRow, offsets, setOffsets, setDirty, anchor, setAnchor, settleStart, setSettleStart, floors }: {
  staff: StaffRow[]
  patchRow: (sid: string, p: Partial<ScheduleRow>) => void
  offsets: Record<string, number>
  setOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setDirty: (v: boolean) => void
  anchor: string
  setAnchor: (v: string) => void
  settleStart: string
  setSettleStart: (v: string) => void
  /** 어르신이 실제로 계신 층 — 없는 층을 고르게 두지 않는다 */
  floors: string[]
}) {
  return (
          <div className="mb-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
            <p className="text-xs font-bold text-indigo-800 mb-2">
              조 · 층 편성 — <b>요양보호사</b>만 교대조를 지정할 수 있고, 나머지 직종은 주간 근무입니다.
              <b>층은 주간 근무자도 지정</b>할 수 있습니다
              <span className="font-normal text-indigo-500"> · 근무표에서 「층 표시」를 켜야 보입니다</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {staff.map(s => {
                const shiftable = canJoinTeam(s.pos)
                return (
                  <div key={s.id} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                    <span className="text-xs font-semibold text-gray-700 flex-1 truncate" title={s.pos ?? ''}>{s.name}</span>
                    {shiftable ? (
                      <select value={s.team ?? ''} onChange={e => patchRow(s.id, { position: s.pos, team: e.target.value, floor: s.floor })}
                        className="text-[11px] border border-gray-200 rounded px-1 py-1">
                        <option value="">-</option>
                        {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value={DAY_TEAM}>{DAY_TEAM}</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-gray-400 px-1 py-1" title={`${s.pos || '이 직종'}은 교대를 돌지 않습니다`}>주간</span>
                    )}
                    {/* 층은 교대조와 상관없다 — 주간 근무자도 맡은 층이 있다 */}
                    <select value={s.floor ?? ''} title="담당 층"
                      onChange={e => patchRow(s.id, { position: s.pos, team: s.team, floor: e.target.value })}
                      className="text-[11px] border border-gray-200 rounded px-1 py-1 text-gray-600">
                      <option value="">층 -</option>
                      {floors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 border-t border-indigo-100 pt-2.5 flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold text-indigo-800">정산 설정</span>
              <label className="text-[11px] text-gray-600">회전 기준일
                <input type="date" value={anchor}
                  onChange={e => { const v = e.target.value; setAnchor(v); workScheduleAPI.saveConfig({ rotation_anchor: v }).catch(() => alert('설정 저장 실패')) }}
                  className="ml-1 px-2 py-1 text-[12px] border border-gray-200 rounded-lg" />
              </label>
              <label className="text-[11px] text-gray-600">정산 시작월
                <input type="month" value={settleStart}
                  onChange={e => { const v = e.target.value; setSettleStart(v); workScheduleAPI.saveConfig({ settle_start: v }).catch(() => alert('설정 저장 실패')) }}
                  className="ml-1 px-2 py-1 text-[12px] border border-gray-200 rounded-lg" />
              </label>
              <span className="text-[10px] text-gray-400">해가 바뀌면 여기서만 조정하면 됩니다</span>
            </div>
            <div className="mt-3 border-t border-indigo-100 pt-2.5">
              <p className="text-[11px] font-bold text-indigo-800 mb-1.5">
                조별 시작 패턴 <span className="font-normal text-indigo-500">— 1일이 무슨 근무로 시작할지 정합니다 (주주야야휴휴 {ROTATION.length}일 주기 · 휴휴는 공란)</span>
              </p>
              <div className="space-y-1">
                {TEAMS.filter(t => staff.some(s => canJoinTeam(s.pos) && s.team === t)).map(t => {
                  const used = staff.filter(s => canJoinTeam(s.pos) && s.team === t).length
                  return (
                    <div key={t} className="flex items-center gap-2 flex-wrap bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                      <span className={`w-1.5 h-4 rounded-sm ${TEAM_BAND[t] ?? 'bg-gray-300'}`} />
                      <span className="text-xs font-bold text-gray-700 w-9">{t}</span>
                      <span className="text-[10px] text-gray-400 w-9">{used}명</span>
                      <div className="flex gap-0.5">
                        {rotationPreview(t, offsets).map((c, i) => (
                          <span key={i} title={c ? undefined : '근무 없음(공란)'}
                            className={`w-6 text-center text-[10px] font-bold py-0.5 rounded ${c ? (meta(c)?.cls ?? 'bg-gray-100') : 'bg-gray-50 text-gray-300'}`}>
                            {c || '·'}
                          </span>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setOffsets(p => ({ ...p, [t]: (((p[t] ?? 0) + 5) % 6) })); setDirty(true) }}
                        className="text-[11px] font-bold text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50">◀</button>
                      <button type="button" onClick={() => { setOffsets(p => ({ ...p, [t]: (((p[t] ?? 0) + 1) % 6) })); setDirty(true) }}
                        className="text-[11px] font-bold text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-50">▶</button>
                      {(() => {
                        const dup = TEAMS.filter(o => o !== t && staff.some(s => canJoinTeam(s.pos) && s.team === o) && (offsets[o] ?? 0) === (offsets[t] ?? 0))
                        return dup.length > 0
                          ? <span className="text-[10px] font-bold text-amber-600">{dup.join('·')}와 같은 주기</span>
                          : null
                      })()}
                    </div>
                  )
                })}
                {!staff.some(s => canJoinTeam(s.pos) && (TEAMS as readonly string[]).includes(s.team ?? '')) && (
                  <p className="text-[11px] text-gray-400">위에서 요양보호사에게 조를 지정하면 시작 패턴을 조정할 수 있습니다.</p>
                )}
              </div>

              <CodeHoursPanel />
            </div>
          </div>
  )
}

/**
 * 근무 코드별 시간.
 *
 * 야간을 9시간으로 볼지 10시간으로 볼지는 시설이 정할 일이고 실제로 바뀐다.
 * 코드에 박아두면 바꿀 때마다 배포해야 하고, 그동안 급여 계산이 틀린 채로 돈다.
 *
 * 시점을 둘 수 있다. '2026-09부터 야간 10시간' 처럼 적으면 그 달부터만
 * 그렇게 센다 — 이미 급여를 지급한 지난달 숫자는 그대로 남는다.
 * 시점 없이 「전체 기간」을 고치면 지난달까지 함께 달라진다.
 */
function CodeHoursPanel() {
  const base = useShiftConfig(st => st.base)
  const rules = useShiftConfig(st => st.rules)
  const defaults = useShiftConfig(st => st.defaults)
  const effective = useShiftConfig(st => st.hours)   // 지금 보고 있는 달의 적용값
  const month = useShiftConfig(st => st.month)
  const apply = useShiftConfig(st => st.apply)
  const [busy, setBusy] = useState(false)

  const codes = SHIFT_CODES.filter(c => c.group === '근무' || c.code === '休')

  /**
   * 편집 중에는 숫자가 아니라 글자로 들고 있는다.
   *
   * Number(입력값) 으로 바로 바꾸면, 10 을 지우고 9 를 치려는 순간 빈 값이
   * 0 으로 튀어 고칠 수가 없다. 다 적은 다음에 숫자로 바꾼다.
   */
  const [dBase, setDBase] = useState<Record<string, string> | null>(null)
  const [dRules, setDRules] = useState<{ from: string; hours: Record<string, string> }[] | null>(null)

  const curBase = dBase ?? Object.fromEntries(
    codes.map(c => [c.code, String(base[c.code] ?? defaults[c.code] ?? c.hours)]))
  const curRules = dRules ?? rules.map(r => ({
    from: r.from,
    hours: Object.fromEntries(Object.entries(r.hours).map(([k, v]) => [k, String(v)])),
  }))
  const dirty = dBase !== null || dRules !== null

  const setRule = (i: number, patch: Partial<{ from: string; hours: Record<string, string> }>) =>
    setDRules(curRules.map((r, ri) => ri === i ? { ...r, ...patch } : r))

  const num = (v: string) => {
    const t = String(v ?? '').trim()
    // 빈 칸은 0 이 아니라 '안 적었다' 이다. Number('') 는 0 이라, 그대로 두면
    // 지우고 저장했을 때 0 시간으로 굳는다.
    if (t === '') return NaN
    const n = Number(t)
    return Number.isFinite(n) ? n : NaN
  }

  const save = async () => {
    const nb: Record<string, number> = {}
    for (const c of codes) {
      const n = num(curBase[c.code])
      if (!Number.isFinite(n) || n < 0 || n > 24) {
        alert(`${c.code}(${c.label}) 시간을 0~24 사이 숫자로 적어주세요.`); return
      }
      nb[c.code] = n
    }
    const nr: CodeHourRule[] = []
    for (const r of curRules) {
      if (!/^\d{4}-\d{2}$/.test(r.from)) { alert('적용 시작월을 골라주세요.'); return }
      const h: Record<string, number> = {}
      for (const [k, v] of Object.entries(r.hours)) {
        const n = num(v)
        if (!Number.isFinite(n) || n < 0 || n > 24) {
          alert(`${r.from}부터의 ${k} 시간을 0~24 사이 숫자로 적어주세요.`); return
        }
        h[k] = n
      }
      if (Object.keys(h).length === 0) { alert(`${r.from}부터 바꿀 코드를 하나 이상 골라주세요.`); return }
      nr.push({ from: r.from, hours: h })
    }

    const baseChanged = codes.filter(c => nb[c.code] !== (base[c.code] ?? defaults[c.code] ?? c.hours))
    const lines = [
      ...baseChanged.map(c => `  [전체 기간] ${c.code} ${c.label}: ${base[c.code] ?? defaults[c.code]}h → ${nb[c.code]}h`),
      ...nr.map(r => `  [${r.from}부터] ` + Object.entries(r.hours).map(([k, v]) => `${k} ${v}h`).join(', ')),
    ]
    if (!confirm(
      '근무 코드 시간을 저장합니다.\n\n' + (lines.join('\n') || '  (바뀐 것 없음)') +
      (baseChanged.length
        ? '\n\n※ [전체 기간] 을 고치면 지난달 총시간도 함께 달라집니다.\n' +
          '   이미 급여를 지급한 달의 숫자가 바뀔 수 있습니다.'
        : '\n\n※ 시점 설정만 바꿨습니다 — 그 달부터만 달라지고 지난달은 그대로입니다.') +
      '\n\n계속할까요?')) return
    setBusy(true)
    try {
      await workScheduleAPI.saveConfig({ code_hours: nb, code_hours_rules: nr })
      apply(nb, nr)
      setDBase(null); setDRules(null)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '저장에 실패했습니다.')
    } finally { setBusy(false) }
  }

  const thisMonth = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7)

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[11px] font-bold text-gray-500">근무 코드 시간</p>
        <span className="text-[10px] text-gray-400">총시간이 이 값으로 계산됩니다</span>
      </div>

      {/* 지금 보고 있는 달에 실제로 쓰이는 값.
          아래 [전체 기간] 은 시점 설정에 덮이므로, 그것만 보면 '안 바뀌었다' 고
          오해한다. 실제 적용값을 먼저 보여준다. */}
      <div className="rounded-lg bg-gray-900 px-2.5 py-1.5 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400">
            {month ? `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월` : '이번 달'} 적용
          </span>
          {codes.map(c => {
            const v = effective[c.code] ?? c.hours
            const changed = defaults[c.code] !== undefined && v !== defaults[c.code]
            return (
              <span key={c.code}
                className={`text-[11px] font-mono ${changed ? 'text-amber-300 font-bold' : 'text-gray-300'}`}
                title={changed ? `기본 ${defaults[c.code]}h 에서 바뀜` : undefined}>
                {c.code} {v}h
              </span>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] font-bold text-gray-400 mb-1">전체 기간</p>
      <div className="flex flex-wrap gap-1.5">
        {codes.map(c => {
          const changed = defaults[c.code] !== undefined && num(curBase[c.code]) !== defaults[c.code]
          return (
            <label key={c.code}
              className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 ${
                changed ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
              title={changed ? `기본값 ${defaults[c.code]}시간에서 바꿈` : undefined}>
              <span className="text-[11px] font-bold text-gray-700">{c.code}</span>
              <span className="text-[10px] text-gray-400">{c.label}</span>
              <input type="number" min={0} max={24} step={0.5} value={curBase[c.code]}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setDBase({ ...curBase, [c.code]: e.target.value })}
                className="w-12 px-1 py-0.5 text-[11px] text-right border border-gray-200 rounded" />
              <span className="text-[10px] text-gray-400">h</span>
            </label>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5 mt-2.5 mb-1">
        <p className="text-[10px] font-bold text-gray-400">시점 설정</p>
        <span className="text-[10px] text-gray-400">그 달부터 적용 — 지난달은 그대로</span>
      </div>
      <div className="space-y-1.5">
        {curRules.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5 flex-wrap rounded-lg border border-teal-200 bg-teal-50/50 px-2 py-1.5">
            <input type="month" value={r.from}
              onChange={e => setRule(i, { from: e.target.value })}
              className="px-1.5 py-0.5 text-[11px] border border-gray-200 rounded bg-white" />
            <span className="text-[10px] text-gray-500">부터</span>
            {codes.map(c => {
              const on = c.code in r.hours
              return (
                <label key={c.code}
                  className={`inline-flex items-center gap-1 rounded border px-1 py-0.5 ${
                    on ? 'border-teal-300 bg-white' : 'border-transparent opacity-50'}`}>
                  <input type="checkbox" checked={on} className="accent-teal-600"
                    onChange={e => {
                      const h = { ...r.hours }
                      if (e.target.checked) h[c.code] = curBase[c.code]
                      else delete h[c.code]
                      setRule(i, { hours: h })
                    }} />
                  <span className="text-[10px] font-bold text-gray-700">{c.code}</span>
                  {on && (
                    <input type="number" min={0} max={24} step={0.5} value={r.hours[c.code]}
                      onFocus={e => e.currentTarget.select()}
                      onChange={e => setRule(i, { hours: { ...r.hours, [c.code]: e.target.value } })}
                      className="w-12 px-1 text-[11px] text-right border border-gray-200 rounded" />
                  )}
                </label>
              )
            })}
            <button type="button" onClick={() => setDRules(curRules.filter((_, ri) => ri !== i))}
              className="ml-auto text-[11px] text-rose-500 hover:underline">삭제</button>
          </div>
        ))}
        <button type="button"
          onClick={() => setDRules([...curRules, { from: thisMonth, hours: { N: curBase.N } }])}
          className="text-[11px] font-bold text-teal-700 hover:underline">+ 시점 추가</button>
      </div>

      <div className="flex items-center gap-2 mt-2.5">
        <button type="button" onClick={save} disabled={busy || !dirty}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold disabled:opacity-40">
          {busy ? '저장 중…' : '시간 저장'}
        </button>
        {dirty && (
          <button type="button" onClick={() => { setDBase(null); setDRules(null) }}
            className="text-[11px] text-gray-500 hover:underline">되돌리기</button>
        )}
        <span className="text-[10.5px] text-gray-500">
          「전체 기간」을 고치면 <b className="text-amber-700">지난달도 함께</b> 달라집니다
        </span>
      </div>
    </div>
  )
}

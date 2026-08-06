// 근무표 점검 — 편성표를 확정하기 전에 자동으로 훑는 규칙들.
// 실무에서 눈으로 찾던 것(인원 구멍, 시간 초과, 야간 연속)을 계산으로 대신한다.
import { CODE_MAP, hoursOf, extraHoursOf, countAsOf } from './shiftCodes'

export type IssueLevel = 'danger' | 'warn'
export interface Issue {
  id: string
  level: IssueLevel
  kind: 'understaffed' | 'overHours' | 'underHours' | 'nightStreak' | 'workStreak' | 'unassigned' | 'roleMissing'
  title: string
  detail: string
  day?: number          // 해당 일자 (열 강조용)
  staffId?: string      // 해당 직원 (행 강조용)
}

export interface AuditInput {
  days: { day: number; dow: number }[]
  staff: { id: string; name: string; team?: string | null; pos?: string | null }[]
  data: Record<string, Record<string, string>>
  baseHours: number
  minStaffPerDay: number
  maxNightStreak: number
  maxWorkStreak: number       // 연속 근무일 허용치 (피로도)
  hoursTolerance: number      // 기준시간 대비 허용 오차
}

export interface StaffStat {
  hours: number      // 정규 근무 코드 시간
  extra: number      // 직접 입력한 시간대(추가근무)
  total: number      // 총시간 = 정규 + 추가근무
  d: number; n: number; annual: number; off: number; blank: number
}

export const statOf = (row: Record<string, string> | undefined, days: AuditInput['days']): StaffStat => {
  let hours = 0, extra = 0, d = 0, n = 0, annual = 0, off = 0, blank = 0
  days.forEach(({ day }) => {
    const v = row?.[String(day)]
    if (!v) { blank++; return }
    hours += hoursOf(v)
    extra += extraHoursOf(v)
    const c = countAsOf(v); if (c === 'D') d++; else if (c === 'N') n++
    const mt = CODE_MAP[v]
    if (mt?.annual) annual++
    if (mt?.offday) off++
  })
  const h = Math.round(hours * 10) / 10
  const e = Math.round(extra * 10) / 10
  return { hours: h, extra: e, total: Math.round((h + e) * 10) / 10, d, n, annual, off, blank }
}

// 매일 최소 1명은 출근해야 하는 필수 직종 — 없는 날을 점검에서 잡아낸다
export const REQUIRED_ROLES = ['간호팀장', '사회복지사'] as const

/** 하루 근무 인원 (D·N 계열만) */
export const staffOnDay = (input: AuditInput, day: number): number =>
  input.staff.reduce((a, s) => a + (countAsOf(input.data[s.id]?.[String(day)]) ? 1 : 0), 0)

export function auditSchedule(input: AuditInput): Issue[] {
  const { days, staff, data, baseHours, minStaffPerDay, maxNightStreak, maxWorkStreak, hoursTolerance } = input
  const out: Issue[] = []

  // 1) 근무 인원이 부족한 날 — 가장 먼저 막아야 할 사고
  days.forEach(({ day }) => {
    const n = staffOnDay(input, day)
    if (n < minStaffPerDay) {
      out.push({
        id: `u-${day}`, level: n === 0 ? 'danger' : 'warn', kind: 'understaffed', day,
        title: `${day}일 근무 ${n}명`,
        detail: n === 0 ? '아무도 배정되지 않았습니다' : `최소 ${minStaffPerDay}명보다 ${minStaffPerDay - n}명 부족합니다`,
      })
    }
  })

  // 1-2) 필수 직종 공백 — 간호팀장·사회복지사는 매일 한 명은 반드시 출근.
  //      해당 직종 직원이 편성표에 아예 없으면(퇴사 등) 날짜별 반복 대신 한 건으로 알린다.
  REQUIRED_ROLES.forEach(role => {
    const members = staff.filter(s => (s.pos ?? '').includes(role))
    if (members.length === 0) {
      out.push({ id: `rm-${role}`, level: 'warn', kind: 'roleMissing',
        title: `${role} 미편성`, detail: '편성표에 해당 직종 직원이 없어 일별 점검을 할 수 없습니다' })
      return
    }
    days.forEach(({ day }) => {
      const onDuty = members.some(mb => countAsOf(data[mb.id]?.[String(day)]) !== null)
      if (!onDuty) {
        out.push({ id: `rm-${role}-${day}`, level: 'danger', kind: 'roleMissing', day,
          title: `${day}일 ${role} 없음`,
          detail: `${role}이(가) 한 명도 근무하지 않습니다 — 최소 1명 필수` })
      }
    })
  })

  staff.forEach(s => {
    const row = data[s.id]
    const st = statOf(row, days)

    // 2) 기준시간 초과·미달 — 추가근무까지 더한 총시간으로 본다 (급여와 직결)
    const diff = Math.round((st.total - baseHours) * 10) / 10
    if (diff > hoursTolerance) {
      out.push({ id: `o-${s.id}`, level: 'warn', kind: 'overHours', staffId: s.id,
        title: `${s.name} 기준 초과 +${diff}시간`,
        detail: `${st.total}시간${st.extra > 0 ? ` (추가근무 ${st.extra}h 포함)` : ''} · 기준 ${baseHours}시간` })
    } else if (-diff > hoursTolerance && st.total > 0) {
      // 미달은 급여가 깎이는 쪽이라 더 눈에 띄게 본다
      out.push({ id: `n-${s.id}`, level: 'danger', kind: 'underHours', staffId: s.id,
        title: `${s.name} 기준 미달 ${diff}시간`,
        detail: `${st.total}시간${st.extra > 0 ? ` (추가근무 ${st.extra}h 포함)` : ''} · 기준 ${baseHours}시간` })
    }

    // 3) 야간 연속 — 주주야야휴휴는 2연속이 정상, 그 이상은 회복이 부족하다
    let streak = 0, worst = 0, worstEnd = 0
    days.forEach(({ day }) => {
      if (countAsOf(row?.[String(day)]) === 'N') {
        streak++
        if (streak > worst) { worst = streak; worstEnd = day }
      } else streak = 0
    })
    if (worst > maxNightStreak) {
      out.push({ id: `ns-${s.id}`, level: 'danger', kind: 'nightStreak', staffId: s.id, day: worstEnd,
        title: `${s.name} 야간 ${worst}일 연속`, detail: `${worstEnd - worst + 1}~${worstEnd}일 · 허용 ${maxNightStreak}일` })
    }

    // 4) 연속 근무일 — 추가근무가 휴무일을 잠식하면 길어진다.
    //    주주야야휴휴는 4일 연속이 정상이고, 추가근무가 붙으면 5일이 된다.
    //    그 이상이면 회복할 틈이 없다는 뜻이라 따로 잡는다.
    let wRun = 0, wWorst = 0, wEnd = 0
    days.forEach(({ day }) => {
      const v = row?.[String(day)]
      const working = !!v && (countAsOf(v) !== null || (!CODE_MAP[v] && !!v))
      if (working) { wRun++; if (wRun > wWorst) { wWorst = wRun; wEnd = day } }
      else wRun = 0
    })
    if (wWorst > maxWorkStreak) {
      out.push({ id: `ws-${s.id}`, level: 'warn', kind: 'workStreak', staffId: s.id, day: wEnd,
        title: `${s.name} ${wWorst}일 연속 근무`,
        detail: `${wEnd - wWorst + 1}~${wEnd}일 · 쉬는 날 없이 이어집니다` })
    }

    // 5) 통째로 비어 있는 직원 — 편성에서 빠뜨린 경우
    if (st.blank === days.length) {
      out.push({ id: `b-${s.id}`, level: 'warn', kind: 'unassigned', staffId: s.id,
        title: `${s.name} 미편성`, detail: '이달 근무가 하나도 입력되지 않았습니다' })
    }
  })

  // 심각한 것부터, 같은 등급이면 날짜순
  const rank = (i: Issue) => (i.level === 'danger' ? 0 : 1)
  return out.sort((a, b) => rank(a) - rank(b) || (a.day ?? 99) - (b.day ?? 99))
}

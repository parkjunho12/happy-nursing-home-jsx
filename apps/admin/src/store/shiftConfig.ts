import { create } from 'zustand'
import { workScheduleAPI } from '@/api/workScheduleClient'
import { setCodeHours, codeHoursNow, resolveCodeHours, type CodeHourRule, type CodeHourMonths } from '@/utils/shiftCodes'

/**
 * 근무 코드별 시간 설정.
 *
 * hoursOf 를 부르는 곳이 여기저기 흩어져 있어 계산 함수에 인자로 넘기지
 * 않는다. 대신 표를 갈아끼우고(setCodeHours), 값이 실렸다는 것을 이 저장소가
 * 알린다 — 그래야 화면이 새 값으로 다시 그려진다. 이게 없으면 설정을
 * 불러오기 전에 그려진 총시간이 옛 값인 채로 남는다.
 *
 * 한 번만 불러온다. 자주 바뀌는 값이 아니고, 화면마다 부르면 표를 볼 때마다
 * 같은 요청이 나간다.
 */
interface ShiftConfigState {
  loaded: boolean
  loading: boolean
  /** 지금 계산에 쓰이는 표 — useFor 가 정한 달 기준 */
  hours: Record<string, number>
  defaults: Record<string, number>
  /** 전체 기간 설정 */
  base: Record<string, number>
  /** 시점 설정 — 그 달부터 적용 */
  rules: CodeHourRule[]
  /** 그 달만의 설정 — 그 달 하나에만 적용. 가장 나중에 덮는다 */
  months: CodeHourMonths
  /** 지금 어느 달로 풀어놨는지 */
  month: string
  load: () => Promise<void>
  /** 이 달 기준으로 계산표를 갈아끼운다 — 화면이 달을 바꿀 때마다 부른다 */
  useFor: (month: string) => void
  /** 설정을 저장한 뒤 화면에 곧바로 반영한다 */
  apply: (base: Record<string, number>, rules: CodeHourRule[]) => void
  /**
   * 그 달만의 시간을 저장하고 곧바로 반영한다.
   *
   * 빈 객체를 주면 그 달 설정을 지운다 — 원래 규칙으로 돌아간다.
   * 다른 달의 설정은 건드리지 않는다.
   */
  saveMonth: (month: string, hours: Record<string, number>) => Promise<void>
}

export const useShiftConfig = create<ShiftConfigState>((set, get) => ({
  loaded: false,
  loading: false,
  hours: codeHoursNow(),
  defaults: {},
  base: {},
  rules: [],
  months: {},
  month: '',

  load: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const c = await workScheduleAPI.config()
      const base = c.code_hours ?? {}
      const rules = (c.code_hours_rules ?? []) as CodeHourRule[]
      const months = (c.code_hours_months ?? {}) as CodeHourMonths
      const month = get().month
      setCodeHours(resolveCodeHours(month, base, rules, months))
      set({
        loaded: true, loading: false,
        base, rules, months,
        hours: codeHoursNow(),
        defaults: c.code_hours_default ?? {},
      })
    } catch {
      // 설정을 못 읽으면 기본값으로 간다. 근무표를 아예 못 보는 것보다 낫다.
      set({ loaded: true, loading: false, hours: codeHoursNow() })
    }
  },

  useFor: (month) => {
    const st = get()
    if (st.month === month) return
    setCodeHours(resolveCodeHours(month, st.base, st.rules, st.months))
    set({ month, hours: codeHoursNow() })
  },

  apply: (base, rules) => {
    const st = get()
    setCodeHours(resolveCodeHours(st.month, base, rules, st.months))
    set({ base, rules, hours: codeHoursNow() })
  },

  saveMonth: async (month, hours) => {
    const st = get()
    // 보내는 값은 전체 지도다 — 서버가 통째로 덮어쓴다. 이 달 것만 갈아끼운다.
    const next: CodeHourMonths = { ...st.months }
    if (Object.keys(hours).length) next[month] = hours
    else delete next[month]
    await workScheduleAPI.saveConfig({ code_hours_months: next })
    setCodeHours(resolveCodeHours(st.month, st.base, st.rules, next))
    set({ months: next, hours: codeHoursNow() })
  },
}))

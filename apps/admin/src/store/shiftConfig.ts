import { create } from 'zustand'
import { workScheduleAPI } from '@/api/workScheduleClient'
import { setCodeHours, codeHoursNow, resolveCodeHours, type CodeHourRule } from '@/utils/shiftCodes'

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
  /** 지금 어느 달로 풀어놨는지 */
  month: string
  load: () => Promise<void>
  /** 이 달 기준으로 계산표를 갈아끼운다 — 화면이 달을 바꿀 때마다 부른다 */
  useFor: (month: string) => void
  /** 설정을 저장한 뒤 화면에 곧바로 반영한다 */
  apply: (base: Record<string, number>, rules: CodeHourRule[]) => void
}

export const useShiftConfig = create<ShiftConfigState>((set, get) => ({
  loaded: false,
  loading: false,
  hours: codeHoursNow(),
  defaults: {},
  base: {},
  rules: [],
  month: '',

  load: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const c = await workScheduleAPI.config()
      const base = c.code_hours ?? {}
      const rules = (c.code_hours_rules ?? []) as CodeHourRule[]
      const month = get().month
      setCodeHours(resolveCodeHours(month, base, rules))
      set({
        loaded: true, loading: false,
        base, rules,
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
    setCodeHours(resolveCodeHours(month, st.base, st.rules))
    set({ month, hours: codeHoursNow() })
  },

  apply: (base, rules) => {
    const month = get().month
    setCodeHours(resolveCodeHours(month, base, rules))
    set({ base, rules, hours: codeHoursNow() })
  },
}))

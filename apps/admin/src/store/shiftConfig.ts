import { create } from 'zustand'
import { workScheduleAPI } from '@/api/workScheduleClient'
import { setCodeHours, codeHoursNow } from '@/utils/shiftCodes'

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
  hours: Record<string, number>
  defaults: Record<string, number>
  /** 이미 불러왔으면 아무 일도 하지 않는다 */
  load: () => Promise<void>
  /** 설정을 저장한 뒤 화면에 곧바로 반영한다 */
  apply: (hours: Record<string, number>) => void
}

export const useShiftConfig = create<ShiftConfigState>((set, get) => ({
  loaded: false,
  loading: false,
  hours: codeHoursNow(),
  defaults: {},

  load: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const c = await workScheduleAPI.config()
      setCodeHours(c.code_hours)
      set({
        loaded: true, loading: false,
        hours: codeHoursNow(),
        defaults: c.code_hours_default ?? {},
      })
    } catch {
      // 설정을 못 읽으면 기본값으로 간다. 근무표를 아예 못 보는 것보다 낫다.
      set({ loaded: true, loading: false, hours: codeHoursNow() })
    }
  },

  apply: (hours) => {
    setCodeHours(hours)
    set({ hours: codeHoursNow() })
  },
}))

import {
  EVENT_FREQS, RECURRING,
  getCurrentPeriodKey, getPeriodEnd, cfgFromItem,
  type ChecklistItem,
} from '@/utils/period'

const ONE_TIME = 'one_time'

/** 현재 주기 기준 완료 여부 */
export function checkDone(item: ChecklistItem): boolean {
  const freq = item.frequency
  if (freq === ONE_TIME) {
    if (item.occurrences?.length > 0) return item.occurrences.some(o => o.status === 'completed')
    return item.completed
  }
  if (EVENT_FREQS.includes(freq as any)) return item.completed
  const cfg = cfgFromItem(item)
  if (item.occurrences?.length > 0) {
    const pk = getCurrentPeriodKey(freq as any, cfg)
    const occ = item.occurrences.find(o => o.periodKey === pk)
    if (occ) return occ.status === 'completed'
  }
  const pk = getCurrentPeriodKey(freq as any, cfg)
  return item.completionHistory.some(r => r.periodKey === pk)
}

/** 마감까지 남은 일수(음수=지연). 과거 주기 미완료(overdue occurrence) 포함. 이벤트성은 null */
export function daysLeftOf(item: ChecklistItem, todayStr: string): number | null {
  const todayMid = new Date(todayStr + 'T00:00:00').getTime()
  const diffDays = (ds: string) => Math.round((new Date(ds + 'T00:00:00').getTime() - todayMid) / 86400000)
  let dl: number | null = null
  if (item.frequency === ONE_TIME) {
    if (item.dueDate) dl = diffDays(item.dueDate)
  } else if (RECURRING.includes(item.frequency as any)) {
    const end = getPeriodEnd(item.frequency as any, new Date(), cfgFromItem(item))
    dl = Math.round((end.getTime() - todayMid) / 86400000)
  }
  // 지난 기한 미완료(overdue occurrence)를 반영 → 가장 오래된 것 기준(음수)
  if (item.occurrences?.length) {
    const od = item.occurrences.filter(o => o.status === 'overdue' && o.dueDate)
    if (od.length) {
      const oldest = od.reduce((a, b) => (a.dueDate <= b.dueDate ? a : b))
      const d2 = diffDays(oldest.dueDate)
      if (dl == null || d2 < dl) dl = d2
    }
  }
  return dl
}

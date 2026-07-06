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

/** 마감까지 남은 일수(음수=지연). 이벤트성은 null */
export function daysLeftOf(item: ChecklistItem, todayStr: string): number | null {
  if (item.frequency === ONE_TIME) {
    if (!item.dueDate) return null
    return Math.ceil((new Date(item.dueDate + 'T23:59:59').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
  }
  if (RECURRING.includes(item.frequency as any)) {
    const end = getPeriodEnd(item.frequency as any, new Date(), cfgFromItem(item))
    return Math.ceil((end.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
  }
  return null
}

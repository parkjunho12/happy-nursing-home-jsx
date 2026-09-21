/** 식이는 그대로 두고 별도 외박 기록의 기간만 보여준다. */
export function absencePeriod(a: { start_date: string; start_time?: string | null; end_date?: string | null; end_time?: string | null }): string {
  const stamp = (date: string, time?: string | null) => date + (time ? ' ' + time.slice(0, 5) : '')
  return stamp(a.start_date, a.start_time) + ' ~ ' + (a.end_date ? stamp(a.end_date, a.end_time) : '복귀 미처리')
}

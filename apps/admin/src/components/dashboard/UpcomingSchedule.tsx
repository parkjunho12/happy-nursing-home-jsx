import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, Loader2 } from 'lucide-react'
import {
  scheduleAPI,
  type ScheduleEvent, type LifecycleEvent, type RenewalEvent, type DocCalEvent, type EduCalEvent,
} from '@/api/scheduleClient'
import { recruitmentAPI, type Interview } from '@/api/recruitmentClient'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

const CAT: Record<string, string> = {
  교육: 'bg-orange-50 text-orange-700 border-orange-200',
  방문상담: 'bg-blue-50 text-blue-700 border-blue-200',
  외부방문: 'bg-teal-50 text-teal-700 border-teal-200',
  회의:    'bg-indigo-50 text-indigo-700 border-indigo-200',
  행사:    'bg-pink-50 text-pink-700 border-pink-200',
  기타:    'bg-gray-50 text-gray-600 border-gray-200',
  관리자:  'bg-zinc-100 text-zinc-800 border-zinc-400',   // ADMIN 전용 — 서버가 타 직원 응답에서 제외
  면접:    'bg-violet-50 text-violet-700 border-violet-200',
  입소:    'bg-rose-50 text-rose-600 border-rose-200',
  입사:    'bg-cyan-50 text-cyan-700 border-cyan-200',
  재계약:  'bg-amber-50 text-amber-700 border-amber-200',
  계약서:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  계획서:  'bg-sky-50 text-sky-700 border-sky-200',
  평가:    'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
}

interface Row { key: string; date: string; time?: string; category: string; title: string; location?: string | null }

/** 다가오는 일정 — 일정 캘린더(스케줄)의 앞으로의 일정 */
export default function UpcomingSchedule({ limit = 6, days = 45 }: { limit?: number; days?: number }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    const end = new Date(); end.setDate(end.getDate() + days)
    const s = ymd(today), e = ymd(end)

    Promise.allSettled([
      scheduleAPI.events({ start_date: s, end_date: e }),
      recruitmentAPI.interviews({ start_date: s, end_date: e }),
      scheduleAPI.lifecycle({ start_date: s, end_date: e }),
      scheduleAPI.renewals({ start_date: s, end_date: e }),
      scheduleAPI.docEvents({ start_date: s, end_date: e }),
      scheduleAPI.eduEvents({ start_date: s, end_date: e }),
    ]).then(([ev, iv, lc, rn, dc, ed]) => {
      const out: Row[] = []
      const hm = (iso?: string | null) => {
        if (!iso) return undefined
        const d = new Date(iso)
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`
      }

      if (ev.status === 'fulfilled') (ev.value as ScheduleEvent[]).forEach(x => {
        if (!x.start_at) return
        out.push({ key: `e-${x.id}`, date: ymd(new Date(x.start_at)), time: hm(x.start_at),
                   category: x.category, title: x.title, location: x.location })
      })
      if (iv.status === 'fulfilled') (iv.value as Interview[]).forEach(x => {
        if (!x.interview_at) return
        out.push({ key: `i-${x.id}`, date: ymd(new Date(x.interview_at)), time: hm(x.interview_at),
                   category: '면접', title: `면접 · ${x.name}`, location: x.location })
      })
      if (lc.status === 'fulfilled') (lc.value as LifecycleEvent[]).forEach(x => {
        if (!x.date) return
        const c = x.kind === 'admission' ? '입소' : '입사'
        out.push({ key: `l-${x.kind}-${x.id}`, date: x.date, category: c, title: `${c} · ${x.name}` })
      })
      if (rn.status === 'fulfilled') (rn.value as RenewalEvent[]).forEach(x => {
        if (!x.date) return
        out.push({ key: `r-${x.id}`, date: x.date, category: '재계약',
                   title: `재계약 · ${x.name ?? ''}${x.position ? ` (${x.position})` : ''}` })
      })
      if (dc.status === 'fulfilled') (dc.value as DocCalEvent[]).forEach(x => {
        if (!x.date) return
        const c = x.doc_type === 'contract' ? '계약서' : x.doc_type === 'plan' ? '계획서' : '평가'
        out.push({ key: `d-${x.id}`, date: x.date, category: c,
                   title: `${x.doc_label} · ${x.name ?? ''}${x.kind ? ` (${x.kind})` : ''}` })
      })
      // 의무교육 — 이미 실시한 건은 '다가오는 일정'에서 제외
      if (ed.status === 'fulfilled') (ed.value as EduCalEvent[]).forEach(x => {
        if (!x.date || x.done) return
        out.push({ key: `edu-${x.id}`, date: x.date, category: '교육',
                   title: x.title, location: x.org })
      })

      const todayStr = ymd(today)
      setRows(out.filter(r => r.date >= todayStr)
                 .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))))
    }).finally(() => setLoading(false))
  }, [days])

  const shown = useMemo(() => rows.slice(0, limit), [rows, limit])
  const todayStr = ymd(new Date())
  const dday = (iso: string) =>
    Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <CalendarDays size={14} className="text-violet-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">다가오는 일정</h2>
          {rows.length > 0 && <span className="text-[11px] text-gray-400">{rows.length}건</span>}
        </div>
        <button onClick={() => navigate('/schedule')}
          className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 inline-flex items-center">
          일정 캘린더 <ChevronRight size={13} />
        </button>
      </div>

      <div className="px-2.5 py-1">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : shown.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">앞으로 {days}일간 예정된 일정이 없습니다</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {shown.map(r => {
              const d = dday(r.date)
              const dt = new Date(r.date + 'T00:00:00')
              const soon = d <= 1
              return (
                <li key={r.key} onClick={() => navigate('/schedule')}
                  className="flex items-center gap-2.5 px-1.5 py-2 min-h-[44px] rounded-lg hover:bg-violet-50/50 cursor-pointer transition-colors">
                  {/* D-day 칩 */}
                  <span className={`w-11 shrink-0 text-center text-[10px] font-extrabold rounded-md py-1 ${
                    d === 0 ? 'bg-violet-500 text-white'
                    : d === 1 ? 'bg-violet-100 text-violet-700'
                    : 'bg-gray-100 text-gray-500'}`}>
                    {d === 0 ? '오늘' : d === 1 ? '내일' : `D-${d}`}
                  </span>

                  {/* 모바일: 2줄(제목 / 분류·일시) · 데스크톱: 1줄 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`hidden md:inline shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${CAT[r.category] ?? CAT.기타}`}>
                        {r.category}
                      </span>
                      <p className={`flex-1 min-w-0 text-[13px] truncate ${soon ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {r.title}
                        {r.location && <span className="hidden md:inline text-gray-400 font-normal"> · {r.location}</span>}
                      </p>
                      <span className="hidden md:inline shrink-0 text-[11px] text-gray-400 tabular-nums">
                        {dt.getMonth() + 1}.{dt.getDate()}({WEEK[dt.getDay()]}){r.time ? ` ${r.time}` : ''}
                      </span>
                    </div>
                    <div className="md:hidden flex items-center gap-1.5 mt-1">
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${CAT[r.category] ?? CAT.기타}`}>
                        {r.category}
                      </span>
                      <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                        {dt.getMonth() + 1}.{dt.getDate()}({WEEK[dt.getDay()]}){r.time ? ` ${r.time}` : ''}
                      </span>
                      {r.location && <span className="text-[11px] text-gray-400 truncate">· {r.location}</span>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

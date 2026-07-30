'use client'

/**
 * 홈페이지 신뢰 신호 — "프로그램표·식단표가 지금도 갱신되고 있다"는 느낌만 전달.
 * 상세 내용(메뉴·프로그램명)은 절대 노출하지 않는다 — 건수·기간·갱신 시각뿐.
 * 흐릿한 장식 칩으로 '가려진 문서' 분위기를 내고, 자물쇠로 보호자 전용임을 알린다.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChefHat, Lock, ArrowRight } from 'lucide-react'
import { resolveApiBase } from '@/lib/api-client'

type Status = {
  program: { month: string; day_count: number; updated_at: string | null } | null
  meal: { week_start: string; week_end: string; day_count: number; updated_at: string | null } | null
  today?: {
    program: { items: string[]; total: number } | null
    meal: { lunch: string[]; side_count: number; snack: string | null } | null
  }
}

const rel = (iso: string | null) => {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600e3)
  if (h < 1) return '방금 전 업데이트'
  if (h < 24) return `${h}시간 전 업데이트`
  const d = Math.floor(h / 24)
  if (d <= 7) return `${d}일 전 업데이트`
  return `${new Date(iso).getMonth() + 1}월 ${new Date(iso).getDate()}일 업데이트`
}
const md = (s: string) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`

/** 흐릿한 장식 칩 — 실제 데이터가 아니라 '가려진 일정' 분위기용 */
function BlurChips({ tone }: { tone: 'violet' | 'orange' }) {
  const base = tone === 'violet'
    ? ['bg-violet-200', 'bg-sky-200', 'bg-emerald-200', 'bg-violet-100', 'bg-sky-100']
    : ['bg-orange-200', 'bg-amber-200', 'bg-orange-100', 'bg-amber-100', 'bg-orange-200']
  const widths = ['w-16', 'w-24', 'w-14', 'w-20', 'w-16', 'w-24', 'w-12', 'w-20', 'w-16']
  return (
    <div className="absolute inset-0 p-5 pt-16 blur-[7px] opacity-50 select-none pointer-events-none" aria-hidden>
      <div className="flex flex-wrap gap-2">
        {widths.map((w, i) => (
          <span key={i} className={`h-5 rounded-md ${w} ${base[i % base.length]}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {widths.slice(0, 6).map((w, i) => (
          <span key={i} className={`h-5 rounded-md ${w} ${base[(i + 2) % base.length]}`} />
        ))}
      </div>
    </div>
  )
}

export default function LiveCareSection() {
  const [st, setSt] = useState<Status | null>(null)

  useEffect(() => {
    fetch(`${resolveApiBase()}/api/v1/public/care-status`)
      .then(r => r.json())
      .then(j => setSt(j?.data ?? null))
      .catch(() => setSt(null))
  }, [])

  const cards = [
    {
      icon: CalendarDays,
      tone: 'violet' as const,
      accent: 'text-violet-600', ring: 'border-violet-100',
      title: '월간 프로그램표',
      headline: st?.program
        ? `${Number(st.program.month.slice(5, 7))}월 프로그램표 게시 중`
        : '매월 새로 계획합니다',
      sub: st?.program
        ? `한 달 ${st.program.day_count}일치 인지·여가·신체 활동이 계획되어 있어요`
        : '인지 · 여가 · 신체 활동을 그룹별로 매일 진행합니다',
      meta: rel(st?.program?.updated_at ?? null),
      teaser: st?.today?.program
        ? `오늘은 ${st.today.program.items.join(', ')}${st.today.program.total > st.today.program.items.length ? ` 외 ${st.today.program.total - st.today.program.items.length}가지` : ''}`
        : null,
      teaserIcon: '🧩',
    },
    {
      icon: ChefHat,
      tone: 'orange' as const,
      accent: 'text-orange-500', ring: 'border-orange-100',
      title: '주간 식단표',
      headline: st?.meal
        ? `이번 주 식단 등록 완료 (${md(st.meal.week_start)} ~ ${md(st.meal.week_end)})`
        : '매주 새로 올라옵니다',
      sub: '아침 · 점심 · 저녁과 간식까지, 하루 다섯 번의 식사를 미리 계획합니다',
      meta: rel(st?.meal?.updated_at ?? null),
      teaser: st?.today?.meal
        ? `오늘 점심은 ${st.today.meal.lunch.join('과 ')}${st.today.meal.side_count > 0 ? ` 외 ${st.today.meal.side_count}찬` : ''}${st.today.meal.snack ? ` · 간식은 ${st.today.meal.snack}` : ''}`
        : null,
      teaserIcon: '🍲',
    },
  ]

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-amber-50/60 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-12">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            Living Schedule
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            어르신의 하루는 오늘도 계획대로
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto">
            프로그램표와 식단표가 지금도 계속 업데이트되고 있습니다.
            <br className="hidden md:block" />
            오늘의 한 조각만 살짝 보여드려요 — 전체 내용은 보호자님께만 공개됩니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto">
          {cards.map(c => (
            <div key={c.title}
              className={`relative overflow-hidden rounded-3xl bg-white border ${c.ring} shadow-sm hover:shadow-lg transition-shadow p-6 min-h-[220px]`}>
              <BlurChips tone={c.tone} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <c.icon className={`w-5 h-5 ${c.accent}`} />
                  <span className="font-bold text-gray-800">{c.title}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    운영 중
                  </span>
                </div>
                <p className="text-xl font-extrabold text-gray-900 leading-snug">{c.headline}</p>
                <p className="text-sm text-text-gray mt-1.5 leading-relaxed">{c.sub}</p>
                {c.teaser && (
                  <p className="mt-3 inline-flex items-start gap-1.5 text-[13px] font-semibold text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
                    <span aria-hidden>{c.teaserIcon}</span>
                    <span>{c.teaser}</span>
                  </p>
                )}
                {c.meta && (
                  <p className={`text-xs font-bold mt-3 ${c.accent}`}>⟳ {c.meta}</p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-4 pt-3 border-t border-gray-50">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  상세 내용은 보호자앱에서 로그인 후 확인하실 수 있습니다
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/family"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-primary-orange text-white font-bold shadow-lg shadow-orange-200/60 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            보호자앱에서 확인하기 <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-gray-400 mt-3">입소 상담 중이시라면 방문 시 이번 달 프로그램표와 식단표를 직접 보여드립니다.</p>
        </div>
      </div>
    </section>
  )
}

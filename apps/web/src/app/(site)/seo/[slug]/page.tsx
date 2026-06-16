import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import Link from 'next/link'
import PhoneConsultButton from '@/components/common/PhoneConsultButton'
import {
  SEO_PAGES, SEO_PAGE_MAP,
  SITE, COMMON_SELECTION_POINTS, FACILITY_POINTS, COMMON_CHECKLIST,
  type SeoPage,
} from '@/lib/seo-pages'

// ── 정적 경로 생성 ─────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return SEO_PAGES.map(p => ({ slug: p.slug }))
}

// ── 메타데이터 ─────────────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const page = SEO_PAGE_MAP[slug]
  if (!page) return {}

  const canonical = `${SITE.baseUrl}/seo/${page.slug}`

  return {
    title:       page.title,
    description: page.description,
    keywords:    page.subKeywords,
    alternates:  { canonical },
    openGraph: {
      title:       page.title,
      description: page.description,
      url:         canonical,
      siteName:    SITE.name,
      type:        'website',
      locale:      'ko_KR',
    },
    robots: { index: true, follow: true },
  }
}

// ── JSON-LD 생성 ───────────────────────────────────────────────────────────────
function makeLocalBusinessJsonLd(page: SeoPage) {
  return {
    '@context': 'https://schema.org',
    '@type':    'LocalBusiness',
    '@id':      `${SITE.baseUrl}/seo/${page.slug}`,
    name:       SITE.name,
    url:        `${SITE.baseUrl}/seo/${page.slug}`,
    telephone:  SITE.phone,
    address: {
      '@type':           'PostalAddress',
      streetAddress:     SITE.address,
      addressLocality:   '양주시',
      addressRegion:     '경기도',
      addressCountry:    'KR',
    },
    areaServed: ['양주시', '의정부시', '경기도', '서울특별시'],
    description: page.description,
  }
}

function makeFaqJsonLd(page: SeoPage) {
  return {
    '@context':  'https://schema.org',
    '@type':     'FAQPage',
    mainEntity:  page.faqs.map(faq => ({
      '@type':        'Question',
      name:           faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }
}

// ── 페이지 컴포넌트 ────────────────────────────────────────────────────────────
export default async function SeoLandingPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const page = SEO_PAGE_MAP[slug]
  if (!page) notFound()

  return (
    <>
      {/* JSON-LD */}
      <Script
        id="json-ld-local"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(makeLocalBusinessJsonLd(page)) }}
      />
      <Script
        id="json-ld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(makeFaqJsonLd(page)) }}
      />

      <main className="min-h-screen bg-white">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative bg-gradient-to-br from-slate-800 to-slate-700 pt-24 pb-16 px-4">
          <div className="absolute inset-0 bg-[url('/images/facility-bg.jpg')] bg-cover bg-center opacity-10" />
          <div className="relative max-w-3xl mx-auto text-center">
            <p className="inline-block text-xs font-semibold tracking-widest text-orange-300 uppercase mb-4">
              {SITE.mapLabel} · 입소 상담
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-snug mb-3">
              {page.h1}
            </h1>
            <p className="text-base text-white/70 mb-2">{page.heroSub}</p>
            <p className="text-sm text-white/60 mb-8 max-w-xl mx-auto leading-relaxed">
              {page.heroDesc}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <PhoneConsultButton
                phoneNumber={SITE.phone}
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base px-7 py-3.5 rounded-full transition-colors shadow-lg"
              >
                📞 {SITE.display} 상담 전화
              </PhoneConsultButton>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-6 py-3.5 rounded-full border border-white/20 transition-colors"
              >
                시설 홈페이지 방문
              </Link>
            </div>
          </div>
        </section>

        {/* ── 접근성 안내 띠 ─────────────────────────────────────────────────── */}
        <div className="bg-orange-50 border-b border-orange-100 py-3 px-4">
          <p className="max-w-3xl mx-auto text-center text-sm text-orange-700 font-medium">
            📍 {page.accessNote}
          </p>
        </div>

        {/* ── 지역 관점 섹션 ────────────────────────────────────────────────── */}
        <section className="py-14 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4">
              {page.regionHeading}
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              {page.regionDesc}
            </p>
          </div>
        </section>

        {/* ── 요양원 선택 기준 ─────────────────────────────────────────────── */}
        <section className="py-14 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
              요양원 선택 시 실제로 확인해야 할 것들
            </h2>
            <p className="text-sm text-slate-500 mb-8">
              {page.mainKeyword}을 검색하셨다면 아래 항목들을 방문 상담 시 직접 확인해 보세요.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {COMMON_SELECTION_POINTS.map((pt, i) => (
                <div key={i} className="flex gap-3 bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{pt.icon}</span>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm mb-1">{pt.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{pt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 시설 소개 ────────────────────────────────────────────────────── */}
        <section className="py-14 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold tracking-widest text-orange-500 uppercase mb-2">
              시설 안내
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">
              행복한요양원 녹양역점 주요 특징
            </h2>
            <ul className="space-y-3">
              {FACILITY_POINTS.map((pt, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="mt-1 w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    ✓
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{pt}</p>
                </li>
              ))}
            </ul>

            <div className="mt-8 bg-orange-50 rounded-2xl p-5 border border-orange-100">
              <p className="text-sm font-semibold text-orange-800 mb-1">입소 상담 안내</p>
              <p className="text-xs text-orange-700 leading-relaxed mb-4">
                전화 상담 → 어르신 상태 확인 → 방문 시설 견학 → 입소일 조율 순으로 진행됩니다.
                먼저 전화로 간단히 말씀 주시면 구체적으로 안내해 드립니다.
              </p>
              <PhoneConsultButton
                phoneNumber={SITE.phone}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
              >
                📞 {SITE.display} 전화 상담
              </PhoneConsultButton>
            </div>
          </div>
        </section>

        {/* ── 체크리스트 ───────────────────────────────────────────────────── */}
        <section className="py-14 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
              방문 상담 전 전화로 먼저 확인하면 좋은 항목
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              아래 항목을 미리 확인해 두시면 상담이 더 수월합니다.
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {COMMON_CHECKLIST.map((item, i) => (
                <div key={i} className="flex gap-2.5 items-start bg-white rounded-xl px-4 py-3 border border-slate-100 text-sm text-slate-700">
                  <span className="text-orange-400 font-bold flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="py-14 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-8">
              자주 묻는 질문
            </h2>
            <div className="space-y-4">
              {page.faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="flex gap-3 px-5 py-4 bg-slate-50">
                    <span className="text-orange-500 font-bold text-sm flex-shrink-0 mt-0.5">Q.</span>
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{faq.q}</p>
                  </div>
                  <div className="flex gap-3 px-5 py-4 bg-white">
                    <span className="text-slate-400 font-bold text-sm flex-shrink-0 mt-0.5">A.</span>
                    <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 관련 지역 페이지 내부 링크 ──────────────────────────────────── */}
        <section className="py-12 px-4 bg-slate-50 border-t border-slate-100">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
              관련 지역 안내
            </p>
            <div className="flex flex-wrap gap-2">
              {page.related.map(rel => (
                <Link
                  key={rel.slug}
                  href={`/seo/${rel.slug}`}
                  className="inline-block text-sm text-slate-600 hover:text-orange-600 bg-white border border-slate-200 hover:border-orange-200 px-3.5 py-2 rounded-full transition-colors"
                >
                  {rel.label} →
                </Link>
              ))}
              <Link
                href="/"
                className="inline-block text-sm text-white bg-slate-700 hover:bg-slate-800 px-3.5 py-2 rounded-full transition-colors"
              >
                홈페이지 방문
              </Link>
            </div>
          </div>
        </section>

        {/* ── 하단 CTA ─────────────────────────────────────────────────────── */}
        <section className="py-14 px-4 bg-slate-800 text-center">
          <p className="text-white/60 text-sm mb-2">{SITE.name}</p>
          <p className="text-white font-bold text-2xl mb-1">{SITE.display}</p>
          <p className="text-white/50 text-xs mb-6">
            평일 · 주말 상담 가능 · {SITE.address}
          </p>
          <PhoneConsultButton
            phoneNumber={SITE.phone}
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base px-8 py-4 rounded-full transition-colors shadow-xl"
          >
            📞 지금 상담 전화하기
          </PhoneConsultButton>
          <p className="text-white/30 text-xs mt-6 max-w-md mx-auto">
            본 페이지는 장기요양기관 정보 안내 목적으로 작성되었습니다.
            입소 가능 여부 및 세부 사항은 상담을 통해 확인하시기 바랍니다.
          </p>
        </section>

      </main>
    </>
  )
}

import type { Metadata } from 'next'
import Image from 'next/image'
import {
  Heart, Phone, MessageCircleHeart, Users, Sparkles, HandHeart,
  CheckCircle2, ClipboardList, PhoneCall, HandHelping, ChevronDown, Clock3,
} from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'
import VolunteerForm from './VolunteerForm'

const BASE_URL = 'https://www.행복한요양원녹양역.com'

export const metadata: Metadata = {
  title: '자원봉사 모집 | 행복한요양원 녹양역점',
  description:
    '함께하는 작은 손길이 어르신께 큰 행복이 됩니다. 경험이 없어도, 원하는 시간만으로도 괜찮습니다. 말벗·프로그램 보조·행사 지원·재능기부 자원봉사에 참여해보세요. 온라인 1분 신청.',
  alternates: { canonical: `${BASE_URL}/volunteer` },
  openGraph: {
    title: '자원봉사 모집 | 행복한요양원 녹양역점',
    description: '경험 없어도 OK · 원하는 시간만 · 담당자가 함께합니다. 자원봉사 신청 안내.',
    url: `${BASE_URL}/volunteer`,
    type: 'website',
    locale: 'ko_KR',
    siteName: '행복한요양원 녹양역점',
  },
  robots: { index: true, follow: true },
}

const activities = [
  { icon: MessageCircleHeart, title: '말벗·정서 지원', desc: '어르신과 눈을 맞추고 이야기를 나눠요. 따뜻한 마음이면 충분합니다.', img: '/assets/images/album/album-cognition-1to1.jpg', color: 'text-rose-600 bg-rose-50' },
  { icon: Users, title: '프로그램 보조', desc: '인지·신체 프로그램을 곁에서 돕고 함께 웃어요. 담당 선생님과 함께 진행합니다.', img: '/assets/images/album/album-band-exercise.jpg', color: 'text-blue-600 bg-blue-50' },
  { icon: Sparkles, title: '행사 지원', desc: '생신잔치, 나들이, 명절 행사 등 특별한 날을 함께 만들어요.', img: '/assets/images/39_program.jpg', color: 'text-amber-600 bg-amber-50' },
  { icon: HandHeart, title: '재능기부', desc: '음악, 미용, 공예, 사진 등 가진 재능을 어르신께 나눠주세요.', img: '/assets/images/33_haircut.jpg', color: 'text-violet-600 bg-violet-50' },
]

const welcome = [
  '나이·성별 관계없이 따뜻한 마음을 가진 누구나',
  '봉사가 처음이어도 괜찮아요 — 담당자가 끝까지 함께합니다',
  '한 달에 한 번, 원하는 요일·시간만으로도 충분해요',
  '어르신과 이야기 나누는 걸 좋아하는 분',
  '가진 재능(음악·미용·공예 등)을 나누고 싶은 분',
]

const steps = [
  { icon: ClipboardList, title: '1. 신청서 작성', desc: '위 폼을 1분만에 작성해주세요. 필수 항목만 적어도 됩니다.' },
  { icon: PhoneCall, title: '2. 담당자 상담', desc: '담당자가 연락드려 활동 내용과 일정을 편하게 안내해드려요.' },
  { icon: HandHelping, title: '3. 봉사 시작', desc: '어르신과 함께 따뜻한 시간을 보냅니다. 처음엔 함께 도와드려요.' },
]

const faqs = [
  { q: '봉사 경험이 없어도 되나요?', a: '네, 처음이신 분도 환영합니다. 활동 전 담당자가 충분히 안내해드리고, 처음에는 곁에서 함께 도와드리니 부담 갖지 않으셔도 됩니다.' },
  { q: '나이 제한이 있나요?', a: '특별한 제한은 없습니다. 따뜻한 마음을 가진 분이면 누구나 환영합니다. (청소년은 보호자 동의가 필요할 수 있으니 상담 시 문의해주세요.)' },
  { q: '시간은 얼마나 내야 하나요?', a: '정해진 의무 시간은 없습니다. 가능한 요일과 시간을 알려주시면 일정에 맞춰 안내드립니다. 한 달에 한 번도 좋습니다.' },
  { q: '무엇을 준비해야 하나요?', a: '편한 복장과 따뜻한 마음이면 충분합니다. 활동에 필요한 사항은 상담 시 자세히 안내해드립니다.' },
  { q: '봉사확인서를 받을 수 있나요?', a: '활동 후 봉사확인서 발급은 담당자에게 문의해주세요. 신청 시 메모에 남겨주시면 상담 때 함께 안내드립니다.' },
]

export default function VolunteerPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      {/* HERO + 신청 폼 (한 화면에서 바로 신청) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#fff5ec] via-[#fff9f4] to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* 좌: 카피 */}
            <div className="lg:pt-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 mb-5 shadow-sm">
                <Heart className="w-4 h-4" /> 자원봉사자 모집
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.8rem] font-bold leading-[1.2] tracking-[-0.02em] text-gray-900">
                함께하는 작은 손길이<br />
                어르신께 <span className="text-primary-orange">큰 행복</span>이 됩니다
              </h1>
              <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
                거창하지 않아도 괜찮습니다. 짧은 대화 한 마디, 함께 웃는 한 순간이
                어르신의 하루를 따뜻하게 채웁니다.
              </p>

              <ul className="mt-6 space-y-2.5">
                {['경험 없어도 OK — 담당자가 함께해요', '한 달에 한 번, 원하는 시간만도 좋아요', '신청은 약 1~3분이면 충분해요'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-gray-700">
                    <CheckCircle2 className="w-5 h-5 text-primary-orange shrink-0" />
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 hidden lg:flex items-center gap-3 rounded-2xl bg-white/70 border border-orange-100 p-4 max-w-md">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image src="/assets/images/album/album-cognition-1to1.jpg" alt="어르신과 손을 맞잡은 자원봉사자" fill className="object-cover" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  “손 한번 잡아드린 게 전부인데…” <br />그 하루가 어르신껜 가장 따뜻한 시간이 됩니다.
                </p>
              </div>

              <a href={`tel:${SITE_INFO.phone}`} className="mt-6 inline-flex items-center gap-2 text-gray-700 font-semibold">
                <Phone className="w-4 h-4 text-primary-orange" /> 전화 문의 {SITE_INFO.phone}
              </a>
            </div>

            {/* 우: 신청 폼 (스크롤 거의 없이 바로) */}
            <div id="apply" className="scroll-mt-24">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(184,110,40,0.14)]">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-xl font-bold text-gray-900">자원봉사 신청</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                    <Clock3 className="w-3.5 h-3.5" /> 1~3분
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-5">필수 항목만 적어주셔도 됩니다. 나머지는 상담 때 함께 정해요.</p>
                <VolunteerForm />
                <p className="text-center text-xs text-gray-400 mt-4">🔒 입력 정보는 자원봉사 상담 목적으로만 사용되며 안전하게 보호됩니다.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 활동 소개 */}
      <section className="py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">이런 활동으로 함께해요</h2>
            <p className="text-gray-600">잘하는 것, 좋아하는 것으로 참여하시면 됩니다.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {activities.map((a) => {
              const Icon = a.icon
              return (
                <div key={a.title} className="group rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="relative h-40 overflow-hidden">
                    <Image src={a.img} alt={a.title} fill loading="lazy" sizes="(max-width:1024px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <div className={`w-11 h-11 rounded-xl ${a.color} flex items-center justify-center mb-3 -mt-9 relative ring-4 ring-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1.5">{a.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 이런 분을 기다려요 */}
      <section className="py-14 md:py-20 bg-[#faf7f3]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="relative aspect-[4/3] rounded-[28px] overflow-hidden shadow-lg order-2 lg:order-1">
              <Image src="/assets/images/handmassage.jpeg" alt="자원봉사자가 어르신께 따뜻한 손길을 전하는 모습" fill loading="lazy" sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">이런 분을 기다려요</h2>
              <p className="text-gray-600 mb-6">특별한 자격은 없습니다. 마음만 있으면 누구나 환영합니다.</p>
              <ul className="space-y-3">
                {welcome.map((w) => (
                  <li key={w} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary-orange mt-0.5 shrink-0" />
                    <span className="text-gray-700 leading-relaxed">{w}</span>
                  </li>
                ))}
              </ul>
              <a href="#apply" className="mt-7 inline-flex items-center gap-2 px-6 py-3.5 bg-primary-orange text-white rounded-xl font-bold hover:bg-primary-orange/90 transition-colors shadow-lg shadow-orange-200">
                지금 신청하기 →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 참여 방법 3단계 */}
      <section className="py-14 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">참여 방법은 간단해요</h2>
            <p className="text-gray-600">신청부터 활동까지, 담당자가 차근차근 함께합니다.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={s.title} className="relative rounded-3xl bg-white border border-gray-100 p-6 shadow-sm text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 text-primary-orange flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                  {i < steps.length - 1 && <ChevronDown className="hidden sm:block absolute top-1/2 -right-3.5 w-7 h-7 text-orange-200 -rotate-90" />}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 md:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">자주 묻는 질문</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-gray-100 bg-white px-5 sm:px-6 open:border-orange-100 transition-colors">
                <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none font-bold text-gray-900">
                  {f.q}
                  <ChevronDown className="w-5 h-5 shrink-0 text-primary-orange transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary-orange to-primary-brown text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-snug">
            당신의 작은 시간이<br className="sm:hidden" /> 어르신껜 가장 따뜻한 하루가 됩니다
          </h2>
          <p className="text-lg text-white/90 mb-8">지금 마음을 들려주세요. 담당자가 친절하게 안내해드립니다.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#apply" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-orange rounded-2xl font-bold hover:bg-gray-100 transition-colors">
              📝 자원봉사 신청하기
            </a>
            <a href={`tel:${SITE_INFO.phone}`} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white rounded-2xl font-bold hover:bg-white/20 transition-colors">
              <Phone className="w-5 h-5" /> {SITE_INFO.phone}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

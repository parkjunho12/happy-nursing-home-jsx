import Link from 'next/link'
import HeroSlider from '@/components/home/HeroSlider'
import HeroSliderMobile from '@/components/home/HeroSliderMobile'
import {
  QuickContact,
  ServicesSection,
  DifferentiatorsSection,
} from '@/components/home/Sections'
import { ReviewsSection } from '@/components/home/ReviewsAndGallery'
import { GallerySection } from '@/components/home/GallerySection'
import AlbumPreviewSection from '@/components/home/AlbumPreviewSection'
import LiveCareSection from '@/components/home/LiveCareSection'
import LatestVideosSection from '@/components/home/LatestVideosSection'
import ContactFormSection from '@/components/home/ContactFormSection'
import YouTubeButton from '@/components/video/modal/YouTubeButton'

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      {/* Hero Slider - 감성 중심 메인 배너 */}
      <div className="hidden md:block">
        <HeroSlider />
      </div>

      <div className="block md:hidden">
        <HeroSliderMobile />
      </div>

      {/* Video Tour - Hero 바로 아래로 이동 */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
              VIDEO TOUR
            </div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
              우리 부모님의 하루, 영상으로 먼저 확인해보세요
            </h2>
            <p className="text-lg text-text-gray max-w-2xl mx-auto">
              시설 사진보다 실제 어르신들의 하루를 먼저 보여드립니다.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <YouTubeButton
              videoId="oIGB8jPFgWI"
              title="행복한요양원 녹양역점 어르신들의 하루 일과 영상"
              thumbnail="/assets/images/album/album-band-exercise.jpg"
              variant="thumbnail"
              className="w-full rounded-2xl overflow-hidden shadow-large hover:shadow-xl transition-shadow duration-300"
            />
          </div>
        </div>
      </section>

      {/* 살아있는 일정 — 프로그램·식단이 계속 갱신되고 있다는 신뢰 신호 (상세는 비공개) */}
      <LiveCareSection />

      {/* 보호자 앨범 안내 - Video Tour 바로 아래 (신뢰 강화) */}
      <AlbumPreviewSection />

      {/* 최신 영상 캐러셀 — 유튜브 채널 자동 연동 */}
      <LatestVideosSection />

      {/* Quick Contact Bar - 빠른 상담 접근 */}
      <QuickContact />

      {/* Gallery Section - 카테고리별 시설 사진 */}
      <GallerySection />

      {/* Services Section - 사진 카드 형태 */}
      <ServicesSection />

      {/* Differentiators Section - 핵심 차별점 */}
      <DifferentiatorsSection />

      {/* Reviews Section */}
      <ReviewsSection />


      {/* 지역별 요양원 안내 - 내부 링크 강화 (SEO) */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
              LOCAL GUIDE
            </div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
              지역별 요양원 안내
            </h2>
            <p className="text-lg text-text-gray max-w-2xl mx-auto">
              거주 지역에 맞춰 위치, 접근성, 시설 정보를 정리했습니다.
              가까운 지역 안내를 확인해보세요.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                href: '/yangju-nursing-home',
                title: '양주요양원 안내',
                desc: '양주 인근 보호자님을 위한 위치·시설·상담 안내',
              },
              {
                href: '/uijeongbu-nursing-home',
                title: '의정부요양원 안내',
                desc: '의정부에서 차로 약 5분, 녹양역 인근 단독건물형',
              },
              {
                href: '/nogyang-station-nursing-home',
                title: '녹양역요양원 안내',
                desc: '녹양역 인근, 대중교통으로 면회하기 편한 위치',
              },
              {
                href: '/nursing-home-near-uijeongbu-yangju',
                title: '의정부·양주 인근 요양원 안내',
                desc: '의정부와 양주 사이, 경기북부 보호자님을 위한 안내',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col rounded-2xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-lg hover:border-primary-orange/40 transition-all duration-300"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-orange transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-text-gray leading-relaxed flex-1">
                  {item.desc}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-orange">
                  자세히 보기
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>

          {/* 서울 북부 보호자 배너 */}
          <Link href="/seoul-northern-nursing-home" className="group mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-primary-orange to-amber-500 text-white px-6 py-5 shadow-lg shadow-orange-200/60 hover:shadow-xl transition-all">
            <div>
              <p className="font-bold text-lg">서울 도봉·노원·강북·중랑·성북·강동에서 오시나요?</p>
              <p className="text-white/90 text-sm mt-0.5">서울과 가까운 녹양역 인근 + 보호자 앨범으로, 멀어도 어르신 일상을 매주 확인하세요.</p>
            </div>
            <span className="inline-flex items-center gap-1 font-bold whitespace-nowrap">서울 북부 안내 보기 <span aria-hidden="true">→</span></span>
          </Link>
        </div>
      </section>

      {/* Contact Form Section */}
      <ContactFormSection />
    </main>
  )
}

import Link from 'next/link'
import HeroSlider from '@/components/home/HeroSlider'
import HeroSliderMobile from '@/components/home/HeroSliderMobile'
import { 
  QuickContact, 
  ServicesSection, 
  DifferentiatorsSection 
} from '@/components/home/Sections'
import { ReviewsSection } from '@/components/home/ReviewsAndGallery'
import { GallerySection } from '@/components/home/GallerySection'
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
      
      {/* Quick Contact Bar - 빠른 상담 접근 */}
      <QuickContact />

      {/* Gallery Section - 카테고리별 시설 사진 */}
      <GallerySection />

      {/* 메인 영상 섹션 */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
              VIDEO TOUR
            </div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
              영상으로 만나는 행복한요양원 녹양역점
            </h2>
            <p className="text-lg text-text-gray max-w-2xl mx-auto">
              쾌적한 시설과 따뜻한 분위기를 직접 확인해보세요
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <YouTubeButton
              videoId="x_ltZwPZgsk"
              title="행복한요양원 녹양역점 시설 소개 영상"
              thumbnail="/assets/images/gate.jpeg"
              variant="thumbnail"
              className="w-full rounded-2xl overflow-hidden shadow-large hover:shadow-xl transition-shadow duration-300"
            />
          </div>
        </div>
      </section>

      {/* Services Section - 사진 카드 형태 */}
      <ServicesSection />

      {/* Differentiators Section - 핵심 차별점 */}
      <DifferentiatorsSection />

      {/* Reviews Section */}
      <ReviewsSection />


      {/* 지역별 요양원 안내 - 내부 링크 강화 (SEO) */}
      <section className="py-16 md:py-24 bg-[#faf7f3]">
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
        </div>
      </section>

      {/* Contact Form Section */}
      <ContactFormSection />
    </main>
  )
}
import HeroSlider from '@/components/home/HeroSlider'
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
      <HeroSlider />
      
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
              영상으로 만나는 행복한요양원
            </h2>
            <p className="text-lg text-text-gray max-w-2xl mx-auto">
              쾌적한 시설과 따뜻한 분위기를 직접 확인해보세요
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <YouTubeButton
              videoId="x_ltZwPZgsk"
              title="행복한요양원 시설 소개 영상"
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

      {/* Contact Form Section */}
      <ContactFormSection />
    </main>
  )
}
import HeroSection from '@/components/home/HeroSection'
import { 
  QuickContact, 
  ServicesSection, 
  DifferentiatorsSection 
} from '@/components/home/Sections'
import { 
  ReviewsSection
} from '@/components/home/ReviewsAndGallery'
import {GallerySection} from '@/components/home/GallerySection'
import ContactFormSection from '@/components/home/ContactFormSection'
import YouTubeButton from '@/components/video/modal/YouTubeButton'
import HeroSlider from '@/components/home/HeroSlider'
import HeroSliderMobile from '@/components/home/HeroSliderMobile'

export default function HomePage() {
  
  return (
    <>
      {/* Hero Section */}
      
      <HeroSlider />
      
      {/* 모바일 */}
      
      {/* Quick Contact Bar */}
      <QuickContact />

      {/* ⭐ 메인 영상 - Hero 직후 */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              영상으로 만나는 행복한요양원
            </h2>
            <p className="text-lg text-gray-600">
              쾌적한 시설과 따뜻한 분위기를 직접 확인해보세요
            </p>
          </div>
          
          <YouTubeButton
              videoId="x_ltZwPZgsk"
              title="행복한요양원 시설 소개 영상"
              thumbnail="/assets/images/gate.jpeg"
              variant="thumbnail"
              className="w-full"
            />
        </div>
      </section>

      {/* Gallery Section */}
      <GallerySection />

      {/* Services Section */}
      <ServicesSection />

      {/* Differentiators Section */}
      <DifferentiatorsSection />

      {/* Reviews Section */}
      <ReviewsSection />

      {/* Contact Form Section */}
      <ContactFormSection />
    </>
  )
}
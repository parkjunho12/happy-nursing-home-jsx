import HeroSection from '@/components/home/HeroSection'
import { 
  QuickContact, 
  ServicesSection, 
  DifferentiatorsSection 
} from '@/components/home/Sections'
import { 
  ReviewsSection, 
  GallerySection 
} from '@/components/home/ReviewsAndGallery'
import ContactFormSection from '@/components/home/ContactFormSection'

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Quick Contact Bar */}
      <QuickContact />

      {/* Services Section */}
      <ServicesSection />

      {/* Differentiators Section */}
      <DifferentiatorsSection />

      {/* Reviews Section */}
      <ReviewsSection />

      {/* Gallery Section */}
      <GallerySection />

      {/* Contact Form Section */}
      <ContactFormSection />
    </>
  )
}
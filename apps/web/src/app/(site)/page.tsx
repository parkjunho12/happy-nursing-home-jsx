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

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Quick Contact Bar */}
      <QuickContact />

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
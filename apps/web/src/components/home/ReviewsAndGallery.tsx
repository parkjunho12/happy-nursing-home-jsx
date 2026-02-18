import React from 'react'
import Link from 'next/link'
import { REVIEWS, SITE_INFO } from '@/lib/constants'
import { getRatingStars } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Star, ChevronRight } from 'lucide-react'
import Image from 'next/image'

// ReviewsSection Component
export function ReviewsSection() {
  return (
    <section id="reviews" className="py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            REVIEWS
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            가족들이 전하는 진심
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto">
            실제 입소자 가족분들이 전하는 솔직한 이야기를 들어보세요
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-12">
          {REVIEWS.map((review) => (
            <div
              key={review.id}
              className="bg-white border-2 border-border-light rounded-3xl p-8 hover:border-primary-orange hover:shadow-large transition-all duration-300"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-bold text-primary-brown">
                    {review.author}
                  </h4>
                  <p className="text-sm text-text-gray">{review.date}</p>
                </div>
                <div className="flex gap-0.5 text-primary-orange text-lg">
                  {getRatingStars(review.rating)}
                </div>
              </div>

              {/* Content */}
              <p className="text-text-gray leading-relaxed italic">
                "{review.content}"
              </p>

              {/* Verified Badge */}
              {review.verified && (
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-green/10 text-primary-green rounded-full text-xs font-semibold">
                  <span>✓</span>
                  인증된 후기
                </div>
              )}
            </div>
          ))}
        </div>

        {/* More Reviews Button */}
        <div className="text-center">
          <Link href="/reviews">
            <Button variant="outline" size="lg" rightIcon={<ChevronRight />}>
              더 많은 후기 보기
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
export function GallerySection() {
  const galleryItems = [
    {
      id: 1,
      src: '/assets/images/interior.JPG',
      title: '요양원 내관',
      span: 'col-span-2 row-span-2',
    },
    {
      id: 2,
      src: '/assets/images/2room.JPG',
      title: '2인실',
      span: '',
    },
    {
      id: 3,
      src: '/assets/images/4room.JPG',
      title: '4인실',
      span: '',
    },
    {
      id: 4,
      src: '/assets/images/dining.JPG',
      title: '식당',
      span: '',
    },
    {
      id: 5,
      src: '/assets/images/program.png',
      title: '프로그램실',
      span: '',
    },
    {
      id: 6,
      src: '/assets/images/health.png',
      title: '물리치료실',
      span: '',
    },
    {
      id: 7,
      src: '/assets/images/bathroom.JPG',
      title: '화장실',
      span: '',
    },
    {
      id: 8,
      src: '/assets/images/meeting.JPG',
      title: '상담실',
      span: '',
    },
    {
      id: 9,
      src: '/assets/images/meeting2.JPG',
      title: '상담실2',
      span: '',
    },
  ]

  return (
    <section className="bg-bg-cream py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            FACILITY
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown">
            깨끗하고 쾌적한 우리 시설
          </h2>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-3xl overflow-hidden">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              className={`relative aspect-square overflow-hidden group ${item.span}`}
            >
              {/* Image */}
              <Image
                src={item.src}
                alt={`행복한요양원 ${item.title}`}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 25vw"
              />

              {/* Dark Overlay */}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-300" />


              {/* Title Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-white font-semibold text-lg md:text-xl">
                  {item.title}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-text-gray text-sm mt-8">
          ※ 실제 시설 사진입니다
        </p>
      </div>
    </section>
  )
}
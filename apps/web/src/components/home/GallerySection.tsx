'use client'

import { useState } from 'react'
import Image from 'next/image'
import GalleryLightbox from '@/components/home/GalleryLightbox'

export function GallerySection() {
  const galleryItems = [
    {
      id: 1,
      src: '/assets/images/cafe.jpeg',
      title: '요양원 내관',
      span: 'col-span-2 row-span-2',
    },
    {
        id: 2,
        src: '/assets/images/haircut.jpeg',
        title: '미용실',
        span: '',
      },
    {
      id: 3,
      src: '/assets/images/healing.jpeg',
      title: '힐링룸/발마사지실',
      span: '',
    },
    {
      id: 4,
      src: '/assets/images/2room.JPG',
      title: '2인실',
      span: '',
    },
    {
      id: 5,
      src: '/assets/images/gate.jpeg',
      title: '현관',
      span: '',
    },
    {
      id: 6,
      src: '/assets/images/dining.JPG',
      title: '식당',
      span: '',
    },
    {
        id: 7,
        src: '/assets/images/program.jpeg',
        title: '프로그램실1',
        span: '',
      },
    {
      id: 8,
      src: '/assets/images/program.png',
      title: '프로그램실2',
      span: '',
    },
    {
      id: 9,
      src: '/assets/images/health.png',
      title: '물리치료실',
      span: '',
    },
    {
      id: 10,
      src: '/assets/images/bathroom.JPG',
      title: '화장실',
      span: '',
    },
    {
      id: 11,
      src: '/assets/images/meeting.JPG',
      title: '상담실',
      span: '',
    },
    {
      id: 12,
      src: '/assets/images/councel.jpeg',
      title: '상담실2',
      span: '',
    },
    {
        id: 13,
        src: '/assets/images/cafeteria.jpeg',
        title: '카페테리아',
        span: '',
      },
      {
        id: 14,
        src: '/assets/images/handmassage.jpeg',
        title: '손마사지기',
        span: '',
      },
      {
        id: 15,
        src: '/assets/images/4rooms.png',
        title: '4인실',
        span: '',
      },
  ]

  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleClose = () => setOpenIndex(null)

  const handlePrev = () => {
    if (openIndex === null) return
    setOpenIndex((openIndex - 1 + galleryItems.length) % galleryItems.length)
  }

  const handleNext = () => {
    if (openIndex === null) return
    setOpenIndex((openIndex + 1) % galleryItems.length)
  }

  return (
    <section className="bg-bg-cream py-20 md:py-28">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            FACILITY
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown">
            깨끗하고 쾌적한 우리 시설
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-3xl overflow-hidden">
          {galleryItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              className={`relative aspect-square overflow-hidden group ${item.span}`}
              aria-label={`${item.title} 크게 보기`}
            >
              <Image
                src={item.src}
                alt={`행복한요양원 ${item.title}`}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 25vw"
              />

              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-300" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-white font-semibold text-lg md:text-xl">
                  {item.title}
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-text-gray text-sm mt-8">
          ※ 실제 시설 사진입니다
        </p>
      </div>

      <GalleryLightbox
        items={galleryItems}
        openIndex={openIndex}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </section>
  )
}
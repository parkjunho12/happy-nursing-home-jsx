import Link from 'next/link'
import Image from 'next/image'
import { Phone, Images, LogIn, CalendarDays, Download } from 'lucide-react'
import { SITE_INFO } from '@/lib/constants'

const steps = [
  {
    icon: LogIn,
    title: '전화번호로 로그인',
    desc: '보호자님 전화번호와 비밀번호로 간편하게 앨범에 접속합니다.',
  },
  {
    icon: CalendarDays,
    title: '주차별 앨범 자동 정리',
    desc: '어르신의 한 주 일상이 주차별 앨범으로 깔끔하게 정리됩니다.',
  },
  {
    icon: Download,
    title: '사진 확인하고 저장',
    desc: '사진과 따뜻한 이야기를 확인하고, 원하시면 전체 저장도 가능합니다.',
  },
]

// 보호자 앨범 예시 사진 (실제 시설 사진 — public/assets/images/album)
const COVER = {
  src: '/assets/images/album/album-block-program.jpg',
  alt: '어르신들이 고리 던지기 여가 활동을 즐기는 모습',
}

const photos = [
  {
    src: '/assets/images/album/album-meal-care.jpg',
    alt: '요양보호사가 어르신들께 식사를 차려드리는 모습',
  },
  {
    src: '/assets/images/album/album-cognition-1to1.jpg',
    alt: '요양보호사가 어르신과 손을 맞잡고 인지 활동을 함께하는 모습',
  },
  {
    src: '/assets/images/album/album-ring-toss.jpg',
    alt: '어르신들이 한글 블록 교구로 인지 프로그램에 참여하는 모습',
  },
  {
    src: '/assets/images/album/album-band-exercise.jpg',
    alt: '어르신들이 색색의 밴드를 들어올리며 체조 프로그램에 참여하는 모습',
  },
  {
    src: '/assets/images/album/album-harness-rail.jpg',
    alt: '하네스 레일을 활용해 어르신이 안전하게 보행 재활을 하는 모습',
  },
]

export default function AlbumPreviewSection() {
  const totalCount = photos.length + 1 // 표지 포함

  return (
    <section className="py-16 md:py-24 bg-[#faf7f3]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <div className="text-sm font-bold text-primary-orange tracking-wider mb-3 uppercase">
            PROTECTOR ALBUM
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-primary-brown mb-4">
            보호자 앨범, 📸 부모님의 오늘을 사진으로 전해드립니다.
          </h2>
          <p className="text-lg text-text-gray max-w-2xl mx-auto leading-relaxed">
            멀리 계셔도 안심하실 수 있도록, 어르신의 한 주 일상을 사진과 따뜻한
            이야기로 담아 보호자님께 전해드립니다.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* 이용 안내 */}
          <div className="order-2 lg:order-1">
            <div className="space-y-4">
              {steps.map((s, i) => {
                const Icon = s.icon
                return (
                  <div
                    key={s.title}
                    className="flex items-start gap-4 rounded-2xl bg-white p-5 border border-gray-100 shadow-sm"
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-orange-50 text-primary-orange flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary-orange text-white text-[11px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/family"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-primary-orange text-white rounded-xl font-semibold hover:bg-primary-orange/90 transition-colors shadow-lg shadow-orange-200"
              >
                <Images className="w-5 h-5" />
                보호자 앨범 보기
              </Link>
              <a
                href={`tel:${SITE_INFO.phone}`}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white border-2 border-gray-200 text-gray-800 rounded-xl font-semibold hover:border-primary-orange hover:text-primary-orange transition-colors"
              >
                <Phone className="w-5 h-5" />
                앨범 이용 문의
              </a>
            </div>
            <p className="text-sm text-gray-400 mt-3">
              ※ 보호자 계정은 입소 상담 시 안내해 드립니다.
            </p>
          </div>

          {/* 실제 앨범 화면 미리보기 (폰 목업) */}
          <div className="order-1 lg:order-2 flex justify-center">
            <div className="relative w-[300px] max-w-full">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-gray-500 shadow-sm border border-gray-100">
                📱 실제 앨범 화면 예시
              </span>

              <div className="rounded-[2.4rem] border-[10px] border-gray-900 bg-white shadow-2xl overflow-hidden">
                {/* 앱 상단 바 */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-lg">
                    🌸
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-bold text-gray-900">우리 가족 앨범</p>
                    <p className="text-[11px] text-gray-400">홍길동님</p>
                  </div>
                </div>

                {/* 인사 배너 */}
                <div className="m-3 rounded-2xl bg-gradient-to-r from-primary-orange to-amber-400 px-4 py-3.5 text-white">
                  <p className="text-sm font-bold">홍길동 보호자님</p>
                  <p className="text-[11px] text-white/90 mt-0.5">
                    소중한 가족의 일상을 담았습니다 💛
                  </p>
                </div>

                {/* 앨범 카드 */}
                <div className="px-3 pb-4">
                  <p className="text-[11px] font-semibold text-gray-500 mb-2">
                    앨범 1개
                  </p>
                  <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={COVER.src}
                        alt={COVER.alt}
                        fill
                        loading="lazy"
                        sizes="300px"
                        className="object-cover"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                        📸 {totalCount}장
                      </span>
                    </div>
                    <div className="p-3.5">
                      <p className="font-bold text-gray-900 text-sm mb-1">
                        2026년 6월 2째주
                      </p>
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                        🌿 2026년 6월 둘째 주 이야기 🌿 초여름의 따뜻한 햇살 속에서
                        어르신들과 함께 웃고, 이야기 나누며 소중한 시간을 보냈습니다.
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2">2026년 6월 23일</p>

                      {/* 썸네일 그리드 (앨범 속 사진들) */}
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {photos.map((t) => (
                          <div
                            key={t.src}
                            className="relative aspect-square rounded-lg overflow-hidden"
                          >
                            <Image
                              src={t.src}
                              alt={t.alt}
                              fill
                              loading="lazy"
                              sizes="90px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-gray-500">
                            +{totalCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

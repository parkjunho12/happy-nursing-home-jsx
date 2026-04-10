'use client'

import Image from 'next/image'
import {
  Sparkles,
  Building2,
  Users,
  Award,
  Shield,
  Activity,
  Heart,
  ArrowRight,
  CheckCircle2,
  Phone,
  MapPin,
  Cpu,
  TrendingUp,
  ShieldCheck,
  BedDouble,
  Camera,
  Waves,
} from 'lucide-react'

type FeatureCard = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color: string
}

const summaryCards: FeatureCard[] = [
  {
    icon: Building2,
    title: '신설 시설의 쾌적함',
    description: '같은 본인부담금 안에서도 더 깨끗하고 현대적인 생활환경을 제공합니다.',
    color: 'blue',
  },
  {
    icon: Users,
    title: '촘촘한 집중 케어',
    description: '초기 운영 단계의 장점을 살려 보다 세심하고 밀도 있는 돌봄을 지향합니다.',
    color: 'indigo',
  },
  {
    icon: Award,
    title: '검증된 운영 노하우',
    description: '13년 경력의 운영진과 A등급 운영 경험을 바탕으로 체계적으로 관리합니다.',
    color: 'purple',
  },
  {
    icon: Shield,
    title: 'AI 기반 안전 관리',
    description: '기술을 활용해 위험 상황 감지와 야간 안전 관리를 더욱 촘촘하게 보조합니다.',
    color: 'teal',
  },
  {
    icon: Activity,
    title: '안전한 보행 재활',
    description: '레일과 하네스를 활용한 재활 시스템으로 보행 훈련의 안정성을 높입니다.',
    color: 'emerald',
  },
]

function SectionBadge({
  icon: Icon,
  label,
  tone = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tone?: 'blue' | 'indigo' | 'purple' | 'teal' | 'emerald'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    purple: 'bg-purple-50 text-purple-700 ring-purple-100',
    teal: 'bg-teal-50 text-teal-700 ring-teal-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${styles[tone]}`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  )
}

function SummaryCard({ icon: Icon, title, description, color }: FeatureCard) {
  const toneMap = {
    blue: {
      wrap: 'bg-blue-100 text-blue-700',
      border: 'hover:border-blue-200',
    },
    indigo: {
      wrap: 'bg-indigo-100 text-indigo-700',
      border: 'hover:border-indigo-200',
    },
    purple: {
      wrap: 'bg-purple-100 text-purple-700',
      border: 'hover:border-purple-200',
    },
    teal: {
      wrap: 'bg-teal-100 text-teal-700',
      border: 'hover:border-teal-200',
    },
    emerald: {
      wrap: 'bg-emerald-100 text-emerald-700',
      border: 'hover:border-emerald-200',
    },
  } as const

  const tone = toneMap[color as keyof typeof toneMap]

  return (
    <div
      className={`group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${tone.border}`}
    >
      <div className={`mb-5 inline-flex rounded-2xl p-4 ${tone.wrap}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mb-3 text-xl font-bold tracking-tight text-slate-900">{title}</h3>
      <p className="text-sm leading-7 text-slate-600">{description}</p>
    </div>
  )
}

function ImageFrame({
  src,
  alt,
  label,
  caption,
  priority = false,
}: {
  src: string
  alt: string
  label: string
  caption: string
  priority?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
        <div className="rounded-full bg-slate-100 p-2">
          <Camera className="h-4 w-4 text-slate-500" />
        </div>
      </div>

      <div className="relative aspect-[4/3] w-full bg-slate-100">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>
    </div>
  )
}

function MetricBox({
  title,
  desc,
  value,
  tone = 'purple',
}: {
  title: string
  desc: string
  value: string
  tone?: 'purple' | 'indigo'
}) {
  const styles = {
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  }

  return (
    <div className={`rounded-2xl border p-6 ${styles[tone]}`}>
      <div className="text-4xl font-bold tracking-tight">{value}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-xs leading-6 text-slate-600">{desc}</div>
    </div>
  )
}

function Bullet({
  title,
  description,
  tone = 'blue',
}: {
  title: string
  description: string
  tone?: 'blue' | 'indigo' | 'purple' | 'teal' | 'emerald'
}) {
  const iconBg = {
    blue: 'bg-blue-100 text-blue-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    purple: 'bg-purple-100 text-purple-700',
    teal: 'bg-teal-100 text-teal-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <li className="flex items-start gap-4">
      <div className={`mt-0.5 rounded-full p-1.5 ${iconBg[tone]}`}>
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-7 text-slate-600">{description}</p>
      </div>
    </li>
  )
}

export default function WhyChooseUsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_35%),radial-gradient(circle_at_right,_rgba(99,102,241,0.08),_transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-5 py-2.5 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">프리미엄 케어 포인트</span>
            </div>

            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              왜 많은 보호자분들이
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
                행복한요양원 녹양역점
              </span>
              을 선택하실까요?
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-8 text-slate-600 sm:text-xl">
              같은 본인부담금 안에서도 더 쾌적한 환경, 더 세심한 돌봄, 더 검증된 운영,
              그리고 더 안전한 재활과 기술 기반 케어를 제공한다는 점이 선택의 차이를
              만듭니다.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="tel:0318568090"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto"
              >
                <Phone className="h-5 w-5" />
                입소 상담 문의
              </a>

              <a
                href="#features"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
              >
                시설 강점 보기
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                같은 본인부담금 안에서 더 나은 환경
              </div>
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                13년 운영 경력
              </div>
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                AI 안전 케어
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            5가지 차별화된 강점
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            보호자분들이 실제로 중요하게 보는 기준을 중심으로 행복한요양원 녹양역점의
            장점을 정리했습니다.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      {/* Section 1 */}
      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionBadge icon={BedDouble} label="신설 시설의 쾌적함" tone="blue" />

            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              같은 비용이라면,
              <br />
              생활환경의 차이는 분명합니다.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              같은 본인부담금이라도 실제 생활하시는 공간의 쾌적함은 큰 차이를 만듭니다.
              신설 요양원은 시설의 노후감이 적고, 전반적인 공간 경험에서 보다 깔끔하고
              안정적인 인상을 드릴 수 있습니다.
            </p>

            <ul className="mt-8 space-y-5">
              <Bullet
                tone="blue"
                title="신설 시설의 깔끔한 생활 공간"
                description="처음 입소하셨을 때 느껴지는 첫 인상과 생활 만족도에 영향을 주는 중요한 요소입니다."
              />
              <Bullet
                tone="blue"
                title="밝고 정돈된 실내 환경"
                description="보호자 방문 시에도 쾌적함과 청결감이 잘 전달될 수 있도록 관리합니다."
              />
              <Bullet
                tone="blue"
                title="같은 비용 안에서 체감되는 만족도"
                description="비용이 비슷하다면 더 편안하고 깨끗한 환경을 선택하시는 것이 자연스럽습니다."
              />
            </ul>
          </div>

          <div className="space-y-5">
            <ImageFrame
              src="/images/why-01-facility.jpg"
              alt="행복한요양원 녹양역점의 쾌적한 신설 시설 이미지"
              label="시설 비교 사진"
              caption="신설 시설의 밝고 정돈된 생활환경을 보여주는 대표 이미지"
              priority
            />
            <div className="rounded-[28px] border border-blue-100 bg-blue-50/70 p-6">
              <p className="text-sm font-semibold text-blue-900">
                보호자 관점 포인트
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                어르신이 실제로 생활하는 공간은 단순한 인테리어가 아니라 일상의 안정감과
                만족도에 직접 연결됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 */}
      <section className="bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="order-2 lg:order-1">
            <ImageFrame
              src="/images/why-02-care.jpg"
              alt="요양보호사가 어르신을 세심하게 돌보는 집중 케어 이미지"
              label="집중 케어 이미지"
              caption="보다 촘촘한 케어 환경을 전달하는 대표 이미지"
            />
          </div>

          <div className="order-1 lg:order-2">
            <SectionBadge icon={Users} label="촘촘한 집중 케어" tone="indigo" />

            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              돌봄의 질은 결국
              <br />
              사람의 밀도와 관심에서
              <br />
              차이가 납니다.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              신설 요양원의 초기 운영 단계는 어르신 한 분 한 분께 더 집중하기 좋은
              환경을 만들 수 있다는 장점이 있습니다. 보호자분들이 체감하시는 것은 결국
              얼마나 세심하게 살피고 빠르게 반응하느냐입니다.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">더 자주 살핌</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  일상 변화와 컨디션을 더 세밀하게 확인
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">더 빠른 대응</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  작은 이상 신호에도 즉시 반응할 수 있는 환경
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">더 세심한 관심</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  어르신의 개별 상태를 더 가까이서 파악
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionBadge icon={Award} label="13년 경력과 A등급 운영진" tone="purple" />

            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              시설은 새롭지만,
              <br />
              운영의 기준은
              <br />
              이미 검증되었습니다.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              신설 요양원이라고 해서 운영까지 처음인 것은 아닙니다. 행복한요양원
              녹양역점은 13년 경력의 운영진과 기존 A등급 시설 운영 경험을 바탕으로
              현장의 안정성과 체계성을 함께 갖추고자 합니다.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <MetricBox
                title="운영 경력"
                desc="장기요양 현장에서 쌓아온 실무 경험과 운영 노하우"
                value="13년"
                tone="purple"
              />
              <MetricBox
                title="A등급 운영 경험"
                desc="기존 운영 경험을 바탕으로 한 체계적인 관리 기준"
                value="A등급"
                tone="indigo"
              />
            </div>

            <div className="mt-8 rounded-[28px] border border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 p-6">
              <p className="text-sm font-semibold text-slate-900">보호자 안심 포인트</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                “새 건물이라 좋다”에서 끝나는 것이 아니라, 실제 운영 기준과 시스템이
                갖춰져 있는가를 함께 보셔야 합니다.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <ImageFrame
              src="/images/why-03-operation.jpg"
              alt="13년 경력과 검증된 운영 노하우를 상징하는 이미지"
              label="운영진 신뢰 이미지"
              caption="경력과 체계성을 상징하는 대표 이미지"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <Award className="mx-auto h-5 w-5 text-purple-600" />
                <p className="mt-2 text-xs font-semibold text-slate-900">운영 경험</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <ShieldCheck className="mx-auto h-5 w-5 text-indigo-600" />
                <p className="mt-2 text-xs font-semibold text-slate-900">평가 기준 이해</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <Heart className="mx-auto h-5 w-5 text-rose-500" />
                <p className="mt-2 text-xs font-semibold text-slate-900">안정적 운영</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 */}
      <section className="bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="order-2 lg:order-1">
            <ImageFrame
              src="/images/why-04-ai-safety.jpg"
              alt="AI 기술을 활용한 어르신 안전 케어 시스템 이미지"
              label="AI 안전 케어 사진"
              caption="위험 상황 감지와 야간 모니터링 보조를 상징하는 이미지"
            />
          </div>

          <div className="order-1 lg:order-2">
            <SectionBadge icon={Cpu} label="AI 및 최신 기술 기반 위험 케어" tone="teal" />

            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              기술은 더 빠르게 보고,
              <br />
              사람은 더 따뜻하게 돌봅니다.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              AI와 최신 기술은 사람의 돌봄을 대체하기 위한 것이 아니라, 더 빠르게
              위험을 인지하고 더 체계적으로 안전을 관리하도록 돕는 보조 수단입니다.
              결국 중요한 것은 사람의 따뜻한 케어이고, 기술은 그 돌봄을 더 정교하게
              받쳐주는 역할을 합니다.
            </p>

            <ul className="mt-8 space-y-5">
              <Bullet
                tone="teal"
                title="위험 상황 감지 보조"
                description="낙상이나 이상 움직임 등 위험 징후를 더 빠르게 포착할 수 있도록 돕습니다."
              />
              <Bullet
                tone="teal"
                title="야간 안전 관리 강화"
                description="야간에도 어르신 상태를 보다 체계적으로 살피는 데 도움이 됩니다."
              />
              <Bullet
                tone="teal"
                title="사람 중심 돌봄을 보완하는 기술"
                description="기술은 보조하고, 실제 케어는 언제나 현장 인력이 책임감 있게 수행합니다."
              />
            </ul>

            <div className="mt-8 rounded-[28px] border border-teal-100 bg-teal-50 p-6">
              <div className="flex items-start gap-3">
                <Waves className="mt-0.5 h-5 w-5 text-teal-700" />
                <p className="text-sm leading-7 text-slate-700">
                  기술 활용 표현은 과장되지 않게, 실제 서비스 소개 페이지에서는
                  “안전관리 보조 시스템”, “위험상황 감지 보조”, “야간 모니터링 보조” 같은
                  표현으로 운영하는 것이 신뢰감에 더 유리합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 */}
      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionBadge icon={Activity} label="레일 + 하네스 기반 보행 재활" tone="emerald" />

            <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              안전을 고려한 재활은
              <br />
              어르신의 자신감을
              <br />
              다시 세우는 과정입니다.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              레일과 하네스를 활용한 보행 재활기구는 보행 훈련 시 낙상에 대한 부담을
              줄이고, 보다 안정적인 환경에서 재활을 진행할 수 있도록 돕습니다. 보호자
              입장에서도 “안전하게 훈련한다”는 점이 큰 안심 요소가 됩니다.
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="font-semibold text-slate-900">안전한 보행 훈련 환경</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  하네스와 레일을 활용해 훈련 중 넘어짐에 대한 부담을 줄입니다.
                </p>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="font-semibold text-slate-900">상태에 맞춘 단계적 재활</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  어르신의 컨디션과 보행 상태에 따라 무리 없이 훈련 강도를 조절할 수
                  있습니다.
                </p>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="font-semibold text-slate-900">자신감 회복에 도움</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  안전하다는 느낌은 재활 지속성과 심리적 안정에도 긍정적으로 작용합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <ImageFrame
              src="/images/why-05-rehab.jpg"
              alt="레일과 하네스를 활용한 어르신 보행 재활기구 이미지"
              label="보행 재활기구 사진"
              caption="안전한 보행 훈련 시스템을 보여주는 대표 이미지"
            />
            <div className="rounded-[28px] border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-700" />
                <p className="text-sm font-semibold text-slate-900">핵심 메시지</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                보행 재활은 단순한 운동이 아니라, 어르신의 이동 자신감과 일상 회복을
                돕는 과정입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.25),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_25%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            좋은 요양원 선택은
            <br />
            어르신의 생활의 질을 바꾸는 결정입니다.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            행복한요양원 녹양역점은 쾌적한 환경, 촘촘한 케어, 검증된 운영, 안전한 기술
            보조 시스템과 재활 환경을 바탕으로 보호자분께 더 안심되는 선택지를 드리고자
            합니다.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="tel:0318568090"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-semibold text-slate-950 shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-100 sm:w-auto"
            >
              <Phone className="h-5 w-5" />
              상담 문의하기
            </a>

            <a
              href="/contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15 sm:w-auto"
            >
              <MapPin className="h-5 w-5" />
              시설 둘러보기
            </a>
          </div>

          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-6 py-3 text-white backdrop-blur">
            <Phone className="h-5 w-5 text-blue-300" />
            <span className="text-lg font-bold tracking-tight">031-856-8090</span>
          </div>

          <p className="mt-5 text-sm text-slate-400">녹양역 인근 · 프리미엄 케어 환경</p>
        </div>
      </section>
    </main>
  )
}
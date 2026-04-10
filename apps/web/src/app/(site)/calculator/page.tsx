'use client'

import { useMemo, useState } from 'react'
import {
  Calculator,
  CheckCircle,
  ExternalLink,
  FileSearch,
  Heart,
  Phone,
  Shield,
  Users,
} from 'lucide-react'

type Grade = 1 | 2 | 3 | 4 | 5
type PaymentType = '일반' | '감경I' | '감경II' | '기초생활수급자'
type RoomType = 'none' | 'single' | 'double'

type PricingData = Record<PaymentType, Record<Grade, number>>

interface CalculatedCost {
  baseCost: number
  mealCost: number
  snackCost: number
  roomCost: number
  total: number
  isBasicLivelihood: boolean
}

const DAYS_IN_MONTH = 30
const MAX_OVERNIGHT_DAYS = 15

const GRADE_INFO_URL = 'https://www.nhis.or.kr/static/html/wbda/c/wbdac02.html'
const GRADE_APPLY_URL = 'https://www.longtermcare.or.kr/npbs/u/b/101/openLtcRcgtAplyPttnChoice.web?aplyTypeScr=appltit'

const PRICING_DATA: PricingData = {
  일반: {
    1: 558420,
    2: 518040,
    3: 489240,
    4: 489240,
    5: 489240,
  },
  감경I: {
    1: 335052,
    2: 310824,
    3: 293544,
    4: 293544,
    5: 293544,
  },
  감경II: {
    1: 223368,
    2: 207216,
    3: 195696,
    4: 195696,
    5: 195696,
  },
  기초생활수급자: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  },
}

const MEAL_COST_PER_DAY = 12000
const SNACK_COST_PER_DAY = 1500

const ROOM_COST_PER_DAY: Record<RoomType, number> = {
  none: 0,
  single: 50000,
  double: 25000,
}

const PAYMENT_OPTIONS: {
  key: PaymentType
  label: string
  desc: string
}[] = [
  { key: '일반', label: '일반 (20%)', desc: '일반 어르신' },
  { key: '감경I', label: '감경 I (12%)', desc: '의료급여 수급권자' },
  { key: '감경II', label: '감경 II (8%)', desc: '의료급여 수급권자' },
  {
    key: '기초생활수급자',
    label: '기초생활수급자 (0%)',
    desc: '본인부담금·식비·간식비 무료',
  },
]

const ROOM_OPTIONS: {
  key: RoomType
  label: string
  costPerDay: number
}[] = [
  { key: 'none', label: '선택 안함', costPerDay: 0 },
  { key: 'single', label: '1인실', costPerDay: 50000 },
  { key: 'double', label: '2인실', costPerDay: 25000 },
]

function formatKRW(amount: number): string {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`
}

export default function CostCalculatorPage() {
  const [grade, setGrade] = useState<Grade | null>(null)
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null)
  const [roomType, setRoomType] = useState<RoomType>('none')
  const [overnightDays, setOvernightDays] = useState<number>(0)

  const calculatedCost = useMemo<CalculatedCost | null>(() => {
    if (!grade || !paymentType) return null

    const safeOvernightDays = Math.min(
      Math.max(overnightDays, 0),
      MAX_OVERNIGHT_DAYS
    )

    const baseMonthly = PRICING_DATA[paymentType][grade] ?? 0
    const dailyBase = baseMonthly / DAYS_IN_MONTH
    const regularDays = DAYS_IN_MONTH - safeOvernightDays
    const isBasicLivelihood = paymentType === '기초생활수급자'

    const adjustedBaseCost =
      dailyBase * regularDays + dailyBase * 0.5 * safeOvernightDays

    const mealCost = isBasicLivelihood ? 0 : MEAL_COST_PER_DAY * regularDays
    const snackCost = isBasicLivelihood ? 0 : SNACK_COST_PER_DAY * regularDays

    // 방 비용은 선택 시 별도 적용
    const roomCost = ROOM_COST_PER_DAY[roomType] * DAYS_IN_MONTH

    const total = adjustedBaseCost + mealCost + snackCost + roomCost

    return {
      baseCost: Math.round(adjustedBaseCost),
      mealCost: Math.round(mealCost),
      snackCost: Math.round(snackCost),
      roomCost: Math.round(roomCost),
      total: Math.round(total),
      isBasicLivelihood,
    }
  }, [grade, paymentType, roomType, overnightDays])

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-stone-50">
      <section className="bg-gradient-to-br from-amber-100 via-orange-50 to-stone-100 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-6 py-2 shadow-sm backdrop-blur-sm">
            <Calculator className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-semibold text-gray-700">
              요양원 비용 투명 공개
            </span>
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-tight text-gray-900 sm:text-5xl lg:text-6xl">
            입소비용 안내
          </h1>

          <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-gray-700">
            <p className="text-xl font-medium text-gray-800">
              요양원 비용은 대부분 국가에서 지원됩니다.
              <br />
              보호자분께서는 본인부담금과 일부 선택 비용만 부담하시면 됩니다.
            </p>

          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900">
              예상 비용 계산하기
            </h2>
            <p className="text-gray-600">
              아래 항목을 선택하시면 즉시 예상 비용이 계산됩니다
            </p>
          </div>

          <div className="mb-8 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mb-1 text-lg font-bold text-gray-900">
                  장기요양등급 또는 시설급여 대상 여부가 아직 없으신가요?
                </p>
                <p className="text-sm leading-relaxed text-gray-600">
                  먼저 등급 신청 및 시설급여 대상 여부를 확인하신 뒤 계산기를
                  이용하시면 더 정확합니다.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={GRADE_INFO_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100"
                >
                  <FileSearch className="h-4 w-4" />
                  장기요양등급 안내 보기
                </a>

                <a
                  href={GRADE_APPLY_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  등급 신청·확인하러 가기
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  1
                </span>
                장기요양 등급 선택
              </h3>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {([1, 2, 3, 4, 5] as Grade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`rounded-xl border-2 px-6 py-4 text-center font-semibold transition-all ${
                      grade === g
                        ? 'border-orange-600 bg-orange-50 text-orange-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="text-2xl font-bold">{g}등급</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  2
                </span>
                본인부담 유형 선택
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setPaymentType(type.key)}
                    className={`rounded-xl border-2 p-6 text-left transition-all ${
                      paymentType === type.key
                        ? 'border-orange-600 bg-orange-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="mb-1 text-lg font-bold text-gray-900">
                      {type.label}
                    </div>
                    <div className="text-sm text-gray-600">{type.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  3
                </span>
                방 선택
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">
                {ROOM_OPTIONS.map((room) => (
                  <button
                    key={room.key}
                    type="button"
                    onClick={() => setRoomType(room.key)}
                    className={`rounded-xl border-2 p-6 text-center transition-all ${
                      roomType === room.key
                        ? 'border-orange-600 bg-orange-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="mb-1 text-lg font-bold text-gray-900">
                      {room.label}
                    </div>
                    <div className="text-sm text-orange-600">
                      {room.costPerDay > 0
                        ? `+${formatKRW(room.costPerDay)} /일`
                        : '추가 비용 없음'}
                    </div>
                    {room.costPerDay > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        30일 기준 월{' '}
                        {formatKRW(room.costPerDay * DAYS_IN_MONTH)}
                      </p>
                    )}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-sm text-gray-500">
                ※ 기초생활수급자의 경우에도 방 선택 비용은 별도로 적용됩니다.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  4
                </span>
                외박 예상 일수
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-lg font-semibold text-gray-700">
                    월 {overnightDays}일
                  </span>
                  <span className="text-right text-sm text-gray-500">
                    1회 최대 10일, 월 최대 15일
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={15}
                  value={overnightDays}
                  onChange={(e) => setOvernightDays(Number(e.target.value))}
                  className="h-3 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-orange-600"
                />

                <div className="flex justify-between text-xs text-gray-500">
                  <span>0일</span>
                  <span>15일</span>
                </div>

                <p className="rounded-lg bg-amber-50 p-4 text-sm text-gray-600">
                  외박 시 본인부담금은 50%만 산정되며, 식재료비와 간식비는
                  청구되지 않습니다. 방 비용은 병실 유지 기준으로 30일
                  산정됩니다.
                </p>
              </div>
            </div>
          </div>

          {calculatedCost && (
            <div className="mt-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-8 shadow-2xl sm:p-12">
              <div className="mb-8 text-center">
                <h3 className="mb-2 text-2xl font-bold text-white">
                  예상 월 비용
                </h3>
                <div className="break-all text-5xl font-black text-white sm:text-6xl lg:text-7xl">
                  {formatKRW(calculatedCost.total)}
                </div>
                <p className="mt-4 text-lg text-orange-50">
                  30일 기준 총 예상 비용
                </p>
              </div>

              <div className="space-y-3 rounded-xl bg-white/20 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/30 pb-3">
                  <span className="font-medium text-white">본인부담금</span>
                  <span className="text-xl font-bold text-white">
                    {calculatedCost.isBasicLivelihood
                      ? '무료'
                      : formatKRW(calculatedCost.baseCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/30 pb-3">
                  <span className="font-medium text-white">식비</span>
                  <span className="text-xl font-bold text-white">
                    {calculatedCost.isBasicLivelihood
                      ? '무료'
                      : formatKRW(calculatedCost.mealCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/30 pb-3">
                  <span className="font-medium text-white">간식비</span>
                  <span className="text-xl font-bold text-white">
                    {calculatedCost.isBasicLivelihood
                      ? '무료'
                      : formatKRW(calculatedCost.snackCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">방 비용</span>
                  <span className="text-xl font-bold text-white">
                    {calculatedCost.roomCost === 0
                      ? '없음'
                      : formatKRW(calculatedCost.roomCost)}
                  </span>
                </div>
              </div>

              <div className="mt-8 space-y-3 text-center">
                <p className="text-lg leading-relaxed text-white">
                  국가 지원 적용 시 생각보다 부담이 크지 않은 경우가 많습니다.
                </p>
                <p className="text-base text-orange-50">
                  보호자분 상황에 맞춰 실제 부담 비용을 보다 정확하게
                  안내해드립니다.
                </p>
                {calculatedCost.isBasicLivelihood && (
                  <p className="text-sm font-medium text-white">
                    기초생활수급자는 본인부담금·식비·간식비가 무료이며,
                    현재 표시되는 금액은 선택한 방 비용만 반영된 값입니다.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-xl bg-amber-50 p-6 text-sm text-gray-600">
            <p className="mb-2">
              본 계산은{' '}
              <strong className="text-gray-900">행복한요양원 녹양역점</strong>{' '}
              기준으로 산정되었습니다.
            </p>
            <p>
              실제 비용은 어르신 상태 및 선택사항에 따라 방문 상담 후 일부 달라질 수
              있습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            정확한 비용과 입소 가능 여부를 확인하세요
          </h2>
          <p className="mb-8 text-lg text-gray-300">
            계산 결과를 바탕으로 더 정확한 비용과 입소 가능 여부를
            안내해드립니다.
            <br />
            실제 방문 상담 시 어르신 상태에 맞춰 보다 구체적으로 설명드립니다.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <a
              href="tel:0318568090"
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-orange-600 px-10 py-5 text-lg font-bold text-white shadow-xl transition-all hover:bg-orange-700 hover:shadow-2xl"
            >
              <Phone className="h-6 w-6" />
              전화로 바로 문의하기
            </a>

            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-3 rounded-xl border-2 border-white bg-transparent px-10 py-5 text-lg font-bold text-white shadow-xl transition-all hover:bg-white hover:text-gray-900"
            >
              <Calculator className="h-6 w-6" />
              우리 어르신 예상 비용 상담받기
            </a>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 backdrop-blur-sm">
            <Phone className="h-5 w-5 text-orange-400" />
            <span className="text-2xl font-bold text-white">
              031-856-8090
            </span>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-8 text-lg leading-relaxed text-gray-700">
              요양원마다 시설 환경, 돌봄 수준, 재활 지원, 간호 체계에 따라
              실제 만족도는 크게 달라질 수 있습니다.
            </p>

            <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-8">
              <p className="mb-4 text-xl font-semibold text-gray-900">
                행복한요양원 녹양역점은 쾌적한 공간, 세심한 돌봄, 안정적인
                운영을 바탕으로 보호자분께 신뢰를 드리고자 합니다.
              </p>
              <p className="text-base text-gray-700">
                비용만이 아니라 어르신의 생활 만족도와 안전까지 함께 고려해야
                합니다.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border-2 border-orange-100 bg-white p-6 text-center shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-orange-100 p-4">
                  <Heart className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <h4 className="mb-2 text-lg font-bold text-gray-900">
                따뜻한 돌봄
              </h4>
              <p className="text-sm text-gray-600">
                전문 요양보호사의 세심한 케어
              </p>
            </div>

            <div className="rounded-xl border-2 border-orange-100 bg-white p-6 text-center shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-orange-100 p-4">
                  <Shield className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <h4 className="mb-2 text-lg font-bold text-gray-900">
                안심할 수 있는 일상
              </h4>
              <p className="text-sm text-gray-600">
                검증된 운영 노하우와 체계
              </p>
            </div>

            <div className="rounded-xl border-2 border-orange-100 bg-white p-6 text-center shadow-sm">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-orange-100 p-4">
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
              </div>
              <h4 className="mb-2 text-lg font-bold text-gray-900">
                프리미엄 요양 환경
              </h4>
              <p className="text-sm text-gray-600">쾌적하고 안전한 공간</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-stone-50 to-amber-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            왜 실제 방문 상담이 필요할까요?
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">
                건강 상태에 따른 맞춤 안내
              </h3>
              <p className="text-gray-600">
                어르신의 건강 상태, 병력, 필요한 의료 지원 수준에 따라 실제
                비용과 서비스가 달라질 수 있습니다.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">
                재활 프로그램 필요 여부
              </h3>
              <p className="text-gray-600">
                물리치료, 작업치료 등 재활 서비스가 필요한 경우 별도 프로그램과
                비용을 안내해드립니다.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">
                생활 지원 정도 확인
              </h3>
              <p className="text-gray-600">
                식사, 이동, 배설 등 일상생활 지원이 필요한 정도에 따라 케어
                플랜이 달라집니다.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">
                방 이용 및 외박 계획
              </h3>
              <p className="text-gray-600">
                1인실 또는 2인실 선택, 정기적인 외박 가능성 등을 상담하여
                정확한 비용을 산정합니다.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl bg-white p-8 text-center shadow-lg">
            <p className="mb-6 text-lg font-medium text-gray-700">
              상담을 통해 보다 정확한 안내가 가능합니다
            </p>
            <a
              href="tel:0318568090"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-orange-700"
            >
              <Phone className="h-5 w-5" />
              지금 바로 상담받기
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            본인부담 및 비급여 기준 안내
          </h2>

          <div className="space-y-8">
            <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-8">
              <h3 className="mb-4 text-xl font-bold text-gray-900">
                본인부담 기준
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-orange-600" />
                  <span>
                    <strong>일반 어르신:</strong> 본인부담금 20%
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-orange-600" />
                  <span>
                    <strong>의료급여 수급권 어르신:</strong> 본인부담금 8% 또는
                    12%
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-orange-600" />
                  <span>
                    <strong>기초생활수급자:</strong> 본인부담금 무료, 식비 무료,
                    간식비 무료
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-8">
              <h3 className="mb-4 text-xl font-bold text-gray-900">
                비급여 및 선택 비용 안내
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-gray-600" />
                  <span>
                    <strong>식비:</strong> 1일 3식 ₩12,000 (월 ₩360,000)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-gray-600" />
                  <span>
                    <strong>간식비:</strong> 1일 2회 ₩1,500 (월 ₩45,000)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-gray-600" />
                  <span>
                    <strong>방 비용:</strong> 1인실 1일 ₩50,000 / 2인실 1일
                    ₩25,000
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-gray-600" />
                  <span>
                    <strong>기초생활수급자 유의사항:</strong> 식비·간식비는
                    무료이나, 방 선택 비용은 별도 적용될 수 있습니다.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-8">
              <h3 className="mb-4 text-xl font-bold text-gray-900">
                외박 기준 안내
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>외박 시 본인부담금 50% 산정</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>식재료비 / 간식비는 외박 시 미청구</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>1회 최대 10일, 월 최대 15일</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-orange-600 to-amber-600 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">
            행복한요양원 녹양역점에서
            <br />
            어르신을 가족처럼 모시겠습니다
          </h2>
          <p className="mb-8 text-lg text-orange-50">
            프리미엄 케어 환경과 따뜻한 돌봄으로 안심할 수 있는 일상을
            만들어드립니다
          </p>

          <a
            href="tel:0318568090"
            className="inline-flex items-center gap-3 rounded-xl bg-white px-10 py-5 text-xl font-bold text-orange-600 shadow-2xl transition-all hover:bg-orange-50"
          >
            <Phone className="h-6 w-6" />
            031-856-8090
          </a>
        </div>
      </section>
    </div>
  )
}
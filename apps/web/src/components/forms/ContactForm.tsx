'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import type { ContactFormData } from '@/types'
import { contactFormSchema } from '@/lib/validation'
import { submitContactForm, trackFormSubmit } from '@/lib/api-client'
import { INQUIRY_TYPES, PRIVACY_POLICY } from '@/lib/constants'

import { Input } from '@/components/ui/Input'
import { Select, Textarea } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { SuccessModal, ErrorModal } from '@/components/ui/Modal'
import { Send } from 'lucide-react'

function formatPhone(value: string) {
  // 숫자만 남기기
  const digits = value.replace(/\D/g, '').slice(0, 11)

  // 02/010 기준은 일단 010만 포맷 (필요하면 확장)
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function parseApiError(err: unknown) {
  // fetch/axios/fastapi 422 모두 어느 정도 커버
  const anyErr = err as any

  // axios
  const res = anyErr?.response
  const data = res?.data

  if (data?.detail) {
    // FastAPI validation: {detail:[{msg,...},...]} 또는 {detail:"..."}
    if (Array.isArray(data.detail)) {
      const first = data.detail[0]
      return first?.msg || '요청 값이 올바르지 않습니다.'
    }
    return typeof data.detail === 'string' ? data.detail : '요청 처리 중 오류가 발생했습니다.'
  }

  if (data?.message && typeof data.message === 'string') return data.message
  if (anyErr?.message && typeof anyErr.message === 'string') return anyErr.message

  return '네트워크 오류가 발생했습니다. 다시 시도해주세요.'
}

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // ✅ AbortController로 연타/페이지 이동 시 안전
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // ✅ hydration mismatch 방지용: id 고정
  const ids = useMemo(
    () => ({
      name: 'contact-name',
      phone: 'contact-phone',
      email: 'contact-email',
      inquiryType: 'contact-inquiryType',
      message: 'contact-message',
      privacyAgreed: 'contact-privacyAgreed',
    }),
    []
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      inquiryType: '',
      message: '',
      privacyAgreed: false,
    },
  })

  // ✅ phone을 watch해서 포맷 적용
  const phoneValue = watch('phone')
  useEffect(() => {
    // 사용자가 입력할 때마다 포맷팅
    const formatted = formatPhone(phoneValue || '')
    if (formatted !== phoneValue) {
      setValue('phone', formatted, { shouldValidate: true, shouldDirty: true })
    }
  }, [phoneValue, setValue])

  const onSubmit = async (data: ContactFormData) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage('')

    // 이전 요청 취소
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      // ✅ 원칙: privacyAgreed는 서버도 받는 게 맞음.
      // FastAPI 스키마가 privacy_agreed를 받도록 맞추는 걸 추천.
      // (현재 서버가 안 받는다면 submitContactForm 내부에서 mapping 처리)
      const payload = {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        inquiry_type: data.inquiryType,      // ✅ snake_case로 맞춤
        message: data.message,
        privacy_agreed: data.privacyAgreed,  // ✅ 서버와 정합
      }

      const response = await submitContactForm(payload as any, {
        signal: abortRef.current.signal,
      } as any)

      if (response?.success) {
        trackFormSubmit('Contact Form', true)
        setShowSuccessModal(true)
        reset()
      } else {
        trackFormSubmit('Contact Form', false)
        setErrorMessage(response?.message || '전송 중 오류가 발생했습니다.')
        setShowErrorModal(true)
      }
    } catch (err) {
      // abort는 조용히 무시
      if ((err as any)?.name === 'AbortError') return

      trackFormSubmit('Contact Form', false)
      setErrorMessage(parseApiError(err))
      setShowErrorModal(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeSuccess = () => {
    setShowSuccessModal(false)
    setFocus('name')
  }

  const closeError = () => {
    setShowErrorModal(false)
    if (errors.name) return setFocus('name')
    if (errors.phone) return setFocus('phone')
    if (errors.email) return setFocus('email')
    if (errors.inquiryType) return setFocus('inquiryType')
    if (errors.message) return setFocus('message')
    if (errors.privacyAgreed) return setFocus('privacyAgreed')
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="grid md:grid-cols-2 gap-6">
          <Input
            id={ids.name}
            label="이름"
            required
            placeholder="홍길동"
            error={errors.name?.message}
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register('name')}
          />

          <Input
            id={ids.phone}
            label="연락처"
            type="tel"
            required
            placeholder="010-1234-5678"
            error={errors.phone?.message}
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
        </div>

        <Input
          id={ids.email}
          label="이메일"
          type="email"
          placeholder="example@email.com"
          helperText="선택사항"
          error={errors.email?.message}
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register('email')}
        />

        <Select
          id={ids.inquiryType}
          label="문의 유형"
          required
          options={[
            { value: '', label: '선택해주세요' },
            ...INQUIRY_TYPES.map((type) => ({
              value: type.value,
              label: type.label,
            })),
          ]}
          error={errors.inquiryType?.message}
          aria-invalid={!!errors.inquiryType}
          {...register('inquiryType')}
        />

        <Textarea
          id={ids.message}
          label="문의 내용"
          required
          placeholder="궁금하신 내용을 자세히 적어주세요"
          rows={5}
          error={errors.message?.message}
          aria-invalid={!!errors.message}
          {...register('message')}
        />

        <div className="bg-bg-cream rounded-2xl p-6">
          <h4 className="text-base font-bold text-primary-brown mb-3">
            [필수] 개인정보 수집 및 이용 동의
          </h4>

          <div className="space-y-2 text-sm text-text-gray mb-4">
            <p>
              <strong>수집 항목:</strong> {PRIVACY_POLICY.collectItems}
            </p>
            <p>
              <strong>수집 목적:</strong> {PRIVACY_POLICY.purpose}
            </p>
            <p>
              <strong>보유 기간:</strong> {PRIVACY_POLICY.retention}
            </p>
            <p className="text-xs mt-3 leading-relaxed">
              {PRIVACY_POLICY.disclaimer}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id={ids.privacyAgreed}
              className="mt-1 w-5 h-5 rounded border-2 border-border-light text-primary-orange focus:ring-2 focus:ring-primary-orange cursor-pointer"
              aria-invalid={!!errors.privacyAgreed}
              {...register('privacyAgreed')}
            />
            <label
              htmlFor={ids.privacyAgreed}
              className="text-sm font-semibold text-primary-brown cursor-pointer"
            >
              개인정보 수집 및 이용에 동의합니다
            </label>
          </div>

          {errors.privacyAgreed && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1" role="alert">
              <span>⚠️</span>
              {errors.privacyAgreed.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSubmitting}
          loading={isSubmitting}
          rightIcon={!isSubmitting && <Send className="w-5 h-5" />}
        >
          {isSubmitting ? '전송 중...' : '상담 신청하기'}
        </Button>
      </form>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={closeSuccess}
        title="상담 신청 완료!"
        message="상담 신청이 성공적으로 접수되었습니다. 빠른 시일 내에 연락드리겠습니다."
      />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={closeError}
        title="전송 실패"
        message={errorMessage}
      />
    </>
  )
}

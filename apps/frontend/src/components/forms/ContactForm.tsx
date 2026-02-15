'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ContactFormData } from '@/types'
import { contactFormSchema } from '@/lib/validation'
import { api, trackFormSubmit } from '@/lib/api'
import { INQUIRY_TYPES, PRIVACY_POLICY } from '@/lib/constants'
import { Input } from '@/components/ui/Input'
import { Select, Textarea } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { SuccessModal, ErrorModal } from '@/components/ui/Modal'
import { Send } from 'lucide-react'

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  })

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)

    try {
      const response = await api.submitContact(data)

      if (response.success) {
        trackFormSubmit('Contact Form', true)
        setShowSuccessModal(true)
        reset()
      } else {
        trackFormSubmit('Contact Form', false)
        setErrorMessage(response.message || '전송 중 오류가 발생했습니다.')
        setShowErrorModal(true)
      }
    } catch (error) {
      trackFormSubmit('Contact Form', false)
      setErrorMessage('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
      setShowErrorModal(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name and Phone Row */}
        <div className="grid md:grid-cols-2 gap-6">
          <Input
            label="이름"
            required
            placeholder="홍길동"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="연락처"
            type="tel"
            required
            placeholder="010-1234-5678"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        {/* Email */}
        <Input
          label="이메일"
          type="email"
          placeholder="example@email.com"
          helperText="선택사항"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Inquiry Type */}
        <Select
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
          {...register('inquiryType')}
        />

        {/* Message */}
        <Textarea
          label="문의 내용"
          required
          placeholder="궁금하신 내용을 자세히 적어주세요"
          rows={5}
          error={errors.message?.message}
          {...register('message')}
        />

        {/* Privacy Agreement */}
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
              id="privacyAgreed"
              className="mt-1 w-5 h-5 rounded border-2 border-border-light text-primary-orange focus:ring-2 focus:ring-primary-orange cursor-pointer"
              {...register('privacyAgreed')}
            />
            <label
              htmlFor="privacyAgreed"
              className="text-sm font-semibold text-primary-brown cursor-pointer"
            >
              개인정보 수집 및 이용에 동의합니다
            </label>
          </div>

          {errors.privacyAgreed && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <span>⚠️</span>
              {errors.privacyAgreed.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          rightIcon={!isSubmitting && <Send className="w-5 h-5" />}
        >
          {isSubmitting ? '전송 중...' : '상담 신청하기'}
        </Button>
      </form>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="상담 신청 완료!"
        message="상담 신청이 성공적으로 접수되었습니다. 빠른 시일 내에 연락드리겠습니다."
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="전송 실패"
        message={errorMessage}
      />
    </>
  )
}
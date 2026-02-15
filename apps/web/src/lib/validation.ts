import { z } from 'zod'
import { ContactFormData, FormErrors } from '@/types/index'

// Zod 스키마 정의
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, '이름은 2자 이상 입력해주세요')
    .max(50, '이름은 50자 이하로 입력해주세요'),
  
  phone: z
    .string()
    .regex(/^01[0-9]-?[0-9]{4}-?[0-9]{4}$/, '올바른 연락처 형식이 아닙니다 (예: 010-1234-5678)'),
  
  email: z
    .string()
    .email('올바른 이메일 형식이 아닙니다')
    .optional()
    .or(z.literal('')),
  
  inquiryType: z
    .enum(['입소상담', '비용문의', '시설견학', '프로그램문의', '기타'], {
      errorMap: () => ({ message: '문의 유형을 선택해주세요' }),
    }),
  
  message: z
    .string()
    .min(10, '문의 내용을 10자 이상 입력해주세요')
    .max(1000, '문의 내용은 1000자 이하로 입력해주세요'),
  
  privacyAgreed: z
    .boolean()
    .refine((val) => val === true, {
      message: '개인정보 수집 및 이용에 동의해주세요',
    }),
})

export type ContactFormSchema = z.infer<typeof contactFormSchema>

/**
 * 폼 데이터 검증
 */
export function validateContactForm(data: ContactFormData): {
  success: boolean
  errors: FormErrors
} {
  try {
    contactFormSchema.parse(data)
    return { success: true, errors: {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: FormErrors = {}
      error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message
        }
      })
      return { success: false, errors }
    }
    return { success: false, errors: { general: '검증 중 오류가 발생했습니다' } }
  }
}

/**
 * 개별 필드 검증
 */
export function validateField(
  fieldName: keyof ContactFormData,
  value: any
): string | null {
  try {
    const schema = contactFormSchema.shape[fieldName]
    if (schema) {
      schema.parse(value)
    }
    return null
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors[0]?.message || null
    }
    return null
  }
}

/**
 * 파일 검증
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

  if (file.size > maxSize) {
    return { valid: false, error: '파일 크기는 5MB를 초과할 수 없습니다' }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'JPG, PNG, WEBP 형식의 이미지만 업로드 가능합니다' }
  }

  return { valid: true }
}

/**
 * 전화번호 자동 포맷팅
 */
export function formatPhoneInput(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  
  if (cleaned.length <= 3) {
    return cleaned
  } else if (cleaned.length <= 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  } else {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`
  }
}

/**
 * 폼 데이터 정제
 */
export function sanitizeFormData(data: ContactFormData) {
  return {
    name: data.name.trim(),
    phone: data.phone.replace(/\D/g, ''),
    email: data.email?.trim().toLowerCase() || undefined,
    inquiryType: (data as any).inquiryType?.trim(), // ✅ 추가
    message: data.message.trim(),
  }
}

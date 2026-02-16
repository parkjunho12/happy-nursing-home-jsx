/**
 * 개인정보 필터 (PII - Personally Identifiable Information)
 * 민감 정보를 감지하고 마스킹 처리
 */

export interface PIICheckResult {
    hasPII: boolean
    maskedText: string
    warnings: string[]
    detectedTypes: string[]
  }
  
  /**
   * 전화번호 패턴 감지 및 마스킹
   */
  function maskPhoneNumber(text: string): { masked: string; detected: boolean } {
    const phonePatterns = [
      /(\d{2,3})-?(\d{3,4})-?(\d{4})/g,  // 010-1234-5678, 02-123-4567
      /(\d{3})(\d{4})(\d{4})/g,          // 01012345678
    ]
    
    let masked = text
    let detected = false
    
    phonePatterns.forEach(pattern => {
      if (pattern.test(text)) {
        detected = true
        masked = masked.replace(pattern, (match) => {
          // 첫 3자리와 마지막 4자리만 마스킹
          const cleaned = match.replace(/[^0-9]/g, '')
          return cleaned.substring(0, 3) + '-****-' + cleaned.substring(cleaned.length - 4)
        })
      }
    })
    
    return { masked, detected }
  }
  
  /**
   * 주민등록번호 패턴 감지 및 마스킹
   */
  function maskSSN(text: string): { masked: string; detected: boolean } {
    const ssnPattern = /(\d{6})-?([1-4]\d{6})/g
    
    let detected = false
    const masked = text.replace(ssnPattern, (match) => {
      detected = true
      return '******-*******'
    })
    
    return { masked, detected }
  }
  
  /**
   * 이메일 패턴 감지 (경고만, 마스킹 안함)
   */
  function detectEmail(text: string): boolean {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    return emailPattern.test(text)
  }
  
  /**
   * 주소 패턴 감지 (경고)
   */
  function detectAddress(text: string): boolean {
    const addressKeywords = ['시', '구', '동', '번지', '아파트', '호', '번길']
    const hasMultipleKeywords = addressKeywords.filter(keyword => text.includes(keyword)).length >= 2
    
    // "XX시 XX구 XX동" 같은 패턴
    const addressPattern = /[가-힣]+[시|구|동]\s*[가-힣]+[구|동|로|길]/
    
    return hasMultipleKeywords || addressPattern.test(text)
  }
  
  /**
   * 의료 진단명 감지 (경고)
   */
  function detectMedicalTerms(text: string): boolean {
    const medicalKeywords = [
      '진단', '병명', '질환', '질병',
      '암', '당뇨', '고혈압', '치매',
      '뇌졸중', '파킨슨', '알츠하이머',
      '약', '처방', '투약', '복용'
    ]
    
    return medicalKeywords.some(keyword => text.includes(keyword))
  }
  
  /**
   * 전체 PII 체크 및 마스킹
   */
  export function checkAndMaskPII(text: string): PIICheckResult {
    const warnings: string[] = []
    const detectedTypes: string[] = []
    let maskedText = text
    let hasPII = false
    
    // 1. 전화번호
    const phoneResult = maskPhoneNumber(maskedText)
    if (phoneResult.detected) {
      maskedText = phoneResult.masked
      hasPII = true
      detectedTypes.push('전화번호')
      warnings.push('전화번호가 감지되어 마스킹 처리되었습니다.')
    }
    
    // 2. 주민등록번호
    const ssnResult = maskSSN(maskedText)
    if (ssnResult.detected) {
      maskedText = ssnResult.masked
      hasPII = true
      detectedTypes.push('주민등록번호')
      warnings.push('⚠️ 주민등록번호는 입력하지 말아주세요. 보안을 위해 마스킹 처리되었습니다.')
    }
    
    // 3. 이메일 (경고만)
    if (detectEmail(text)) {
      detectedTypes.push('이메일')
      warnings.push('이메일 주소는 상담 폼을 통해 안전하게 전달해주세요.')
    }
    
    // 4. 주소 (경고)
    if (detectAddress(text)) {
      detectedTypes.push('주소')
      warnings.push('상세 주소는 상담 폼을 통해 안전하게 전달해주세요.')
    }
    
    // 5. 의료 정보 (경고)
    if (detectMedicalTerms(text)) {
      detectedTypes.push('의료정보')
      warnings.push('구체적인 의료 정보는 담당 간호사나 의사와 상담해주세요.')
    }
    
    return {
      hasPII: hasPII || detectedTypes.length > 0,
      maskedText,
      warnings,
      detectedTypes
    }
  }
  
  /**
   * 안전 메시지 (입력창 placeholder 또는 안내)
   */
  export const SAFETY_MESSAGE = `💡 주민번호, 상세 주소, 구체적 진단명 등 민감정보는 입력하지 말아주세요.
  상담이 필요하신 경우 전화(031-856-809) 또는 상담 폼을 이용해주세요.`
  
  /**
   * 경고 메시지 템플릿
   */
  export function formatWarnings(warnings: string[]): string {
    if (warnings.length === 0) return ''
    
    return `\n\n⚠️ 보안 안내:\n${warnings.map(w => `• ${w}`).join('\n')}`
  }
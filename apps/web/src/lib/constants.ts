import { 
    Service, 
    Differentiator, 
    Review, 
    TrustIndicator, 
    QuickContactItem,
    NavigationItem,
    InquiryType
  } from '@/types'
  
  // 사이트 정보
  export const SITE_INFO = {
    name: '행복한요양원',
    slogan: '가족의 마음으로 따뜻하게, 전문가와 안전하게',
    phone: '031-856-8090',
    email: 'happy8568090@gmail.com',
    address: {
      full: '경기 양주시 외미로20번길 34 (남방동)',
      city: '경기 양주시',
      district: '양주시',
      street: '외미로20번길 34',
      zipCode: '06234',
    },
    businessInfo: {
      owner: '박준호',
      registrationNumber: '292-80-03705',
      established: '2026-04-01',
    },
    social: {
      facebook: 'https://www.facebook.com/profile.php?id=61580800010457',
      instagram: 'https://instagram.com/happynursinghome',
      blog: 'https://blog.naver.com/happy-n-y',
      youtube: 'https://www.youtube.com/channel/UCr5NVnuu8ROSXjAuY1uVM-Q',
    },
    kakaoChannelId: '_xaXXXX',
  } as const
  
  // 신뢰 지표
  export const TRUST_INDICATORS: TrustIndicator[] = [
    {
      id: 'experience',
      value: '11',
      label: '운영 경력',
      unit: '년',
    },
    {
      id: 'staff',
      value: '25',
      label: '전문 인력',
      unit: '명',
    },
    {
      id: 'satisfaction',
      value: '99',
      label: '만족도',
      unit: '%',
    },
  ]
  
  // 내비게이션 메뉴
  export const NAVIGATION: NavigationItem[] = [
    {
      id: 'about',
      label: '소개',
      href: '/about',
    },
    {
      id: 'services',
      label: '서비스',
      href: '/services',
    },
    {
      id: 'pricing',
      label: '입소비용',
      href: '/pricing',
    },
    {
      id: 'reviews',
      label: '후기',
      href: '/reviews',
    },
    {
      id: 'contact',
      label: '상담신청',
      href: '/contact',
    },
    {
      id: 'location',
      label: '오시는 길',
      href: '/location',
    },
  ]
  
  // 빠른 연락처
  export const QUICK_CONTACTS: QuickContactItem[] = [
    {
      id: 'phone',
      icon: '📞',
      title: '전화 상담',
      description: SITE_INFO.phone,
      action: 'call',
      href: `tel:${SITE_INFO.phone}`,
      type: 'tel',
    },
    {
      id: 'kakao',
      icon: '💬',
      title: '카카오톡 상담',
      description: '1:1 채팅 시작',
      action: 'kakao',
      href: `https://open.kakao.com/o/svXNViii`,
      type: 'kakao',
    },
    {
      id: 'inquiry',
      icon: '📝',
      title: '온라인 문의',
      description: '상담 신청하기',
      action: 'inquiry',
      href: '#contact',
      type: 'link',
    },
  ]
  
  // 서비스 목록
  export const SERVICES: Service[] = [
    {
      id: 'medical',
      icon: '🩺',
      title: '24시간 전문 간호',
      description: '간호사와 요양보호사가 24시간 상주하여 건강 상태를 모니터링하고 즉각적인 대응을 제공합니다',
    },
    {
      id: 'nutrition',
      icon: '🍽️',
      title: '영양 맞춤 식단',
      description: '영양사가 설계한 균형 잡힌 식단으로 건강한 식사를 제공하며, 개인별 식이 요구사항을 반영합니다',
    },
    {
      id: 'program',
      icon: '🎨',
      title: '다양한 프로그램',
      description: '인지 활동, 작업 치료, 레크리에이션 등 다채로운 프로그램으로 활기찬 생활을 지원합니다',
    },
    {
      id: 'facility',
      icon: '🏡',
      title: '쾌적한 환경',
      description: '깨끗하고 안전한 시설, 편안한 침실과 공용 공간에서 마치 집처럼 편안하게 지내실 수 있습니다',
    },
  ]
  
  // 차별화 포인트
  export const DIFFERENTIATORS: Differentiator[] = [
    {
      id: 'ratio',
      icon: '👥',
      title: '2:1 낮은 입소자 대비 직원 비율',
      description: '일반 요양원보다 2배 많은 인력으로 더욱 세심하고 개인화된 케어를 제공합니다',
      color: 'green',
    },
    {
      id: 'certification',
      icon: '⭐',
      title: '최우수 A등급 인증 시설',
      description: '국민건강보험 노인요양시설 평가에서 최고 등급을 획득한 검증된 시설입니다',
      color: 'orange',
    },
    {
      id: 'personalized',
      icon: '📋',
      title: '개별 맞춤 케어 플랜',
      description: '입소자 개개인의 건강 상태와 생활 습관을 고려한 맞춤형 케어 계획을 수립합니다',
      color: 'brown',
    },
    {
      id: 'communication',
      icon: '💌',
      title: '가족과의 소통 시스템',
      description: '정기적인 건강 리포트와 실시간 연락 시스템으로 가족과 투명하게 소통합니다',
      color: 'green',
    },
  ]
  
  // 후기 목록
  export const REVIEWS: Review[] = [
    
    {
      id: 'review-1',
      author: '김**님',
      date: '2026년 3월',
      rating: 5,
      content: '처음 요양원을 알아보는 입장이라 모르는 것이 많았는데, 장기요양등급부터 비용까지 하나씩 차분하게 설명해주셔서 부담이 덜했습니다. 급하게 결정하라고 하지 않고 보호자 입장에서 안내해주시는 점이 좋았습니다.',
      verified: true,
    },
    {
      id: 'review-2',
      author: '박**님',
      date: '2026년 3월',
      rating: 5,
      content: '요양원 비용이 가장 걱정이었는데 본인부담금과 비급여 항목을 구분해서 쉽게 설명해주셔서 이해가 잘 됐습니다. 과장 없이 현실적으로 안내해주셔서 신뢰가 갔습니다.',
      verified: true,
    },
    {
      id: 'review-3',
      author: '이**님',
      date: '2026년 3월',
      rating: 5,
      content: '무엇을 준비해야 하는지 막막했는데 상담을 받고 나니 입소 절차와 준비서류가 머릿속에 정리됐습니다. 보호자가 어떤 부분을 먼저 확인해야 하는지도 알려주셔서 도움이 많이 됐습니다.',
      verified: true,
    }
  ]
  
  // 문의 유형
  export const INQUIRY_TYPES: { value: InquiryType; label: string }[] = [
    { value: '입소상담', label: '입소 상담' },
    { value: '비용문의', label: '비용 문의' },
    { value: '시설견학', label: '시설 견학' },
    { value: '프로그램문의', label: '프로그램 문의' },
    { value: '기타', label: '기타' },
  ]
  
  // 개인정보 처리방침 텍스트
  export const PRIVACY_POLICY = {
    collectItems: '이름, 연락처, 이메일, 문의 내용',
    purpose: '상담 및 문의 답변',
    retention: '상담 완료 후 3개월',
    disclaimer: '귀하는 개인정보 제공에 대한 동의를 거부할 권리가 있으며, 동의 거부 시 상담 서비스 이용이 제한될 수 있습니다.',
  }
  
  // 푸터 링크
  export const FOOTER_LINKS = {
    quickLinks: [
      { label: '소개', href: '/about' },
      { label: '서비스', href: '/services' },
      { label: '입소비용', href: '/pricing' },
      { label: '후기', href: '/reviews' },
    ],
    contact: [
      { label: SITE_INFO.phone, href: `tel:${SITE_INFO.phone}` },
      { label: '온라인 문의', href: '/contact' },
      { label: '카카오톡 상담', href: `https://open.kakao.com/o/svXNViii` },
      { label: '오시는 길', href: '/location' },
    ],
    info: [
      { label: '입소 절차', href: '/admission' },
      { label: '개인정보처리방침', href: '/privacy' },
      { label: '입소비용', href: '/pricing' },
      { label: '이용약관', href: '/terms' },
      { label: '시설 안내', href: '/about#facility' },
    ],
  }
  
  // 메타데이터
  export const DEFAULT_METADATA = {
    title: '행복한요양원 | 경기 양주시 전문 요양 시설',
    description: '13년 전통의 행복한요양원. 전문 간호사 24시간 상주, 개별 맞춤 케어, 지자체 A등급 인증. 가족처럼 따뜻하게, 전문가처럼 안전하게.',
    keywords: '요양원, 경기도요양원, 양주시요양원, 노인요양시설, 전문요양원, 장기요양, 노인요양, 의정부요양원, 양주요양원, 행복한요양원, 녹양역요양원',
    ogImage: '/og-image.jpg',
    naverSiteVerification: '0681d688b8f58007d39fc3e823d6ea4eaf6a947a',
    googleSiteVerification: 'VInI3tQKpj10YeNKWxqsV61dh89JmJtrdbYh9KrLr2U'
  }
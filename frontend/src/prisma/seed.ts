import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // ===================================
  // 1. 서비스 데이터
  // ===================================
  console.log('📦 Seeding services...')
  
  const services = [
    {
      title: '24시간 전문 간호',
      description: '간호사와 요양보호사가 24시간 상주하여 건강 상태를 모니터링하고 즉각적인 대응을 제공합니다',
      icon: '🩺',
      order: 1,
    },
    {
      title: '영양 맞춤 식단',
      description: '영양사가 설계한 균형 잡힌 식단으로 건강한 식사를 제공하며, 개인별 식이 요구사항을 반영합니다',
      icon: '🍽️',
      order: 2,
    },
    {
      title: '다양한 프로그램',
      description: '인지 활동, 작업 치료, 레크리에이션 등 다채로운 프로그램으로 활기찬 생활을 지원합니다',
      icon: '🎨',
      order: 3,
    },
    {
      title: '쾌적한 환경',
      description: '깨끗하고 안전한 시설, 편안한 침실과 공용 공간에서 마치 집처럼 편안하게 지내실 수 있습니다',
      icon: '🏡',
      order: 4,
    },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: { title: service.title },
      update: service,
      create: service,
    })
  }

  console.log('✅ Services seeded')

  // ===================================
  // 2. 차별화 포인트 데이터
  // ===================================
  console.log('📦 Seeding differentiators...')
  
  const differentiators = [
    {
      title: '1:5 낮은 입소자 대비 직원 비율',
      description: '일반 요양원보다 2배 많은 인력으로 더욱 세심하고 개인화된 케어를 제공합니다',
      icon: '👥',
      color: 'green',
      order: 1,
    },
    {
      title: '지자체 A등급 인증 시설',
      description: '양주시 노인요양시설 평가에서 최고 등급을 획득한 검증된 시설입니다',
      icon: '⭐',
      color: 'orange',
      order: 2,
    },
    {
      title: '개별 맞춤 케어 플랜',
      description: '입소자 개개인의 건강 상태와 생활 습관을 고려한 맞춤형 케어 계획을 수립합니다',
      icon: '📋',
      color: 'brown',
      order: 3,
    },
    {
      title: '가족과의 소통 시스템',
      description: '정기적인 건강 리포트와 실시간 연락 시스템으로 가족과 투명하게 소통합니다',
      icon: '💌',
      color: 'green',
      order: 4,
    },
  ]

  for (const diff of differentiators) {
    await prisma.differentiator.upsert({
      where: { title: diff.title },
      update: diff,
      create: diff,
    })
  }

  console.log('✅ Differentiators seeded')

  // ===================================
  // 3. 후기 데이터
  // ===================================
  console.log('📦 Seeding reviews...')
  
  const reviews = [
    {
      author: '김**님',
      date: '2024년 12월',
      rating: 5,
      content: '어머니를 모시기 위해 여러 요양원을 둘러봤는데, 행복한요양원의 시설과 직원분들의 태도가 가장 인상적이었습니다. 입소 후 3개월이 지났는데 어머니도 많이 편안해하시고, 정기적으로 보내주시는 사진과 건강 상태 리포트 덕분에 저희도 안심하고 있습니다.',
      verified: true,
      approved: true,
      featured: true,
    },
    {
      author: '박**님',
      date: '2024년 10월',
      rating: 5,
      content: '아버지께서 치매가 있으셔서 많이 걱정했는데, 전문적인 인지 프로그램과 세심한 케어 덕분에 증상이 많이 안정되었습니다. 요양보호사님들이 진심으로 대해주시는 것이 느껴져서 가족으로서 너무 감사합니다.',
      verified: true,
      approved: true,
      featured: true,
    },
    {
      author: '이**님',
      date: '2024년 9월',
      rating: 5,
      content: '시설이 너무 깨끗하고 직원분들도 친절하세요. 특히 식사가 정말 맛있다고 어머니께서 매번 칭찬하십니다. 다양한 프로그램 덕분에 요양원에서도 즐겁게 지내시는 것 같아 마음이 놓입니다.',
      verified: true,
      approved: true,
      featured: true,
    },
  ]

  for (const review of reviews) {
    await prisma.review.create({
      data: review,
    })
  }

  console.log('✅ Reviews seeded')

  // ===================================
  // 4. FAQ 데이터
  // ===================================
  console.log('📦 Seeding FAQs...')
  
  const faqs = [
    {
      question: '입소 절차는 어떻게 되나요?',
      answer: '1) 전화 또는 온라인 상담 신청 → 2) 시설 견학 및 상담 → 3) 필요 서류 제출 → 4) 계약 및 입소 순으로 진행됩니다. 평균 1-2주 소요됩니다.',
      category: '입소',
      order: 1,
    },
    {
      question: '비용은 어떻게 되나요?',
      answer: '입소자의 등급과 필요한 서비스에 따라 달라집니다. 자세한 상담을 통해 맞춤 견적을 제공해드리며, 정부 지원금 활용도 안내해드립니다.',
      category: '비용',
      order: 1,
    },
    {
      question: '면회는 언제 가능한가요?',
      answer: '평일 오전 10시부터 오후 6시까지 자유롭게 면회 가능합니다. 주말 및 공휴일도 같은 시간대에 가능하며, 사전 연락 주시면 더욱 좋습니다.',
      category: '시설',
      order: 1,
    },
    {
      question: '어떤 프로그램이 진행되나요?',
      answer: '인지 활동, 작업 치료, 음악 치료, 미술 치료, 원예 활동, 체조, 레크리에이션 등 다양한 프로그램이 매일 진행됩니다.',
      category: '프로그램',
      order: 1,
    },
  ]

  for (const faq of faqs) {
    await prisma.fAQ.create({
      data: faq,
    })
  }

  console.log('✅ FAQs seeded')

  // ===================================
  // 5. 관리자 계정 (기본)
  // ===================================
  console.log('📦 Creating admin account...')
  
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  await prisma.admin.upsert({
    where: { email: 'admin@happynursinghome.com' },
    update: {},
    create: {
      email: 'admin@happynursinghome.com',
      password: hashedPassword,
      name: '관리자',
      role: 'SUPER_ADMIN',
    },
  })

  console.log('✅ Admin account created')
  console.log('   Email: admin@happynursinghome.com')
  console.log('   Password: admin123')
  console.log('   ⚠️  Change this password immediately in production!')

  // ===================================
  // 6. 사이트 설정
  // ===================================
  console.log('📦 Setting up site settings...')
  
  const settings = [
    { key: 'site_name', value: '행복한요양원' },
    { key: 'site_phone', value: '031-856-8090' },
    { key: 'site_email', value: 'ghdlwnsgh25@gmail.com' },
    { key: 'site_address', value: '경기 양주시 외미로20번길 34' },
    { key: 'kakao_channel_id', value: '_xaXXXX' },
    { key: 'operating_years', value: '15' },
    { key: 'staff_count', value: '25' },
    { key: 'satisfaction_rate', value: '98' },
  ]

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    })
  }

  console.log('✅ Site settings configured')

  // ===================================
  // 7. History 샘플 데이터
  // ===================================
  console.log('📦 Seeding history posts...')
  
  const historyPosts = [
    {
      title: '2025년 새해맞이 떡국 나누기 행사',
      slug: 'new-year-tteokguk-2025',
      category: 'PROGRAM',
      content: `
        <p>2025년 새해를 맞아 입소자분들과 함께 따뜻한 떡국을 나누는 시간을 가졌습니다.</p>
        <p>직접 준비한 떡국에는 특별히 신선한 재료와 정성이 가득 담겨 있었습니다.</p>
        <h3>행사 하이라이트</h3>
        <ul>
          <li>전통 떡국 만들기 시연</li>
          <li>가족들과 함께하는 식사 시간</li>
          <li>새해 소망 나누기</li>
        </ul>
        <p>모든 분들의 얼굴에 행복한 미소가 가득했던 의미 있는 시간이었습니다.</p>
      `,
      excerpt: '2025년 새해를 맞아 입소자분들과 함께 따뜻한 떡국을 나누는 시간을 가졌습니다.',
      tags: ['새해', '행사', '프로그램', '떡국'],
      author: '프로그램팀',
      isPublished: true,
      publishedAt: new Date('2025-01-01'),
    },
    {
      title: '겨울철 영양 관리 - 제철 과일과 채소',
      slug: 'winter-nutrition-guide',
      category: 'MEAL',
      content: `
        <p>겨울철 건강한 식단을 위해 제철 과일과 채소를 활용한 영양 관리 방법을 소개합니다.</p>
        <h3>이번 주 특별 식단</h3>
        <ul>
          <li><strong>월요일:</strong> 시금치 된장국, 고등어구이</li>
          <li><strong>수요일:</strong> 무생채, 닭가슴살 조림</li>
          <li><strong>금요일:</strong> 배추전골, 잡곡밥</li>
        </ul>
        <p>모든 식재료는 당일 아침 신선하게 준비하여 영양소 손실을 최소화합니다.</p>
      `,
      excerpt: '겨울철 건강한 식단을 위해 제철 과일과 채소를 활용한 영양 관리 방법을 소개합니다.',
      tags: ['식단', '영양', '건강', '겨울'],
      author: '영양팀',
      isPublished: true,
      publishedAt: new Date('2025-01-15'),
    },
    {
      title: '침실 리모델링 완료 안내',
      slug: 'room-remodeling-complete',
      category: 'FACILITY',
      content: `
        <p>더욱 쾌적하고 편안한 환경을 위한 침실 리모델링이 완료되었습니다.</p>
        <h3>개선 사항</h3>
        <ul>
          <li>친환경 벽지 및 바닥재 교체</li>
          <li>LED 조명으로 전면 교체 (눈 건강 고려)</li>
          <li>냉난방 시스템 업그레이드</li>
          <li>수납공간 확충</li>
        </ul>
        <p>입소자분들의 안전과 편의를 최우선으로 고려한 설계입니다.</p>
      `,
      excerpt: '더욱 쾌적하고 편안한 환경을 위한 침실 리모델링이 완료되었습니다.',
      tags: ['시설', '리모델링', '개선'],
      author: '시설관리팀',
      isPublished: true,
      publishedAt: new Date('2024-12-20'),
    },
    {
      title: '가족과 함께한 크리스마스 특별 행사',
      slug: 'christmas-family-event-2024',
      category: 'FAMILY',
      content: `
        <p>따뜻한 크리스마스를 맞아 가족분들을 초대하여 특별한 시간을 가졌습니다.</p>
        <p>캐롤 합창, 선물 교환, 그리고 맛있는 식사까지 함께 즐기며 소중한 추억을 만들었습니다.</p>
        <h3>행사 프로그램</h3>
        <ul>
          <li>14:00 - 가족 초청 및 환영식</li>
          <li>14:30 - 캐롤 합창 및 공연</li>
          <li>15:30 - 선물 교환 및 간식 시간</li>
          <li>16:30 - 기념 촬영</li>
        </ul>
        <p>참석해주신 모든 가족분들께 감사드립니다.</p>
      `,
      excerpt: '따뜻한 크리스마스를 맞아 가족분들을 초대하여 특별한 시간을 가졌습니다.',
      tags: ['가족', '크리스마스', '행사'],
      author: '프로그램팀',
      isPublished: true,
      publishedAt: new Date('2024-12-25'),
    },
    {
      title: '2024년 행복한요양원 운영 결산',
      slug: 'annual-report-2024',
      category: 'ARCHIVE',
      content: `
        <p>2024년 한 해 동안 행복한요양원의 주요 활동과 성과를 정리합니다.</p>
        <h3>주요 성과</h3>
        <ul>
          <li>총 프로그램 운영: 240회</li>
          <li>가족 행사 개최: 12회</li>
          <li>시설 개선 투자: 5건</li>
          <li>입소자 만족도: 98%</li>
        </ul>
        <p>2025년에도 더 나은 서비스로 보답하겠습니다.</p>
      `,
      excerpt: '2024년 한 해 동안 행복한요양원의 주요 활동과 성과를 정리합니다.',
      tags: ['결산', '2024년', '성과'],
      author: '운영팀',
      isPublished: true,
      publishedAt: new Date('2024-12-31'),
    },
    {
      title: '인지활동 프로그램 확대 운영 안내',
      slug: 'cognitive-program-expansion',
      category: 'NOTICE',
      content: `
        <p>입소자분들의 인지 기능 향상을 위한 프로그램을 확대 운영합니다.</p>
        <h3>신규 프로그램</h3>
        <ul>
          <li><strong>회상 치료:</strong> 매주 화요일 오전 10시</li>
          <li><strong>미술 치료:</strong> 매주 목요일 오후 2시</li>
          <li><strong>음악 치료:</strong> 매주 금요일 오전 11시</li>
        </ul>
        <p>전문 치료사가 진행하며, 개별 맞춤형 활동이 제공됩니다.</p>
      `,
      excerpt: '입소자분들의 인지 기능 향상을 위한 프로그램을 확대 운영합니다.',
      tags: ['공지', '프로그램', '인지활동'],
      author: '프로그램팀',
      isPublished: true,
      publishedAt: new Date('2025-01-10'),
    },
  ]

  for (const post of historyPosts) {
    await prisma.historyPost.create({
      data: post,
    })
  }

  console.log('✅ History posts seeded')

  console.log('\n🎉 Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
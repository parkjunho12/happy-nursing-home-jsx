interface OrganizationSchemaProps {
    name?: string
    url?: string
    logo?: string
    address?: {
      streetAddress: string
      addressLocality: string
      addressRegion: string
      postalCode: string
    }
    contactPoint?: {
      telephone: string
      contactType: string
    }
  }
  
  export function OrganizationSchema({
    name = '행복한요양원 녹양역점',
    url = 'https://www.행복한요양원녹양역.com',
    logo = 'https://www.행복한요양원녹양역.com/logo.png',
    address = {
      streetAddress: '녹양역 인근',
      addressLocality: '의정부시',
      addressRegion: '경기도',
      postalCode: '11600',
    },
    contactPoint = {
      telephone: '02-1234-5678',
      contactType: 'customer service',
    },
  }: OrganizationSchemaProps) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'NursingHome',
      name,
      url,
      logo,
      image: logo,
      description: '의정부 녹양역 인근 프리미엄 요양원. 전문 의료진과 함께하는 따뜻한 돌봄 서비스.',
      address: {
        '@type': 'PostalAddress',
        ...address,
        addressCountry: 'KR',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        ...contactPoint,
        availableLanguage: 'Korean',
      },
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '17:00',
      },
      priceRange: '$$',
    }
  
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    )
  }
  
  interface ArticleSchemaProps {
    headline: string
    description: string
    datePublished: string
    dateModified?: string
    image?: string
    author?: string
    url: string
  }
  
  export function ArticleSchema({
    headline,
    description,
    datePublished,
    dateModified,
    image = 'https://www.행복한요양원녹양역.com/og-image.jpg',
    author = '행복한요양원',
    url,
  }: ArticleSchemaProps) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline,
      description,
      image,
      datePublished,
      dateModified: dateModified || datePublished,
      author: {
        '@type': 'Organization',
        name: author,
      },
      publisher: {
        '@type': 'Organization',
        name: '행복한요양원',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.행복한요양원녹양역.com/logo.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://www.행복한요양원녹양역.com${url}`,
      },
    }
  
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    )
  }
  
  interface BreadcrumbSchemaProps {
    items: Array<{
      name: string
      url: string
    }>
  }
  
  export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `https://www.행복한요양원녹양역.com${item.url}`,
      })),
    }
  
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    )
  }
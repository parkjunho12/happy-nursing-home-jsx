export type HistoryCategory = 
  | 'NOTICE' 
  | 'PROGRAM' 
  | 'MEAL' 
  | 'FACILITY' 
  | 'FAMILY' 
  | 'ARCHIVE'

export interface HistoryPost {
  id: string
  title: string
  slug: string
  category: HistoryCategory
  content: string
  excerpt?: string
  thumbnail?: string
  tags: string[]
  author?: string
  viewCount: number
  isPublished: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface HistoryFilter {
  category?: HistoryCategory
  year?: number
  month?: number
  search?: string
  tag?: string
}

export interface HistoryListItem {
  id: string
  title: string
  slug: string
  category: HistoryCategory
  excerpt?: string
  thumbnail?: string
  tags: string[]
  publishedAt: Date
  viewCount: number
}


export const CATEGORY_CONFIG: Record<HistoryCategory, {
  label: string
  emoji: string
  color: string
  description: string
}> = {
  NOTICE: {
    label: '공지사항',
    emoji: '📢',
    color: 'orange',
    description: '중요한 안내와 소식을 전합니다'
  },
  PROGRAM: {
    label: '프로그램',
    emoji: '🎨',
    color: 'green',
    description: '다양한 활동과 프로그램 소식'
  },
  MEAL: {
    label: '식단/영양',
    emoji: '🍽️',
    color: 'brown',
    description: '영양 만점 식단과 특식 소개'
  },
  FACILITY: {
    label: '시설 소식',
    emoji: '🏡',
    color: 'blue',
    description: '시설 개선과 새로운 변화'
  },
  FAMILY: {
    label: '가족 이야기',
    emoji: '💝',
    color: 'pink',
    description: '따뜻한 이야기와 소통'
  },
  ARCHIVE: {
    label: '기록',
    emoji: '📖',
    color: 'gray',
    description: '우리의 발자취와 역사'
  }
}
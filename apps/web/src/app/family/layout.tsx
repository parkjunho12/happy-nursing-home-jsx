import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '보호자 앨범 | 행복한요양원',
  description: '소중한 가족의 일상을 언제 어디서나 확인하세요',
  robots: { index: false, follow: false },
}

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

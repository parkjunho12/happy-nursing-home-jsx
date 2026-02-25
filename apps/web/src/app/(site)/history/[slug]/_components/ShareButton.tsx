'use client'

import { Share2 } from 'lucide-react'

export default function ShareButton({ title }: { title: string }) {
  const onShare = async () => {
    try {
      const url = window.location.href

      if (navigator.share) {
        await navigator.share({
          title,
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
      alert('링크가 복사되었습니다.')
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="flex items-center gap-2 hover:text-primary-orange transition-colors"
    >
      <Share2 className="w-5 h-5" />
      <span>공유하기</span>
    </button>
  )
}
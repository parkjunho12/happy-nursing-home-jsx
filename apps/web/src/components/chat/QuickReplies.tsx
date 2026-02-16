'use client'

import { QUICK_REPLIES } from '@/lib/chat/ragPrompt'

interface QuickRepliesProps {
  onSelect: (query: string) => void
  disabled?: boolean
}

export default function QuickReplies({ onSelect, disabled }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {QUICK_REPLIES.map((reply, index) => (
        <button
          key={index}
          onClick={() => onSelect(reply.query)}
          disabled={disabled}
          className="px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:border-primary-orange hover:text-primary-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reply.text}
        </button>
      ))}
    </div>
  )
}
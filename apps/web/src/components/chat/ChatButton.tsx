'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import ChatWidget from './ChatWidget'

export default function ChatButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40 group animate-bounce"
          aria-label="상담 도우미 열기"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
          
          {/* 알림 배지 */}
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
            1
          </span>
          
          {/* 툴팁 */}
          <span className="absolute right-full mr-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            궁금한 점을 물어보세요!
          </span>
        </button>
      )}

      {/* 챗봇 위젯 */}
      <ChatWidget isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
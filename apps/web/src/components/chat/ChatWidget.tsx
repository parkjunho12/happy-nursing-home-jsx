'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { X, Send, AlertCircle } from 'lucide-react'
import ChatMessage from './ChatMessage'
import QuickReplies from './QuickReplies'
import { WELCOME_MESSAGE } from '@/lib/chat/ragPrompt'
import { SAFETY_MESSAGE } from '@/lib/chat/pii-filter'

interface ChatWidgetProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(true)

  // ✅ useChat
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    append,     // ✅ 추가
    setInput,   // ✅ 있으면 사용 (버전에 따라 없을 수도)
  } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: WELCOME_MESSAGE,
        createdAt: new Date(),
      },
    ],
    onFinish: () => {
      setShowQuickReplies(false)
    },
    onError: (error) => {
      console.error('[Chat Error]:', error)
    },
  })

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 위젯 열릴 때 입력창 포커스
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // ✅ Quick Reply 선택: "이벤트 조작" 금지 → append로 바로 전송
  const handleQuickReply = async (query: string) => {
    setShowQuickReplies(false)

    // setInput이 제공되는 버전이면 UX 위해 입력창에도 반영
    if (typeof setInput === 'function') setInput(query)

    await append({
      role: 'user',
      content: query,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-md h-[600px] bg-white rounded-2xl shadow-2xl border-2 border-gray-200 flex flex-col z-50 animate-in slide-in-from-bottom-4 md:max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-orange to-orange-500 text-white rounded-t-2xl">
        <div>
          <h3 className="font-bold text-lg">행복한요양원</h3>
          <p className="text-sm text-white/90">상담 도우미</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
        {/* 안전 안내 */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">{SAFETY_MESSAGE}</p>
          </div>
        </div>

        {/* Messages */}
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id || index}
            message={{
              id: message.id,
              role: message.role as 'user' | 'assistant',
              content: message.content,
              timestamp: (message as any).createdAt || new Date(),
            }}
            isStreaming={isLoading && index === messages.length - 1}
          />
        ))}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              ⚠️ {error.message || '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
            </p>
          </div>
        )}

        {/* Scroll Anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {showQuickReplies && messages.length === 1 && (
        <div className="px-6 py-3 bg-white border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">빠른 질문:</p>
          <QuickReplies onSelect={handleQuickReply} disabled={isLoading} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-6 py-4 bg-white border-t border-gray-200 rounded-b-2xl">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="메시지를 입력하세요..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-full focus:outline-none focus:border-primary-orange disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 bg-primary-orange text-white rounded-full hover:bg-primary-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="전송"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Character Count */}
        <div className="mt-2 text-right">
          <span className="text-xs text-gray-500">{input.length}/500</span>
        </div>
      </form>
    </div>
  )
}

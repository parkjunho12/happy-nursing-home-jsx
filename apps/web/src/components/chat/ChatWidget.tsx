'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { X, Send, AlertCircle } from 'lucide-react'
import ChatMessage from './ChatMessage'
import QuickReplies from './QuickReplies'
import { WELCOME_MESSAGE } from '@/lib/chat/ragPrompt'
import { SAFETY_MESSAGE } from '@/lib/chat/pii-filter'
import { DefaultChatTransport, type UIMessage } from 'ai'

interface ChatWidgetProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(true)

  // ✅ v6: input을 직접 관리
  const [input, setInput] = useState('')

  const initialMessages = useMemo<UIMessage[]>(
    () => [
      {
        id: 'welcome',
        role: 'assistant',
        parts: [{ type: 'text', text: WELCOME_MESSAGE }],
      },
    ],
    []
  )

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: initialMessages,
    onFinish: () => setShowQuickReplies(false),
    onError: (e) => console.error('[Chat Error]:', e),
  })
  

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setShowQuickReplies(false)
    setInput('')
    await sendMessage({ text })
  }

  const handleQuickReply = async (query: string) => {
    if (isLoading) return
    setShowQuickReplies(false)
    setInput('')
    await sendMessage({ text: query })
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-md h-[600px] bg-white rounded-2xl shadow-2xl border-2 border-gray-200 flex flex-col z-50 animate-in slide-in-from-bottom-4 md:max-w-lg">
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-orange to-orange-500 text-white rounded-t-2xl">
        <div>
          <h3 className="font-bold text-lg">행복한요양원</h3>
          <p className="text-sm text-white/90">상담 도우미</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors" aria-label="닫기">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">{SAFETY_MESSAGE}</p>
          </div>
        </div>

        {messages.map((m, idx) => {
          // v6: parts 기반 메시지 → 텍스트만 추출
          const text =
            Array.isArray((m as any).parts)
              ? ((m as any).parts.find((p: any) => p?.type === 'text')?.text ?? '')
              : ((m as any).content ?? '')

          return (
            <ChatMessage
              key={(m as any).id || idx}
              message={{
                id: (m as any).id,
                role: m.role as 'user' | 'assistant',
                content: text,
                timestamp: (m as any).createdAt || new Date(),
              }}
              isStreaming={isLoading && idx === messages.length - 1}
            />
          )
        })}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              ⚠️ {(error as any).message || '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showQuickReplies && messages.length === 1 && (
        <div className="px-6 py-3 bg-white border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">빠른 질문:</p>
          <QuickReplies onSelect={handleQuickReply} disabled={isLoading} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-6 py-4 bg-white border-t border-gray-200 rounded-b-2xl">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
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

        <div className="mt-2 text-right">
          <span className="text-xs text-gray-500">{input.length}/500</span>
        </div>
      </form>
    </div>
  )
}

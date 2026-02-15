'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Send,
  Loader,
  Clock,
  Mail,
  Phone,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  Ban,
} from 'lucide-react'

type ContactStatus = 'PENDING' | 'REPLIED' | 'CLOSED' | 'SPAM'

interface ContactDTO {
  id: string
  name: string
  phone: string
  email: string | null
  inquiryType: string
  message: string
  status: ContactStatus
  reply: string | null
  repliedBy: string | null
  repliedAt: string | null      // ✅ fetch JSON은 string
  createdAt: string             // ✅ fetch JSON은 string
  updatedAt?: string
}

function ticketFromId(id: string) {
  return id.replace(/-/g, '').slice(0, 10).toUpperCase()
}

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contact, setContact] = useState<ContactDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState<ContactStatus>('PENDING')

  const ticketId = useMemo(() => (contact ? ticketFromId(contact.id) : ''), [contact])

  useEffect(() => {
    void fetchContact()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchContact = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/contacts/${params.id}`, { cache: 'no-store' })
      const data = await res.json()

      if (data?.success) {
        const c: ContactDTO = data.data
        setContact(c)
        setReply(c.reply || '')
        setStatus(c.status)
      } else {
        setContact(null)
      }
    } catch (error) {
      console.error('Fetch contact error:', error)
      setContact(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/contacts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply, status }),
      })

      if (!res.ok) {
        alert('저장에 실패했습니다')
        return
      }

      alert('답변이 저장되었습니다')
      await fetchContact()
    } catch (error) {
      console.error(error)
      alert('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary-orange" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">상담을 찾을 수 없습니다</p>
          <button
            onClick={() => router.push('/admin/contacts')}
            className="px-6 py-3 bg-primary-orange text-white rounded-lg"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const createdAt = new Date(contact.createdAt)
  const repliedAt = contact.repliedAt ? new Date(contact.repliedAt) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/contacts')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">상담 상세</h1>
                <p className="text-sm text-gray-500">티켓번호: {ticketId}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary-orange text-white rounded-lg font-medium hover:bg-primary-orange/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  저장
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* 문의 내용 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-orange" />
                문의 내용
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {contact.message}
                </p>
              </div>
            </div>

            {/* 답변 작성 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">답변 작성</h2>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="답변 내용을 입력하세요..."
                rows={10}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange"
              />
            </div>

            {/* 이전 답변 */}
            {repliedAt && contact.reply && (
              <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-bold text-green-900">답변 완료</h3>
                </div>
                <p className="text-sm text-green-700 mb-2">
                  {repliedAt.toLocaleString('ko-KR')} {contact.repliedBy ? `- ${contact.repliedBy}` : ''}
                </p>
                <div className="p-4 bg-white rounded-lg">
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {contact.reply}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* 상태 변경 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">상태 변경</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-primary-orange transition-colors">
                  <input
                    type="radio"
                    name="status"
                    value="PENDING"
                    checked={status === 'PENDING'}
                    onChange={(e) => setStatus(e.target.value as ContactStatus)}
                    className="w-4 h-4"
                  />
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium">대기 중</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-primary-orange transition-colors">
                  <input
                    type="radio"
                    name="status"
                    value="REPLIED"
                    checked={status === 'REPLIED'}
                    onChange={(e) => setStatus(e.target.value as ContactStatus)}
                    className="w-4 h-4"
                  />
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">답변 완료</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-primary-orange transition-colors">
                  <input
                    type="radio"
                    name="status"
                    value="CLOSED"
                    checked={status === 'CLOSED'}
                    onChange={(e) => setStatus(e.target.value as ContactStatus)}
                    className="w-4 h-4"
                  />
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium">종료</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-red-300 transition-colors">
                  <input
                    type="radio"
                    name="status"
                    value="SPAM"
                    checked={status === 'SPAM'}
                    onChange={(e) => setStatus(e.target.value as ContactStatus)}
                    className="w-4 h-4"
                  />
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium">스팸</span>
                  </div>
                </label>
              </div>
            </div>

            {/* 신청자 정보 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">신청자 정보</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">이름</p>
                    <p className="font-medium text-gray-900">{contact.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">전화번호</p>
                    <a href={`tel:${contact.phone}`} className="font-medium text-primary-orange hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                </div>

                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">이메일</p>
                      <a
                        href={`mailto:${contact.email}`}
                        className="font-medium text-primary-orange hover:underline break-all"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">문의 유형</p>
                  <p className="font-medium text-gray-900">{contact.inquiryType}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">신청일시</p>
                  <p className="text-sm text-gray-700">
                    {createdAt.toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* (선택) 모바일 하단 고정 저장 버튼 넣고 싶으면 여기 */}
      </div>
    </div>
  )
}

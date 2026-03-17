import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  ArrowLeft, 
  Send, 
  Phone, 
  Mail, 
  Calendar,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  Tag,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  ListChecks
} from 'lucide-react'
import { contactsAPI } from '@/api/client'
import type { Contact } from '@/types'

const ContactDetailPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (id) {
      loadContact(id)
    }
  }, [id])

  const loadContact = async (contactId: string) => {
    try {
      setLoading(true)
      const response = await contactsAPI.get(contactId)
      if (response) {
        setContact(response)
        if (response.reply) {
          setReply(response.reply)
        }
      }
    } catch (error) {
      console.error('Failed to load:', error)
      navigate('/contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleSendReply = async () => {
    if (!reply.trim() || !id) return

    try {
      setSending(true)
      await contactsAPI.reply(id, reply)
      loadContact(id)
    } catch (error) {
      alert('답변 전송에 실패했습니다')
    } finally {
      setSending(false)
    }
  }

  const handleClose = async () => {
    if (!id) return
    try {
      await contactsAPI.updateStatus(id, 'CLOSED')
      loadContact(id)
    } catch (error) {
      alert('상태 변경에 실패했습니다')
    }
  }

  const getStatusBadge = (status: Contact['status']) => {
    const badges = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '대기 중', icon: MessageSquare },
      REPLIED: { bg: 'bg-blue-100', text: 'text-blue-700', label: '답변 완료', icon: CheckCircle },
      CLOSED: { bg: 'bg-gray-100', text: 'text-gray-700', label: '종료', icon: XCircle },
    }
    const badge = badges[status]
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${badge.bg} ${badge.text}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    )
  }

  const getUrgencyBadge = (urgency: Contact['ai_urgency']) => {
    if (!urgency) return null
    
    const badges = {
      HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: '높음', icon: AlertTriangle },
      MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '보통', icon: TrendingUp },
      LOW: { bg: 'bg-green-100', text: 'text-green-700', label: '낮음', icon: CheckCircle },
    }
    const badge = badges[urgency]
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${badge.bg} ${badge.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.label}
      </span>
    )
  }

  const getCategoryBadge = (category: Contact['ai_category']) => {
    if (!category) return null
    
    const colors = {
      '입소': 'bg-blue-100 text-blue-700',
      '요금': 'bg-purple-100 text-purple-700',
      '면회': 'bg-green-100 text-green-700',
      '의료간호': 'bg-red-100 text-red-700',
      '프로그램': 'bg-orange-100 text-orange-700',
      '기타': 'bg-gray-100 text-gray-700',
    }
    
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${colors[category]}`}>
        {category}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!contact) return null

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          목록으로
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 상세</h1>
            <p className="text-gray-600">티켓 번호: {contact.ticket_id}</p>
          </div>
          {getStatusBadge(contact.status)}
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Analysis Section */}
        {contact.ai_summary && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 border-2 border-purple-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">AI 분석 결과</h2>
              {contact.ai_model && (
                <span className="ml-auto text-xs text-gray-500">
                  {contact.ai_model} · {contact.ai_created_at && new Date(contact.ai_created_at).toLocaleString('ko-KR')}
                </span>
              )}
            </div>

            {/* Summary */}
            <div className="mb-4">
              <p className="text-gray-900 leading-relaxed text-lg">
                {contact.ai_summary}
              </p>
            </div>

            {/* Category & Urgency */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">카테고리:</span>
                {getCategoryBadge(contact.ai_category)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">긴급도:</span>
                {getUrgencyBadge(contact.ai_urgency)}
              </div>
            </div>

            {/* Next Actions */}
            {contact.ai_next_actions && contact.ai_next_actions.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-5 h-5 text-purple-600" />
                  <span className="font-bold text-gray-900">권장 조치사항</span>
                </div>
                <ul className="space-y-2">
                  {contact.ai_next_actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-gray-900">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Contact Info */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">상담자 정보</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">이름</p>
                <p className="font-bold text-gray-900 text-lg">{contact.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">연락처</p>
                <p className="font-bold text-gray-900 text-lg">{contact.phone}</p>
              </div>
            </div>

            {contact.email && (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">이메일</p>
                  <p className="font-bold text-gray-900 text-lg">{contact.email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">접수일시</p>
                <p className="font-bold text-gray-900">
                  {new Date(contact.created_at).toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t-2 border-gray-100">
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">문의 유형</span>
              <span className="px-3 py-1 bg-gray-100 text-gray-900 rounded-lg font-bold">
                {contact.inquiry_type}
              </span>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">문의 내용</h2>
          <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-100">
            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-lg">
              {contact.message}
            </p>
          </div>
        </div>

        {/* Reply Section */}
        {contact.status === 'PENDING' ? (
          <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">답변 작성</h2>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="상담자에게 보낼 답변을 입력하세요..."
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent resize-none"
              rows={8}
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSendReply}
                disabled={!reply.trim() || sending}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-primary-orange text-white rounded-xl font-bold hover:bg-primary-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
                {sending ? '전송 중...' : '답변 전송'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">답변 내용</h2>
            <div className="p-6 bg-white rounded-xl border-2 border-blue-200">
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-lg">
                {contact.reply}
              </p>
            </div>
            {contact.replied_at && contact.replied_by && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>답변자: {contact.replied_by}</span>
                <span>{new Date(contact.replied_at).toLocaleString('ko-KR')}</span>
              </div>
            )}
            {contact.status === 'REPLIED' && (
              <div className="mt-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors"
                >
                  상담 종료
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Action Bar (for mobile) */}
      {contact.status === 'PENDING' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 md:hidden z-10">
          <button
            onClick={handleSendReply}
            disabled={!reply.trim() || sending}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-orange text-white rounded-xl font-bold disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            {sending ? '전송 중...' : '답변 전송'}
          </button>
        </div>
      )}
    </div>
  )
}

export default ContactDetailPage
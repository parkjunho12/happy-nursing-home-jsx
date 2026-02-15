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
  Tag
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
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold ${badge.bg} ${badge.text}`}>
        <Icon className="w-5 h-5" />
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin" />
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
              rows={10}
              className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent resize-none text-lg mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
              >
                답변 없이 종료
              </button>
              <button
                onClick={handleSendReply}
                disabled={sending || !reply.trim()}
                className="flex-1 px-6 py-4 bg-primary-orange text-white rounded-xl font-bold hover:bg-primary-orange/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {sending ? '전송 중...' : '답변 보내기'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">답변 내역</h2>
            </div>
            <div className="p-6 bg-white rounded-xl border-2 border-blue-200 mb-4">
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-lg">
                {contact.reply}
              </p>
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-bold text-blue-700">
                답변자: {contact.replied_by}
              </span>
              <span className="text-sm font-bold text-blue-700">
                {contact.replied_at && new Date(contact.replied_at).toLocaleString('ko-KR')}
              </span>
            </div>
            
            {contact.status !== 'CLOSED' && (
              <button
                onClick={handleClose}
                className="mt-4 w-full px-6 py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                종료하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactDetailPage
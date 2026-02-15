import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Clock, CheckCircle, X, Search, Eye } from 'lucide-react'
import { contactsAPI } from '@/api/client'
import type { Contact } from '@/types'

const ContactsPage = () => {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Contact['status'] | 'ALL'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await contactsAPI.list()
      setContacts(response || [])
    } catch (error: any) {
      console.error('Failed to load contacts:', error)
      setError(error.response?.data?.message || '상담 목록을 불러올 수 없습니다')
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: contacts.length,
    pending: contacts.filter(c => c.status === 'PENDING').length,
    replied: contacts.filter(c => c.status === 'REPLIED').length,
    closed: contacts.filter(c => c.status === 'CLOSED').length,
  }

  const filteredContacts = contacts
    .filter(c => filter === 'ALL' || c.status === filter)
    .filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ticket_id.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const getStatusBadge = (status: Contact['status']) => {
    const badges = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '대기 중', icon: Clock },
      REPLIED: { bg: 'bg-blue-100', text: 'text-blue-700', label: '답변 완료', icon: CheckCircle },
      CLOSED: { bg: 'bg-gray-100', text: 'text-gray-700', label: '종료', icon: X },
    }
    const badge = badges[status]
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">상담 목록 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-900 text-lg font-semibold mb-2">데이터를 불러올 수 없습니다</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadContacts}
            className="px-6 py-2 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 관리</h1>
        <p className="text-gray-600">총 {contacts.length}건의 상담 • 대기 중 {stats.pending}건</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border-2 border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">전체</span>
            <MessageSquare className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}건</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-yellow-200 bg-yellow-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yellow-700">대기 중</span>
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-900">{stats.pending}건</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-700">답변 완료</span>
            <CheckCircle className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.replied}건</p>
        </div>

        <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">종료</span>
            <X className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.closed}건</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl p-4 mb-6 border-2 border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Filters */}
          <div className="flex gap-2">
            {[
              { value: 'ALL', label: '전체' },
              { value: 'PENDING', label: '대기 중' },
              { value: 'REPLIED', label: '답변 완료' },
              { value: 'CLOSED', label: '종료' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value as any)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  filter === f.value
                    ? 'bg-primary-orange text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="이름 또는 티켓번호 검색..."
                className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="space-y-4">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => navigate(`/contacts/${contact.id}`)}
            className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{contact.name}</h3>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">
                    {contact.inquiry_type}
                  </span>
                  {getStatusBadge(contact.status)}
                </div>
                <p className="text-sm text-gray-600 mb-1">티켓: {contact.ticket_id}</p>
                <p className="text-sm text-gray-600">
                  {contact.phone} {contact.email && `• ${contact.email}`}
                </p>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Eye className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <p className="text-gray-900 line-clamp-2">{contact.message}</p>
            </div>

            {contact.reply && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-1">답변</p>
                <p className="text-sm text-blue-800 line-clamp-2">{contact.reply}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-blue-600">
                  <span>답변자: {contact.replied_by}</span>
                  <span>{contact.replied_at && new Date(contact.replied_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>접수: {new Date(contact.created_at).toLocaleString('ko-KR')}</span>
              <button className="text-primary-orange font-semibold hover:underline">
                상세 보기 →
              </button>
            </div>
          </div>
        ))}

        {filteredContacts.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg">
              {searchTerm || filter !== 'ALL' ? '검색 결과가 없습니다' : '아직 상담이 없습니다'}
            </p>
            {(searchTerm || filter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilter('ALL')
                }}
                className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactsPage
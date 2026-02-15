import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Eye, EyeOff, Search } from 'lucide-react'
import { historyAPI } from '@/api/client'
import type { History } from '@/types'

const HistoryPage = () => {
  const navigate = useNavigate()
  const [history, setHistory] = useState<History[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await historyAPI.list()
      setHistory(response || [])
    } catch (error: any) {
      console.error('Failed to load history:', error)
      setError(error.response?.data?.message || '히스토리 목록을 불러올 수 없습니다')
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await historyAPI.delete(id)
      loadHistory()
    } catch (error) {
      alert('삭제에 실패했습니다')
    }
  }

  const togglePublish = async (item: History) => {
    try {
      if (item.isPublished) {
        await historyAPI.unpublish(item.id)
      } else {
        await historyAPI.publish(item.id)
      }
      loadHistory()
    } catch (error) {
      alert('상태 변경에 실패했습니다')
    }
  }

  const getCategoryBadge = (category: History['category']) => {
    const badges = {
      PROGRAM: { bg: 'bg-blue-100', text: 'text-blue-700', label: '프로그램' },
      EVENT: { bg: 'bg-purple-100', text: 'text-purple-700', label: '행사' },
      NEWS: { bg: 'bg-green-100', text: 'text-green-700', label: '소식' },
      VOLUNTEER: { bg: 'bg-orange-100', text: 'text-orange-700', label: '봉사활동' },
    }
    const badge = badges[category]
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const filteredHistory = history.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">히스토리 로딩 중...</p>
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
            onClick={loadHistory}
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">히스토리 관리</h1>
          <p className="text-gray-600">총 {history.length}건</p>
        </div>
        <button 
          onClick={() => navigate('/history/new')}
          className="flex items-center gap-2 px-6 py-3 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 게시물
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="제목 검색..."
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
          />
        </div>
      </div>

      {/* History Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHistory.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getCategoryBadge(item.category)}
                  {item.isPublished ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                      <Eye className="w-3 h-3" />
                      공개
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                      <EyeOff className="w-3 h-3" />
                      비공개
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                  {item.title}
                </h3>
              </div>
            </div>

            {/* Content */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-3">
              {item.excerpt}
            </p>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {item.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    #{tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                <p>조회수: {item.viewCount || 0}</p>
                <p>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => togglePublish(item)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors ${
                    item.isPublished
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                  title={item.isPublished ? '비공개로 전환' : '공개로 전환'}
                >
                  {item.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => navigate(`/history/edit/${item.id}`)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredHistory.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border-2 border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg mb-4">
              {searchTerm ? '검색 결과가 없습니다' : '아직 게시물이 없습니다'}
            </p>
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                검색 초기화
              </button>
            ) : (
              <button
                onClick={() => navigate('/history/new')}
                className="px-6 py-2 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors"
              >
                첫 게시물 작성하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
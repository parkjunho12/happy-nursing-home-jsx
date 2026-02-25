import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Eye, EyeOff, Search } from 'lucide-react'
import { historyAPI } from '@/api/client'
import type { History } from '@/types'

/**
 * ✅ 이 페이지 개선 포인트
 * 1) 카드 자체 클릭 = 편집 페이지로 이동(관리 UX 빠르게)
 * 2) 버튼 클릭은 stopPropagation()으로 카드 클릭과 충돌 방지
 * 3) publish/unpublish는 API가 있으면 사용, 없으면 update로 폴백(안정성)
 * 4) list() 응답이 "배열"이든 "페이지형({data,total...})"이든 안전 처리
 * 5) snake_case가 섞여 와도 여기서 정규화(normalize)해서 UI는 항상 camelCase만 사용
 * 6) 토글/삭제는 낙관적 업데이트(바로 UI 반영) + 실패 시 롤백
 */

type HistoryListResponse =
  | History[]
  | { success?: boolean; data?: any; message?: string | null; error?: any }
  | any

function extractList(res: HistoryListResponse): any[] {
  // 케이스1: 바로 배열
  if (Array.isArray(res)) return res
  // 케이스2: {success, data:[...]}
  if (res && Array.isArray(res.data)) return res.data
  // 케이스3: page response {success, data:{data:[...]}}
  if (res && res.data && Array.isArray(res.data.data)) return res.data.data
  return []
}

/** ✅ 서버에서 snake_case가 오더라도 화면에서 쓸 History 형태로 통일 */
function normalizeHistory(raw: any): History {
  // 이미 History라면 대부분 그대로지만, snake가 섞여올 수 있어 보정
  return {
    id: raw.id,
    title: raw.title ?? '',
    slug: raw.slug ?? '',
    category: raw.category ?? 'PROGRAM',
    content: raw.content ?? '',
    excerpt: raw.excerpt ?? '',
    tags: raw.tags ?? [],
    // snake → camel 보정
    isPublished:
      raw.isPublished ??
      raw.is_published ??
      false,
    publishedAt:
      raw.publishedAt ??
      raw.published_at ??
      null,
    viewCount:
      raw.viewCount ??
      raw.view_count ??
      0,
    imageUrl:
      raw.imageUrl ??
      raw.image_url ??
      '',
    createdAt:
      raw.createdAt ??
      raw.created_at ??
      new Date().toISOString(),
    updatedAt:
      raw.updatedAt ??
      raw.updated_at ??
      null,
  } as History
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<History[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null) // ✅ 특정 카드 작업 중 표시
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    void loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await historyAPI.list()
      const list = extractList(res).map(normalizeHistory)

      // 최신순 정렬: publishedAt 있으면 그걸, 없으면 createdAt
      list.sort((a, b) => {
        const ta = new Date((a.publishedAt as any) || a.createdAt).getTime()
        const tb = new Date((b.publishedAt as any) || b.createdAt).getTime()
        return tb - ta
      })

      setHistory(list)
    } catch (e: any) {
      console.error('Failed to load history:', e)
      setError(e?.response?.data?.message || '히스토리 목록을 불러올 수 없습니다')
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const onCardClick = (id: string) => {
    navigate(`/history/edit/${id}`)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('정말 삭제하시겠습니까?')) return

    const prev = history
    setBusyId(id)
    // ✅ 낙관적 제거
    setHistory((p) => p.filter((x) => x.id !== id))

    try {
      await historyAPI.delete(id)
    } catch (err) {
      console.error(err)
      alert('삭제에 실패했습니다')
      // 롤백
      setHistory(prev)
    } finally {
      setBusyId(null)
    }
  }

  const togglePublish = async (e: React.MouseEvent, item: History) => {
    e.stopPropagation()

    const nextPublished = !item.isPublished
    const prev = history
    setBusyId(item.id)

    // ✅ 낙관적 토글
    setHistory((p) =>
      p.map((x) =>
        x.id === item.id
          ? {
              ...x,
              isPublished: nextPublished,
              // 공개로 바꾸면 publishedAt 세팅(화면 정렬/표시 안정)
              publishedAt: nextPublished ? (x.publishedAt || new Date().toISOString()) : null,
            }
          : x
      )
    )

    try {
      // 1) publish/unpublish endpoint가 있으면 우선 사용
      if (nextPublished && typeof historyAPI.publish === 'function') {
        await historyAPI.publish(item.id)
      } else if (!nextPublished && typeof historyAPI.unpublish === 'function') {
        await historyAPI.unpublish(item.id)
      } else {
        // 2) 없으면 update로 폴백(백엔드에서 is_published 지원 시)
        if (typeof historyAPI.update === 'function') {
          await historyAPI.update(item.id, { is_published: nextPublished })
        } else {
          throw new Error('No publish/unpublish/update endpoint found')
        }
      }
    } catch (err) {
      console.error(err)
      alert('상태 변경에 실패했습니다')
      // 롤백
      setHistory(prev)
    } finally {
      setBusyId(null)
    }
  }

  const getCategoryBadge = (category: History['category']) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PROGRAM: { bg: 'bg-blue-100', text: 'text-blue-700', label: '프로그램' },
      EVENT: { bg: 'bg-purple-100', text: 'text-purple-700', label: '행사' },
      NEWS: { bg: 'bg-green-100', text: 'text-green-700', label: '소식' },
      VOLUNTEER: { bg: 'bg-orange-100', text: 'text-orange-700', label: '봉사활동' },
      ARCHIVE: { bg: 'bg-gray-100', text: 'text-gray-700', label: '기타' },
      NOTICE: { bg: 'bg-gray-100', text: 'text-gray-700', label: '공지' },
      MEAL: { bg: 'bg-amber-100', text: 'text-amber-800', label: '식단' },
      FACILITY: { bg: 'bg-slate-100', text: 'text-slate-700', label: '시설' },
      FAMILY: { bg: 'bg-pink-100', text: 'text-pink-700', label: '가족' },
    }
    const badge = badges[category] ?? badges.ARCHIVE
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const filteredHistory = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return history
    return history.filter((item) => (item.title || '').toLowerCase().includes(q))
  }, [history, searchTerm])

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

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHistory.map((item) => {
          const isBusy = busyId === item.id
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => onCardClick(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCardClick(item.id)
              }}
              className={`bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:shadow-lg transition-shadow cursor-pointer ${
                isBusy ? 'opacity-70 pointer-events-none' : ''
              }`}
              title="클릭하면 편집으로 이동"
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

                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{item.excerpt}</p>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {item.tags.slice(0, 3).map((tag, idx) => (
                    <span key={`${tag}-${idx}`} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
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
                  {/* publish toggle */}
                  <button
                    type="button"
                    onClick={(e) => togglePublish(e, item)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors ${
                      item.isPublished
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={item.isPublished ? '비공개로 전환' : '공개로 전환'}
                  >
                    {item.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  {/* edit */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/history/edit/${item.id}`)
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition-colors"
                    title="편집"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* delete */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, item.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

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
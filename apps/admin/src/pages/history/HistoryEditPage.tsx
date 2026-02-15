import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, Hash, X } from 'lucide-react'
import { historyAPI } from '@/api/client'

const HistoryEditPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    category: 'PROGRAM' as 'PROGRAM' | 'EVENT' | 'NEWS' | 'VOLUNTEER',
    content: '',
    excerpt: '',
    tags: [] as string[],
    isPublished: false,
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (isEdit && id) {
      loadHistory(id)
    }
  }, [id])

  const loadHistory = async (historyId: string) => {
    try {
      setLoading(true)
      const response = await historyAPI.get(historyId)
      if (response) {
        setFormData({
          title: response.title,
          category: response.category,
          content: response.content,
          excerpt: response.excerpt,
          tags: response.tags || [],
          isPublished: response.isPublished,
        })
      }
    } catch (error) {
      console.error('Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.content || !formData.excerpt) {
      alert('필수 항목을 모두 입력해주세요')
      return
    }

    try {
      setLoading(true)
      if (isEdit && id) {
        await historyAPI.update(id, formData)
      } else {
        await historyAPI.create(formData)
      }
      navigate('/history')
    } catch (error) {
      alert('저장에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })
  }

  const categories = [
    { value: 'PROGRAM', label: '프로그램', color: 'blue' },
    { value: 'EVENT', label: '행사', color: 'purple' },
    { value: 'NEWS', label: '소식', color: 'green' },
    { value: 'VOLUNTEER', label: '봉사활동', color: 'orange' },
  ]

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          목록으로
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isEdit ? '히스토리 수정' : '새 히스토리 작성'}
        </h1>
        <p className="text-gray-600">
          {isEdit ? '기존 게시물을 수정합니다' : '새로운 게시물을 작성합니다'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="게시물 제목을 입력하세요"
            className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
            required
          />
        </div>

        {/* Category */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-4">
            카테고리 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const isSelected = formData.category === cat.value
              const colors = {
                blue: isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-blue-200 text-blue-600 hover:border-blue-300',
                purple: isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'border-purple-200 text-purple-600 hover:border-purple-300',
                green: isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-green-200 text-green-600 hover:border-green-300',
                orange: isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-orange-200 text-orange-600 hover:border-orange-300',
              }
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value as any })}
                  className={`p-4 rounded-xl border-2 font-bold transition-all ${colors[cat.color as keyof typeof colors]}`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Excerpt */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            요약 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            placeholder="게시물의 간단한 요약 (1-2줄)"
            rows={3}
            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent resize-none"
            required
          />
          <p className="text-sm text-gray-500 mt-2">목록에 표시될 내용입니다</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            본문 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="게시물의 상세 내용을 입력하세요"
            rows={15}
            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent resize-none"
            required
          />
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            태그
          </label>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="태그를 입력하고 Enter"
                className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={addTag}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
            >
              추가
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary-orange/10 text-primary-orange rounded-lg font-semibold"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Publish */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isPublished}
              onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
              className="mt-1 w-5 h-5 text-primary-orange focus:ring-primary-orange rounded"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                {formData.isPublished ? (
                  <>
                    <Eye className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-gray-900">공개</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-5 h-5 text-gray-400" />
                    <span className="font-bold text-gray-900">비공개</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {formData.isPublished ? '웹사이트에 공개됩니다' : '관리자만 볼 수 있습니다'}
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-4 sticky bottom-0 bg-gray-50 p-6 -mx-6 -mb-6 border-t-2 border-gray-100">
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-4 bg-primary-orange text-white rounded-xl font-bold hover:bg-primary-orange/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? '저장 중...' : isEdit ? '수정하기' : '작성하기'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default HistoryEditPage
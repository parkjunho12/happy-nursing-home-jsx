import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, Hash, X } from 'lucide-react'
import { historyAPI } from '@/api/client'

/**
 * ✅ 개선 포인트 요약
 * - admin form은 camelCase, API payload/response는 snake_case로 “명확히 분리”
 * - loadHistory에서 is_published / image_url 안전 매핑
 * - create 시 slug 자동 생성(프론트에서) + 서버가 slug 필수일 때 대응
 * - image_url은 null 대신 undefined로(타입/TS 오류 방지 + field 미전송)
 * - Enter로 태그 추가 시 onKeyDown 사용(React 권장)
 * - 카테고리 타입을 서버 Enum과 맞추기 쉽게 확장 가능
 */

type Category = 'PROGRAM' | 'EVENT' | 'NEWS' | 'VOLUNTEER'

type HistoryForm = {
  title: string
  slug: string // ✅ create에서 필요할 수 있어 폼에서 관리(숨겨도 됨)
  category: Category
  content: string
  excerpt: string
  tags: string[]
  isPublished: boolean
  imageUrl: string
}

type HistoryApiResponse = {
  id: string
  title: string
  slug: string
  category: Category
  content: string
  excerpt: string
  tags?: string[] | null
  is_published?: boolean | null
  published_at?: string | null
  view_count?: number | null
  image_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// 서버에 보낼 payload 타입 (snake_case)
type HistoryApiPayload = {
  title: string
  slug?: string
  category: Category
  content: string
  excerpt: string
  tags: string[]
  is_published: boolean
  image_url?: string
}

// 간단 slug 생성기(라이브러리 없이)
function slugifyKoSafe(input: string) {
  return (
    input
      .trim()
      .toLowerCase()
      // 공백/언더바 -> 하이픈
      .replace(/[\s_]+/g, '-')
      // 한글/영문/숫자/하이픈만 허용 (한글 유지)
      .replace(/[^a-z0-9가-힣-]/g, '')
      // 하이픈 정리
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'post'
  )
}

// form -> api payload
function toApiPayload(form: HistoryForm): HistoryApiPayload {
  const image = form.imageUrl.trim()
  return {
    title: form.title.trim(),
    slug: form.slug.trim() ? form.slug.trim() : undefined,
    category: form.category,
    content: form.content,
    excerpt: form.excerpt,
    tags: form.tags,
    is_published: form.isPublished,
    image_url: image ? image : undefined, // ✅ null 금지. 미전송이 정답.
  }
}

// api response -> form
function toFormData(r: HistoryApiResponse): HistoryForm {
  return {
    title: r.title ?? '',
    slug: r.slug ?? '',
    category: (r.category ?? 'PROGRAM') as Category,
    content: r.content ?? '',
    excerpt: r.excerpt ?? '',
    tags: r.tags ?? [],
    isPublished: r.is_published ?? false, // ✅ snake_case
    imageUrl: r.image_url ?? '',
  }
}

export default function HistoryEditPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const [formData, setFormData] = useState<HistoryForm>({
    title: '',
    slug: '',
    category: 'PROGRAM',
    content: '',
    excerpt: '',
    tags: [],
    isPublished: false,
    imageUrl: '',
  })

  const categories = useMemo(
    () => [
      { value: 'PROGRAM' as const, label: '프로그램', color: 'blue' },
      { value: 'EVENT' as const, label: '행사', color: 'purple' },
      { value: 'NEWS' as const, label: '소식', color: 'green' },
      { value: 'VOLUNTEER' as const, label: '봉사활동', color: 'orange' },
    ],
    []
  )

  // ✅ edit 모드 로드
  useEffect(() => {
    if (!isEdit || !id) return
    ;(async () => {
      try {
        setLoading(true)
        const res: HistoryApiResponse = await historyAPI.get(id)
        if (res) setFormData(toFormData(res))
      } catch (e) {
        console.error('Failed to load:', e)
        alert('불러오기에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isEdit])

  // ✅ title 변경 시 create 모드에서는 slug 자동 업데이트(사용자 수정 가능)
  useEffect(() => {
    if (isEdit) return
    setFormData((prev) => {
      // 사용자가 slug를 직접 입력했다면 존중하고, 비어있을 때만 자동 생성
      if (prev.slug.trim()) return prev
      return { ...prev, slug: slugifyKoSafe(prev.title) }
    })
  }, [formData.title, isEdit])

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (formData.tags.includes(t)) {
      setTagInput('')
      return
    }
    setFormData((p) => ({ ...p, tags: [...p.tags, t] }))
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setFormData((p) => ({ ...p, tags: p.tags.filter((x) => x !== tag) }))
  }

  const validate = () => {
    if (!formData.title.trim()) return '제목을 입력해주세요'
    if (!formData.excerpt.trim()) return '요약을 입력해주세요'
    if (!formData.content.trim()) return '본문을 입력해주세요'
    // slug가 백엔드 필수면 create 시 무조건 보장
    if (!isEdit && !formData.slug.trim()) return '슬러그가 비어있습니다'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) {
      alert(err)
      return
    }

    try {
      setLoading(true)

      // ✅ create 시 slug 보장(백엔드 slug 필수 대응)
      const safeForm: HistoryForm = isEdit
        ? formData
        : {
            ...formData,
            slug: formData.slug.trim() ? formData.slug.trim() : slugifyKoSafe(formData.title),
          }

      const payload = toApiPayload(safeForm)

      if (isEdit && id) {
        await historyAPI.update(id, payload)
      } else {
        await historyAPI.create(payload)
      }

      navigate('/history')
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

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
          type="button"
        >
          <ArrowLeft className="w-5 h-5" />
          목록으로
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isEdit ? '히스토리 수정' : '새 히스토리 작성'}
        </h1>
        <p className="text-gray-600">{isEdit ? '기존 게시물을 수정합니다' : '새로운 게시물을 작성합니다'}</p>
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
            onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            placeholder="게시물 제목을 입력하세요"
            className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
            required
          />
        </div>

        {/* Slug (create에서만 노출/숨김 선택 가능) */}
        {!isEdit && (
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
            <label className="block text-sm font-bold text-gray-900 mb-3">
              슬러그(URL) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
              placeholder="예: health-exercise-program"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
              required
            />
            <p className="text-sm text-gray-500 mt-2">게시글 주소(/history/{'{slug}'})로 사용됩니다.</p>
          </div>
        )}

        {/* Category */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-4">
            카테고리 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const isSelected = formData.category === cat.value
              const colors = {
                blue: isSelected
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-blue-200 text-blue-600 hover:border-blue-300',
                purple: isSelected
                  ? 'bg-purple-500 border-purple-500 text-white'
                  : 'border-purple-200 text-purple-600 hover:border-purple-300',
                green: isSelected
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-green-200 text-green-600 hover:border-green-300',
                orange: isSelected
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-orange-200 text-orange-600 hover:border-orange-300',
              }
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, category: cat.value }))}
                  className={`p-4 rounded-xl border-2 font-bold transition-all ${
                    colors[cat.color as keyof typeof colors]
                  }`}
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
            onChange={(e) => setFormData((p) => ({ ...p, excerpt: e.target.value }))}
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
            onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
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
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image URL */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            대표 이미지 URL
          </label>

          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
            placeholder="https://... (권장: 1200px 이상)"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData((p) => ({ ...p, imageUrl: '' }))}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200"
            >
              이미지 제거
            </button>
            <p className="text-sm text-gray-500">이미지를 넣으면 상세/목록에서 대표 이미지로 표시됩니다.</p>
          </div>

          {/* Preview */}
          {formData.imageUrl.trim() && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">미리보기</p>
              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.imageUrl}
                  alt="대표 이미지 미리보기"
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className="p-4 text-sm text-gray-500">이미지가 안 보이면 URL이 유효한지 확인해주세요.</div>
              </div>
            </div>
          )}
        </div>

        {/* Publish */}
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-100">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isPublished}
              onChange={(e) => setFormData((p) => ({ ...p, isPublished: e.target.checked }))}
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
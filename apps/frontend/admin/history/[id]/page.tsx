'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Eye, Loader, Trash2 } from 'lucide-react'
import { CATEGORY_CONFIG, HistoryCategory } from '@/types/history'

export default function EditHistoryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const isNew = params.id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<HistoryCategory>('NOTICE')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [tags, setTags] = useState('')
  const [author, setAuthor] = useState('관리자')
  const [isPublished, setIsPublished] = useState(false)

  useEffect(() => {
    if (!isNew) {
      fetchPost()
    }
  }, [params.id])

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/history/${params.id}`)
      const data = await res.json()

      if (data.success) {
        const post = data.data.post
        setTitle(post.title)
        setCategory(post.category)
        setContent(post.content)
        setExcerpt(post.excerpt || '')
        setTags(post.tags?.join(', ') || '')
        setAuthor(post.author)
        setIsPublished(post.isPublished)
      }
    } catch (error) {
      setError('게시물을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now()

      const payload = {
        title,
        category,
        content,
        excerpt: excerpt || content.replace(/<[^>]*>/g, '').substring(0, 150),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        author,
        isPublished,
        slug: isNew ? slug : undefined,
      }

      const res = await fetch(
        isNew ? '/api/admin/history' : `/api/admin/history/${params.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await res.json()

      if (data.success) {
        router.push('/admin/history')
        router.refresh()
      } else {
        setError(data.message || '저장에 실패했습니다')
      }
    } catch (error) {
      setError('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/history/${params.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/admin/history')
        router.refresh()
      }
    } catch (error) {
      alert('삭제에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary-orange" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/history')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {isNew ? '새 게시물 작성' : '게시물 수정'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {!isNew && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={saving || !title || !content}
                className="px-6 py-2 bg-primary-orange text-white rounded-lg font-medium hover:bg-primary-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                제목 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="게시물 제목을 입력하세요"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange text-lg font-medium"
                required
              />
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                내용 * (HTML 지원)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="<p>내용을 입력하세요...</p>"
                rows={20}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange font-mono text-sm"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                HTML 태그를 사용할 수 있습니다. 예: &lt;p&gt;, &lt;h2&gt;, &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt;
              </p>
            </div>

            {/* Excerpt */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                요약 (선택사항)
              </label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="게시물 요약을 입력하세요 (비워두면 자동 생성)"
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Publish */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                공개 설정
              </h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary-orange focus:ring-primary-orange"
                />
                <div>
                  <p className="font-medium text-gray-900">공개</p>
                  <p className="text-xs text-gray-500">
                    체크하면 즉시 공개됩니다
                  </p>
                </div>
              </label>
            </div>

            {/* Category */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                카테고리 *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HistoryCategory)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.emoji} {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                태그
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="태그1, 태그2, 태그3"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange"
              />
              <p className="mt-2 text-xs text-gray-500">
                쉼표로 구분하여 입력하세요
              </p>
            </div>

            {/* Author */}
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                작성자
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-orange"
              />
            </div>

            {/* Preview Button */}
            {!isNew && (
              <a
                href={`/history/${title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                미리보기
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
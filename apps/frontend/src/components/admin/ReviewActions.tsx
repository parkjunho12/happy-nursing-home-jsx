'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Star, Shield, Loader } from 'lucide-react'

interface ReviewActionsProps {
  reviewId: string
  currentState: {
    approved: boolean
    featured: boolean
    verified: boolean
  }
}

export default function ReviewActions({ reviewId, currentState }: ReviewActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: string, value: boolean) => {
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [action]: value }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('작업에 실패했습니다')
      }
    } catch (error) {
      alert('오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      alert('삭제에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Approve/Reject */}
      {currentState.approved ? (
        <button
          onClick={() => handleAction('approved', false)}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
          승인 취소
        </button>
      ) : (
        <button
          onClick={() => handleAction('approved', true)}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          승인
        </button>
      )}

      {/* Featured */}
      <button
        onClick={() => handleAction('featured', !currentState.featured)}
        disabled={loading}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          currentState.featured
            ? 'bg-primary-orange/10 text-primary-orange hover:bg-primary-orange/20'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {loading ? (
          <Loader className="w-3 h-3 animate-spin" />
        ) : (
          <Star className="w-3 h-3" />
        )}
        {currentState.featured ? '추천 해제' : '추천'}
      </button>

      {/* Verified */}
      <button
        onClick={() => handleAction('verified', !currentState.verified)}
        disabled={loading}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          currentState.verified
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {loading ? (
          <Loader className="w-3 h-3 animate-spin" />
        ) : (
          <Shield className="w-3 h-3" />
        )}
        {currentState.verified ? '인증 해제' : '인증'}
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader className="w-3 h-3 animate-spin" />
        ) : (
          <X className="w-3 h-3" />
        )}
        삭제
      </button>
    </div>
  )
}
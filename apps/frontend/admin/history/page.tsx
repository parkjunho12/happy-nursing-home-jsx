import React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminLayout from '@/components/admin/AdminLayout'
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { CATEGORY_CONFIG } from '@/types/history'

export default async function AdminHistoryPage() {
  const user = await getSession()
  if (!user) {
    redirect('/admin/login')
  }

  const posts = await prisma.historyPost.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <AdminLayout user={user}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              히스토리 관리
            </h1>
            <p className="text-gray-600">
              총 {posts.length}개의 게시물
            </p>
          </div>
          <Link
            href="/admin/history/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-orange text-white rounded-xl font-semibold hover:bg-primary-orange/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            새 게시물 작성
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    제목
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    카테고리
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                    상태
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                    조회수
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    작성일
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((post) => {
                  const categoryConfig = CATEGORY_CONFIG[post.category]
                  
                  return (
                    <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{categoryConfig.emoji}</span>
                          <div>
                            <p className="font-medium text-gray-900 line-clamp-1">
                              {post.title}
                            </p>
                            <p className="text-sm text-gray-500 line-clamp-1">
                              {post.excerpt}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {categoryConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {post.isPublished ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            <Eye className="w-3 h-3" />
                            공개
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                            <EyeOff className="w-3 h-3" />
                            비공개
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {post.viewCount}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/history/${post.slug}`}
                            target="_blank"
                            className="p-2 text-gray-600 hover:text-primary-orange hover:bg-gray-100 rounded-lg transition-colors"
                            title="미리보기"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/history/${post.id}`}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {posts.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              아직 게시물이 없습니다. 첫 게시물을 작성해보세요!
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
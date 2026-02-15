import React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminLayout from '@/components/admin/AdminLayout'
import { MessageSquare, Clock, CheckCircle, XCircle, Ban } from 'lucide-react'

function ticketFromId(id: string) {
  return id.replace(/-/g, '').slice(0, 10).toUpperCase()
}

export default async function AdminContactsPage() {
  const user = await getSession()
  if (!user) redirect('/admin/login')

  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const stats = {
    total: contacts.length,
    pending: contacts.filter(c => c.status === 'PENDING').length,
    replied: contacts.filter(c => c.status === 'REPLIED').length,
    closed: contacts.filter(c => c.status === 'CLOSED').length,
  }

  return (
    <AdminLayout user={user}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 관리</h1>
          <p className="text-gray-600">총 {stats.total}건의 상담 신청</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
            </div>
            <p className="text-sm text-gray-600">전체</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-yellow-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-2xl font-bold text-yellow-600">{stats.pending}</span>
            </div>
            <p className="text-sm text-gray-600">대기 중</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-green-600">{stats.replied}</span>
            </div>
            <p className="text-sm text-gray-600">답변 완료</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-600" />
              </div>
              <span className="text-2xl font-bold text-gray-600">{stats.closed}</span>
            </div>
            <p className="text-sm text-gray-600">종료</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">티켓번호</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">이름</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">문의 유형</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">문의 내용</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">상태</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">신청일</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {contacts.map((contact) => {
                  const href = `/admin/contacts/${contact.id}`

                  // ✅ "행 전체 클릭 느낌"을 위해 각 td를 Link로 block 처리
                  const CellLink = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
                    <Link href={href} className={`block ${className}`}>
                      {children}
                    </Link>
                  )

                  return (
                    <tr
                      key={contact.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <CellLink>
                          <span className="font-mono text-sm text-gray-600">
                            {ticketFromId(contact.id)}
                          </span>
                        </CellLink>
                      </td>

                      <td className="px-6 py-4">
                        <CellLink>
                          <div>
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            <p className="text-sm text-gray-500">{contact.phone}</p>
                          </div>
                        </CellLink>
                      </td>

                      <td className="px-6 py-4">
                        <CellLink className="text-sm text-gray-700">
                          {contact.inquiryType}
                        </CellLink>
                      </td>

                      <td className="px-6 py-4">
                        <CellLink>
                          <p className="text-sm text-gray-600 line-clamp-2 max-w-md">
                            {contact.message}
                          </p>
                        </CellLink>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <CellLink className="inline-block">
                          {contact.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                              <Clock className="w-3 h-3" />
                              대기
                            </span>
                          )}
                          {contact.status === 'REPLIED' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              답변완료
                            </span>
                          )}
                          {contact.status === 'CLOSED' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                              <XCircle className="w-3 h-3" />
                              종료
                            </span>
                          )}
                          {contact.status === 'SPAM' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                              <Ban className="w-3 h-3" />
                              스팸
                            </span>
                          )}
                        </CellLink>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        <CellLink>
                          {new Date(contact.createdAt).toLocaleDateString('ko-KR')}
                          <br />
                          <span className="text-xs text-gray-400">
                            {new Date(contact.createdAt).toLocaleTimeString('ko-KR')}
                          </span>
                        </CellLink>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {contacts.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              아직 상담 신청이 없습니다
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

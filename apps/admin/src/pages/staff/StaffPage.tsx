import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { staffAPI } from '@/api/client'
import type { Staff } from '@/types'

const StaffPage = () => {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await staffAPI.list()
      setStaff(response || [])
    } catch (error: any) {
      console.error('Failed to load staff:', error)
      setError(error.response?.data?.message || '직원 목록을 불러올 수 없습니다')
      setStaff([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await staffAPI.delete(id)
      loadStaff()
    } catch (error) {
      alert('삭제에 실패했습니다')
    }
  }

  const getStatusBadge = (status: Staff['status']) => {
    return status === 'ACTIVE' ? (
      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
        재직 중
      </span>
    ) : (
      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
        퇴사
      </span>
    )
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      '간호사': 'bg-blue-100 text-blue-700',
      '요양보호사': 'bg-green-100 text-green-700',
      '영양사': 'bg-purple-100 text-purple-700',
      '물리치료사': 'bg-orange-100 text-orange-700',
    }
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[role] || 'bg-gray-100 text-gray-700'}`}>
        {role}
      </span>
    )
  }

  const filteredStaff = staff.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">직원 목록 로딩 중...</p>
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
            onClick={loadStaff}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">직원 관리</h1>
          <p className="text-gray-600">총 {staff.length}명</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors">
          <Plus className="w-5 h-5" />
          직원 추가
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
            placeholder="이름 또는 직책 검색..."
            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  이름
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  직책
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  부서
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  연락처
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  입사일
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                  상태
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      {member.email && <p className="text-sm text-gray-500">{member.email}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(member.role)}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {member.department}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {member.phone}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(member.hireDate).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(member.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStaff.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              {searchTerm ? '검색 결과가 없습니다' : '아직 직원이 없습니다'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StaffPage
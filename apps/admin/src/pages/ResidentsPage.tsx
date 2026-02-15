import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react'
import { residentsAPI } from '@/api/client'
import type { Resident } from '@/types'

const ResidentsPage = () => {
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadResidents()
  }, [])

  const loadResidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await residentsAPI.list()
      setResidents(response || [])
    } catch (error: any) {
      console.error('Failed to load residents:', error)
      setError(error.response?.data?.message || 'Failed to load residents')
      setResidents([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await residentsAPI.delete(id)
      loadResidents()
    } catch (error) {
      alert('삭제에 실패했습니다')
    }
  }

  const getStatusBadge = (status: Resident['status']) => {
    const badges = {
      ACTIVE: 'bg-green-100 text-green-700',
      DISCHARGED: 'bg-gray-100 text-gray-700',
      HOSPITALIZED: 'bg-yellow-100 text-yellow-700',
    }
    const labels = {
      ACTIVE: '입소 중',
      DISCHARGED: '퇴소',
      HOSPITALIZED: '입원',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const filteredResidents = residents.filter((resident) =>
    resident.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resident.roomNumber.includes(searchTerm)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">데이터 로딩 중...</p>
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
            onClick={loadResidents}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">입소자 관리</h1>
          <p className="text-gray-600">총 {residents.length}명</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-primary-orange text-white rounded-lg font-semibold hover:bg-primary-orange/90 transition-colors">
          <Plus className="w-5 h-5" />
          입소자 추가
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
            placeholder="이름 또는 호실 검색..."
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
                  호실
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  등급
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  입소일
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                  상태
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  보호자
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResidents.map((resident) => (
                <tr key={resident.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{resident.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(resident.birthDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{resident.roomNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      {resident.grade}등급
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(resident.admissionDate).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(resident.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {resident.emergencyContact}
                      </p>
                      <p className="text-sm text-gray-500">{resident.emergencyPhone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="상세보기"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(resident.id)}
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

          {filteredResidents.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              {searchTerm ? '검색 결과가 없습니다' : '아직 입소자가 없습니다'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResidentsPage
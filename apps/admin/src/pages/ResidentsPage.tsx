import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  UserPlus,
  Send,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Phone,
  Trash2,
  Upload,
  Edit,
  Plus,
  X,
  AlertCircle,
  Loader2,
  Eye,
  FolderOpen
} from 'lucide-react'
import { residentsAPI, guardiansAPI, photosAPI, messagesAPI } from '@/api/client'
import type { Resident } from '@/types'

// Types
interface Guardian {
  id: string
  resident_id: string
  name: string
  relationship: string
  phone: string
  receive_kakao: boolean
  is_primary: boolean
  created_at: string
  updated_at?: string
}

interface Photo {
  id: string
  resident_id: string
  file_name: string
  file_url: string
  image_url?: string
  uploaded_at: string
}

interface MessageLog {
  id: string
  resident_id: string
  guardian_id: string
  message_content: string
  photo_urls: string[]
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  error_message?: string
  sent_at: string
  resident_name?: string
  guardian_name?: string
  guardian_phone?: string
}

// Message Templates
const MESSAGE_TEMPLATES = {
  daily: {
    title: '오늘의 일상',
    content: '안녕하세요 보호자님, 오늘 어르신께서는 편안한 분위기 속에서 안정적으로 일과를 보내셨습니다. 밝은 표정으로 생활하시는 모습 함께 전달드립니다.'
  },
  meal: {
    title: '식사 소식',
    content: '안녕하세요 보호자님, 오늘 어르신 식사 시간 모습입니다. 식사는 무리 없이 진행되었으며 편안한 상태를 유지하셨습니다.'
  },
  activity: {
    title: '활동 소식',
    content: '안녕하세요 보호자님, 오늘 어르신께서는 가벼운 활동과 일상 프로그램에 참여하셨습니다. 현재 컨디션은 전반적으로 안정적입니다.'
  },
  rehab: {
    title: '재활 소식',
    content: '안녕하세요 보호자님, 오늘 어르신께서는 무리 없는 범위에서 재활 및 신체 활동을 진행하셨습니다. 안전하게 참여하신 모습 전해드립니다.'
  },
  health: {
    title: '건강 상태 안내',
    content: '안녕하세요 보호자님, 금일 어르신 상태는 전반적으로 안정적이며 일상 케어를 무리 없이 진행하였습니다. 관련 모습 함께 전달드립니다.'
  }
}

const ResidentsPage = () => {
  const navigate = useNavigate()
  
  // State
  const [residents, setResidents] = useState<Resident[]>([])
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null)
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedGuardians, setSelectedGuardians] = useState<Set<string>>(new Set())
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [showAddResident, setShowAddResident] = useState(false)
  const [showAddGuardian, setShowAddGuardian] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch residents
  const fetchResidents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await residentsAPI.list()
      setResidents(data || [])
    } catch (err: any) {
      console.error('Failed to fetch residents:', err)
      setError(err.response?.data?.detail || err.message || '입소자 목록을 불러올 수 없습니다')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResidents()
    fetchMessageLogs()
  }, [fetchResidents])

  // 페이지 로드 시 선택된 사진 복원
  useEffect(() => {
    const savedPhotos = sessionStorage.getItem('selectedPhotos')
    if (savedPhotos) {
      try {
        const { residentId, photoIds } = JSON.parse(savedPhotos)
        
        // 현재 선택된 입소자와 일치하는지 확인
        if (selectedResident && selectedResident.id === residentId) {
          setSelectedPhotos(new Set(photoIds))
          setSuccess(`${photoIds.length}장의 사진이 선택되었습니다`)
          setTimeout(() => setSuccess(null), 3000)
        } else if (!selectedResident && residents.length > 0) {
          // 입소자를 자동으로 선택
          const resident = residents.find(r => r.id === residentId)
          if (resident) {
            handleSelectResident(resident)
            setTimeout(() => {
              setSelectedPhotos(new Set(photoIds))
              setSuccess(`${photoIds.length}장의 사진이 선택되었습니다`)
              setTimeout(() => setSuccess(null), 3000)
            }, 100)
          }
        }
        
        // sessionStorage 정리
        sessionStorage.removeItem('selectedPhotos')
      } catch (err) {
        console.error('Failed to restore selected photos:', err)
      }
    }
  }, [selectedResident, residents])

  // Fetch guardians
  const fetchGuardians = async (residentId: string) => {
    try {
      const data = await guardiansAPI.list(residentId)
      setGuardians(data || [])
    } catch (err: any) {
      console.error('Failed to fetch guardians:', err)
      setError(err.response?.data?.detail || '보호자 목록을 불러올 수 없습니다')
      setTimeout(() => setError(null), 3000)
    }
  }

  // Fetch photos
  const fetchPhotos = async (residentId: string) => {
    try {
      const resident = await residentsAPI.get(residentId)
      setPhotos(resident.photos || [])
    } catch (err: any) {
      console.error('Failed to fetch photos:', err)
    }
  }

  // Fetch message logs
  const fetchMessageLogs = async () => {
    try {
      const data = await messagesAPI.logs(undefined, 20)
      setMessageLogs(data || [])
    } catch (err: any) {
      console.error('Failed to fetch logs:', err)
    }
  }

  // Select resident
  const handleSelectResident = (resident: Resident) => {
    setSelectedResident(resident)
    fetchGuardians(resident.id)
    fetchPhotos(resident.id)
    setSelectedGuardians(new Set())
    setSelectedPhotos(new Set())
    setMessage('')
  }

  // 사진 관리 페이지로 이동
  const handleOpenPhotoManager = () => {
    if (!selectedResident) {
      setError('입소자를 먼저 선택해주세요')
      setTimeout(() => setError(null), 3000)
      return
    }

    // 현재 선택된 사진 정보를 sessionStorage에 임시 저장
    if (selectedPhotos.size > 0) {
      sessionStorage.setItem('selectedPhotos', JSON.stringify({
        residentId: selectedResident.id,
        photoIds: Array.from(selectedPhotos),
        photos: photos.filter(p => selectedPhotos.has(p.id))
      }))
    }

    // 사진 관리 페이지로 이동 (입소자 ID와 함께)
    navigate(`/photos?from=resident&residentId=${selectedResident.id}`)
  }

  // Add resident
  const handleAddResident = async (formData: any) => {
    try {
      setLoading(true)
      
      console.log('Adding resident:', formData)
      
      await residentsAPI.create(formData)
      
      setSuccess('입소자가 추가되었습니다')
      setShowAddResident(false)
      
      await fetchResidents()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to add resident:', err)
      console.error('Error response:', err.response?.data)
      
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          '입소자 추가에 실패했습니다'
      
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  // Add guardian
  const handleAddGuardian = async (formData: any) => {
    if (!selectedResident) {
      setError('입소자를 먼저 선택해주세요')
      setTimeout(() => setError(null), 3000)
      return
    }

    try {
      setLoading(true)
      
      console.log('Adding guardian:', formData)
      console.log('Resident ID:', selectedResident.id)
      
      await guardiansAPI.create(selectedResident.id, formData)
      
      setSuccess('보호자가 추가되었습니다')
      setShowAddGuardian(false)
      
      await fetchGuardians(selectedResident.id)
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to add guardian:', err)
      console.error('Error response:', err.response?.data)
      
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          '보호자 추가에 실패했습니다'
      
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  // Delete guardian
  const handleDeleteGuardian = async (guardianId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      setLoading(true)
      await guardiansAPI.delete(guardianId)
      
      setSuccess('보호자가 삭제되었습니다')
      if (selectedResident) {
        fetchGuardians(selectedResident.id)
      }
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to delete guardian:', err)
      setError(err.response?.data?.detail || '보호자 삭제에 실패했습니다')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  // Upload photos
  const handlePhotoUpload = async (files: FileList) => {
    if (!selectedResident) return

    try {
      setLoading(true)
      const fileArray = Array.from(files)
      
      console.log('Uploading photos:', fileArray.length)
      
      await photosAPI.upload(selectedResident.id, fileArray)
      
      setSuccess(`${fileArray.length}장의 사진이 업로드되었습니다`)
      fetchPhotos(selectedResident.id)
      fetchResidents()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to upload photos:', err)
      setError(err.response?.data?.detail || '사진 업로드에 실패했습니다')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  // Delete photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('사진을 삭제하시겠습니까?')) return

    try {
      setLoading(true)
      await photosAPI.delete(photoId)
      
      setSuccess('사진이 삭제되었습니다')
      if (selectedResident) {
        fetchPhotos(selectedResident.id)
      }
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to delete photo:', err)
      setError(err.response?.data?.detail || '사진 삭제에 실패했습니다')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  // Apply template
  const handleApplyTemplate = (templateKey: keyof typeof MESSAGE_TEMPLATES) => {
    const template = MESSAGE_TEMPLATES[templateKey]
    setMessage(template.content)
  }

  // Send message
  const handleSendMessage = async () => {
    if (!selectedResident || selectedGuardians.size === 0 || !message.trim()) {
      setError('입소자, 보호자, 메시지를 모두 선택해주세요')
      setTimeout(() => setError(null), 3000)
      return
    }

    try {
      setLoading(true)
      const photoUrls = Array.from(selectedPhotos)
        .map(photoId => photos.find(p => p.id === photoId)?.file_url)
        .filter((url): url is string => !!url)

      console.log('Sending message:', {
        resident_id: selectedResident.id,
        guardian_ids: Array.from(selectedGuardians),
        photo_urls: photoUrls
      })

      const result = await messagesAPI.send({
        resident_id: selectedResident.id,
        guardian_ids: Array.from(selectedGuardians),
        message_content: message,
        photo_urls: photoUrls
      })

      setSuccess(`${selectedGuardians.size}명의 보호자에게 메시지를 발송했습니다`)
      setSelectedGuardians(new Set())
      setSelectedPhotos(new Set())
      setMessage('')
      fetchMessageLogs()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError(err.response?.data?.detail || '메시지 발송에 실패했습니다')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  // Toggle guardian selection
  const toggleGuardian = (guardianId: string) => {
    const newSet = new Set(selectedGuardians)
    if (newSet.has(guardianId)) {
      newSet.delete(guardianId)
    } else {
      newSet.add(guardianId)
    }
    setSelectedGuardians(newSet)
  }

  // Toggle photo selection
  const togglePhoto = (photoId: string) => {
    const newSet = new Set(selectedPhotos)
    if (newSet.has(photoId)) {
      newSet.delete(photoId)
    } else {
      newSet.add(photoId)
    }
    setSelectedPhotos(newSet)
  }

  // Delete resident
  const handleDeleteResident = async (id: string) => {
    if (!confirm('입소자를 삭제하시겠습니까? 관련된 모든 데이터가 삭제됩니다.')) return

    try {
      setLoading(true)
      await residentsAPI.delete(id)
      
      setSuccess('입소자가 삭제되었습니다')
      fetchResidents()
      if (selectedResident?.id === id) {
        setSelectedResident(null)
      }
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Failed to delete resident:', err)
      setError(err.response?.data?.detail || '입소자 삭제에 실패했습니다')
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: Resident['status']) => {
    const badges = {
      ACTIVE: 'bg-green-100 text-green-700',
      DISCHARGED: 'bg-gray-100 text-gray-700',
      HOSPITALIZED: 'bg-yellow-100 text-yellow-700',
    }
    const labels = {
      ACTIVE: '생활중',
      DISCHARGED: '퇴소',
      HOSPITALIZED: '입원',
    }
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const filteredResidents = residents.filter((resident) =>
    resident.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    resident.room_number.includes(searchQuery)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">입소자 관리</h1>
              <p className="text-sm text-gray-600">보호자 카카오톡 발송 시스템</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 px-4 py-2">
                <div className="text-xs text-blue-600">총 입소자</div>
                <div className="text-xl font-bold text-blue-900">{residents.length}명</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span className="text-sm text-red-800 flex-1">{error}</span>
            <button onClick={() => setError(null)} className="flex-shrink-0">
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
            <span className="text-sm text-green-800 flex-1">{success}</span>
            <button onClick={() => setSuccess(null)} className="flex-shrink-0">
              <X className="h-4 w-4 text-green-600" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        
        {/* Left Panel - Residents List */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">입소자 목록</h2>
            <button
              onClick={() => setShowAddResident(true)}
              disabled={loading}
              className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <UserPlus className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="이름 또는 호실 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Residents */}
          <div className="max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto">
            {filteredResidents.map((resident) => (
              <button
                key={resident.id}
                onClick={() => handleSelectResident(resident)}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  selectedResident?.id === resident.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold text-gray-900">{resident.name}</div>
                  <div className="text-xs text-gray-500">{resident.room_number}</div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>{resident.grade}등급</span>
                  <span>{new Date(resident.birth_date).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {getStatusBadge(resident.status)}
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>보호자 {resident._count?.guardians || 0}</span>
                    <span>사진 {resident._count?.photos || 0}</span>
                  </div>
                </div>
              </button>
            ))}

            {filteredResidents.length === 0 && (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-500">
                  {searchQuery ? '검색 결과가 없습니다' : '등록된 입소자가 없습니다'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Work Area */}
        <div className="space-y-6 lg:col-span-2">
          
          {!selectedResident ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
              <div className="text-center">
                <Users className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">입소자를 선택해주세요</h3>
                <p className="text-sm text-gray-500">좌측 목록에서 입소자를 선택하면 작업을 시작할 수 있습니다</p>
              </div>
            </div>
          ) : (
            <>
              {/* Resident Info */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">{selectedResident.name}</h3>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
                      <Edit className="inline h-4 w-4" /> 수정
                    </button>
                    <button 
                      onClick={() => handleDeleteResident(selectedResident.id)}
                      className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="inline h-4 w-4" /> 삭제
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-gray-500">호실</div>
                    <div className="font-medium text-gray-900">{selectedResident.room_number}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">등급</div>
                    <div className="font-medium text-gray-900">{selectedResident.grade}등급</div>
                  </div>
                  <div>
                    <div className="text-gray-500">입소일</div>
                    <div className="font-medium text-gray-900">
                      {new Date(selectedResident.admission_date).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">상태</div>
                    <div className="font-medium text-gray-900">{getStatusBadge(selectedResident.status)}</div>
                  </div>
                </div>
                {selectedResident.notes && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    {selectedResident.notes}
                  </div>
                )}
              </div>

              {/* Guardians */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">보호자 ({guardians.length}명)</h3>
                  <button
                    onClick={() => setShowAddGuardian(true)}
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus className="inline h-4 w-4" /> 추가
                  </button>
                </div>

                <div className="space-y-2">
                  {guardians.map((guardian) => (
                    <div
                      key={guardian.id}
                      className={`flex items-center justify-between rounded-lg border-2 p-4 transition-all ${
                        selectedGuardians.has(guardian.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedGuardians.has(guardian.id)}
                          onChange={() => toggleGuardian(guardian.id)}
                          disabled={!guardian.receive_kakao}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{guardian.name}</span>
                            <span className="text-xs text-gray-500">({guardian.relationship})</span>
                            {guardian.is_primary && (
                              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                주
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{guardian.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!guardian.receive_kakao && (
                          <span className="text-xs text-red-600">수신거부</span>
                        )}
                        <button
                          onClick={() => handleDeleteGuardian(guardian.id)}
                          className="p-1 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {guardians.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-500">
                      등록된 보호자가 없습니다
                    </div>
                  )}
                </div>

                {selectedGuardians.size > 0 && (
                  <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                    {selectedGuardians.size}명의 보호자에게 발송됩니다
                  </div>
                )}
              </div>

              {/* Photos - 개선된 버전 */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">사진 ({photos.length}장)</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenPhotoManager}
                      className="rounded-lg border-2 border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <FolderOpen className="inline h-4 w-4 mr-1" />
                      사진 관리
                    </button>
                    <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      <Upload className="inline h-4 w-4 mr-1" />
                      빠른 업로드
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)}
                        className="hidden"
                        disabled={loading}
                      />
                    </label>
                  </div>
                </div>

                {/* 선택된 사진 미리보기 */}
                {selectedPhotos.size > 0 && (
                  <div className="mb-4 rounded-lg bg-blue-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedPhotos.size}장 선택됨
                      </span>
                      <button
                        onClick={() => setSelectedPhotos(new Set())}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        선택 해제
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                      {Array.from(selectedPhotos).slice(0, 10).map(photoId => {
                        const photo = photos.find(p => p.id === photoId)
                        return photo ? (
                          <img
                            key={photoId}
                            src={photo.image_url || photo.file_url}
                            alt=""
                            className="h-20 w-20 flex-shrink-0 rounded object-cover"
                          />
                        ) : null
                      })}
                      {selectedPhotos.size > 10 && (
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-xs text-gray-600">
                          +{selectedPhotos.size - 10}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 사진 그리드 - 최대 6개만 표시 */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.slice(0, 6).map((photo) => (
                    <div
                      key={photo.id}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                        selectedPhotos.has(photo.id)
                          ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div 
                        onClick={() => togglePhoto(photo.id)}
                        className="cursor-pointer"
                      >
                        <img
                          src={photo.image_url || photo.file_url}
                          alt={photo.file_name}
                          className="aspect-square w-full object-cover"
                        />
                        {selectedPhotos.has(photo.id) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                            <CheckCircle className="h-8 w-8 text-blue-600" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePhoto(photo.id)
                        }}
                        className="absolute right-2 top-2 rounded-full bg-red-500 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                        title="삭제"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                {photos.length === 0 && (
                  <div className="py-12 text-center">
                    <ImageIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                    <p className="mb-2 text-sm text-gray-500">업로드된 사진이 없습니다</p>
                    <button
                      onClick={handleOpenPhotoManager}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      사진 관리 페이지에서 업로드하기 →
                    </button>
                  </div>
                )}

                {photos.length > 6 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={handleOpenPhotoManager}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      +{photos.length - 6}장 더보기 →
                    </button>
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-lg font-bold text-gray-900">메시지 작성</h3>

                {/* Templates */}
                <div className="mb-4">
                  <div className="mb-2 text-sm font-medium text-gray-700">템플릿</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MESSAGE_TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        onClick={() => handleApplyTemplate(key as keyof typeof MESSAGE_TEMPLATES)}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:border-blue-500 hover:bg-blue-50"
                      >
                        {template.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 p-4 focus:border-blue-500 focus:outline-none"
                />

                <div className="mt-2 text-right text-xs text-gray-500">
                  {message.length}자
                </div>

                {/* Preview */}
                {message && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-2 text-xs font-semibold text-gray-500">미리보기</div>
                    <div className="whitespace-pre-wrap text-sm text-gray-700">{message}</div>
                    {selectedPhotos.size > 0 && (
                      <div className="mt-3 flex gap-2">
                        {Array.from(selectedPhotos).slice(0, 3).map(photoId => {
                          const photo = photos.find(p => p.id === photoId)
                          return photo ? (
                            <img
                              key={photoId}
                              src={photo.image_url || photo.file_url}
                              alt=""
                              className="h-16 w-16 rounded object-cover"
                            />
                          ) : null
                        })}
                        {selectedPhotos.size > 3 && (
                          <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-200 text-xs text-gray-600">
                            +{selectedPhotos.size - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={loading || selectedGuardians.size === 0 || !message.trim()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      {selectedGuardians.size > 0 
                        ? `${selectedGuardians.size}명에게 카카오톡 발송` 
                        : '보호자를 선택하세요'}
                    </>
                  )}
                </button>
              </div>

              {/* Recent Logs */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-lg font-bold text-gray-900">최근 발송 내역</h3>
                
                <div className="space-y-2">
                  {messageLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{log.resident_name}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-700">{log.guardian_name}</span>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                          log.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {log.status === 'SUCCESS' ? '성공' :
                           log.status === 'FAILED' ? '실패' : '대기'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.sent_at).toLocaleString('ko-KR')}
                      </div>
                      {log.photo_urls && log.photo_urls.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          📷 {log.photo_urls.length}장 첨부
                        </div>
                      )}
                      {log.error_message && (
                        <div className="mt-2 text-xs text-red-600">
                          오류: {log.error_message}
                        </div>
                      )}
                    </div>
                  ))}

                  {messageLogs.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-500">
                      발송 내역이 없습니다
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddResident && (
        <AddResidentModal 
          onClose={() => setShowAddResident(false)} 
          onAdd={handleAddResident}
          loading={loading}
        />
      )}

      {showAddGuardian && selectedResident && (
        <AddGuardianModal 
          onClose={() => setShowAddGuardian(false)} 
          onAdd={handleAddGuardian}
          loading={loading}
        />
      )}
    </div>
  )
}

// Add Resident Modal
interface AddResidentModalProps {
  onClose: () => void
  onAdd: (data: any) => void
  loading: boolean
}

function AddResidentModal({ onClose, onAdd, loading }: AddResidentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    admission_date: '',
    room_number: '',
    grade: '1',
    emergency_contact: '',
    emergency_phone: '',
    status: 'ACTIVE' as 'ACTIVE' | 'DISCHARGED' | 'HOSPITALIZED',
    notes: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('이름을 입력해주세요')
      return
    }
    
    if (!formData.birth_date) {
      alert('생년월일을 입력해주세요')
      return
    }
    
    if (!formData.admission_date) {
      alert('입소일을 입력해주세요')
      return
    }
    
    if (!formData.room_number.trim()) {
      alert('호실을 입력해주세요')
      return
    }
    
    if (!formData.emergency_contact.trim()) {
      alert('비상 연락처 이름을 입력해주세요')
      return
    }
    
    if (!formData.emergency_phone.trim()) {
      alert('비상 연락처 전화번호를 입력해주세요')
      return
    }
    
    console.log('Submitting resident data:', formData)
    onAdd(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8">
        <h3 className="mb-4 text-xl font-bold text-gray-900">입소자 추가</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                placeholder="홍길동"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                성별 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                입소일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.admission_date}
                onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                호실 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                placeholder="101"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                등급 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="1">1등급</option>
                <option value="2">2등급</option>
                <option value="3">3등급</option>
                <option value="4">4등급</option>
                <option value="5">5등급</option>
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                비상 연락처 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                placeholder="홍철수"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                비상 연락처 전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                maxLength={40}
                value={formData.emergency_phone}
                onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
                placeholder="010-1234-5678"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                상태 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'DISCHARGED' | 'HOSPITALIZED' })}
                className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="ACTIVE">생활중</option>
                <option value="HOSPITALIZED">입원</option>
                <option value="DISCHARGED">퇴소</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">메모</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              placeholder="특이사항이나 주의사항을 입력하세요"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Add Guardian Modal
interface AddGuardianModalProps {
  onClose: () => void
  onAdd: (data: any) => void
  loading: boolean
}

function AddGuardianModal({ onClose, onAdd, loading }: AddGuardianModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    relationship: '아들',
    phone: '',
    receive_kakao: true,
    is_primary: false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('이름을 입력해주세요')
      return
    }
    
    if (!formData.phone.trim()) {
      alert('전화번호를 입력해주세요')
      return
    }
    
    console.log('Submitting guardian data:', formData)
    onAdd(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-xl font-bold text-gray-900">보호자 추가</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
              placeholder="홍철수"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">관계</label>
            <select
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="아들">아들</option>
              <option value="딸">딸</option>
              <option value="배우자">배우자</option>
              <option value="며느리">며느리</option>
              <option value="사위">사위</option>
              <option value="손자">손자</option>
              <option value="손녀">손녀</option>
              <option value="형제">형제</option>
              <option value="자매">자매</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="010-1234-5678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="receiveKakao"
              checked={formData.receive_kakao}
              onChange={(e) => setFormData({ ...formData, receive_kakao: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="receiveKakao" className="text-sm text-gray-700">
              카카오톡 수신 동의
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={formData.is_primary}
              onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isPrimary" className="text-sm text-gray-700">
              주 보호자로 설정
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResidentsPage
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Image as ImageIcon,
  Upload,
  Calendar,
  Download,
  Trash2,
  X,
  CheckCircle,
  Send,
  FolderOpen,
  Grid3x3,
  Search,
  Eye,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Check,
} from 'lucide-react'
import { residentsAPI, photosAPI, messagesAPI } from '@/api/client'
import type { Resident } from '@/types'

interface Photo {
  id: string
  resident_id: string
  file_name: string
  file_url: string
  uploaded_at: string
  is_sent?: boolean
  sent_count?: number
  tags?: string[]
}

interface MessageLog {
  photo_urls?: string[]
}

interface PhotoGroup {
  key: string
  year: number
  week: number
  yearLabel: string
  monthLabel: string
  weekLabel: string
  photos: Photo[]
}

type ViewMode = 'grid' | 'timeline'
type FilterMode = 'all' | 'sent' | 'unsent'
type ToastType = 'error' | 'success'

const TOAST_TIMEOUT = 3000

function getWeekNumber(date: Date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear =
    (date.getTime() - firstDayOfYear.getTime()) / 86400000

  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

function buildPhotoGroups(photos: Photo[]): PhotoGroup[] {
  const grouped = photos.reduce((acc, photo) => {
    const date = new Date(photo.uploaded_at)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const week = getWeekNumber(date)
    const key = `${year}-W${week}`

    if (!acc[key]) {
      acc[key] = {
        key,
        year,
        week,
        yearLabel: `${year}년`,
        monthLabel: `${month}월`,
        weekLabel: `${week}주차`,
        photos: [],
      }
    }

    acc[key].photos.push(photo)
    return acc
  }, {} as Record<string, PhotoGroup>)

  return Object.values(grouped).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.week - a.week
  })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

function getResidentPhotoCount(resident: Resident) {
  const countFromMeta =
    (resident as Resident & { _count?: { photos?: number } })._count?.photos
  const countFromPhotos = (resident as Resident & { photos?: Photo[] }).photos?.length

  return countFromMeta ?? countFromPhotos ?? 0
}

const PhotosPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const fromResident = searchParams.get('from') === 'resident'
  const residentIdFromQuery = searchParams.get('residentId')

  const [residents, setResidents] = useState<Resident[]>([])
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  const [residentsLoading, setResidentsLoading] = useState(false)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const toastTimerRef = useRef<number | null>(null)
  const hasAutoSelectedRef = useRef(false)

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
  }, [])

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      clearToastTimer()

      if (type === 'error') {
        setSuccess(null)
        setError(message)
      } else {
        setError(null)
        setSuccess(message)
      }

      toastTimerRef.current = window.setTimeout(() => {
        setError(null)
        setSuccess(null)
        toastTimerRef.current = null
      }, TOAST_TIMEOUT)
    },
    [clearToastTimer]
  )

  useEffect(() => {
    return () => {
      clearToastTimer()
    }
  }, [clearToastTimer])

  const fetchResidents = useCallback(async () => {
    try {
      setResidentsLoading(true)
      setError(null)

      const data = await residentsAPI.list()
      setResidents(data || [])
    } catch (err) {
      console.error('Failed to fetch residents:', err)
      showToast('error', '입소자 목록을 불러올 수 없습니다')
    } finally {
      setResidentsLoading(false)
    }
  }, [showToast])

  const fetchPhotos = useCallback(
    async (residentId: string) => {
      try {
        setPhotosLoading(true)
        setError(null)

        const [resident, logs] = await Promise.all([
          residentsAPI.get(residentId),
          messagesAPI.logs(residentId, 100),
        ])

        const typedResident = resident as Resident & { photos?: Photo[] }
        const typedLogs = (logs || []) as MessageLog[]
        const photosData = typedResident.photos || []

        const sentCountMap = new Map<string, number>()

        for (const log of typedLogs) {
          for (const url of log.photo_urls || []) {
            sentCountMap.set(url, (sentCountMap.get(url) || 0) + 1)
          }
        }

        const photosWithStatus: Photo[] = photosData.map((photo) => {
          const sentCount = sentCountMap.get(photo.file_url) || 0
          return {
            ...photo,
            is_sent: sentCount > 0,
            sent_count: sentCount,
          }
        })

        setPhotos(photosWithStatus)
      } catch (err) {
        console.error('Failed to fetch photos:', err)
        setPhotos([])
        showToast('error', '사진 목록을 불러올 수 없습니다')
      } finally {
        setPhotosLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    void fetchResidents()
  }, [fetchResidents])

  const handleSelectResident = useCallback(
    async (resident: Resident) => {
      setSelectedResident(resident)
      setSelectedPhotos(new Set())
      setSelectedPhoto(null)
      await fetchPhotos(resident.id)
    },
    [fetchPhotos]
  )

  useEffect(() => {
    if (!residentIdFromQuery || residents.length === 0 || hasAutoSelectedRef.current) {
      return
    }

    const foundResident = residents.find((resident) => resident.id === residentIdFromQuery)
    if (!foundResident) return

    hasAutoSelectedRef.current = true
    void handleSelectResident(foundResident)
  }, [residentIdFromQuery, residents, handleSelectResident])

  const uploadPhotos = useCallback(
    async (files: FileList, imageOnly = false) => {
      if (!selectedResident) {
        showToast('error', '입소자를 먼저 선택해주세요')
        return
      }

      try {
        setUploading(true)
        setError(null)

        let fileArray = Array.from(files)

        if (imageOnly) {
          fileArray = fileArray.filter((file) => file.type.startsWith('image/'))
        }

        if (fileArray.length === 0) {
          showToast('error', '업로드할 이미지 파일이 없습니다')
          return
        }

        await photosAPI.upload(selectedResident.id, fileArray)

        showToast('success', `${fileArray.length}장의 사진이 업로드되었습니다`)

        await Promise.all([
          fetchPhotos(selectedResident.id),
          fetchResidents(),
        ])
      } catch (err: any) {
        console.error('Failed to upload photos:', err)
        showToast(
          'error',
          err?.response?.data?.detail || '사진 업로드에 실패했습니다'
        )
      } finally {
        setUploading(false)
      }
    },
    [selectedResident, fetchPhotos, fetchResidents, showToast]
  )

  const handleDeleteSelected = useCallback(async () => {
    if (selectedPhotos.size === 0 || !selectedResident) return

    const confirmed = window.confirm(
      `${selectedPhotos.size}장의 사진을 삭제하시겠습니까?`
    )
    if (!confirmed) return

    try {
      setDeleteLoading(true)
      setError(null)

      await Promise.all(
        Array.from(selectedPhotos).map((photoId) => photosAPI.delete(photoId))
      )

      setSelectedPhotos(new Set())
      showToast('success', `${selectedPhotos.size}장의 사진이 삭제되었습니다`)

      await Promise.all([
        fetchPhotos(selectedResident.id),
        fetchResidents(),
      ])
    } catch (err) {
      console.error('Failed to delete photos:', err)
      showToast('error', '사진 삭제에 실패했습니다')
    } finally {
      setDeleteLoading(false)
    }
  }, [selectedPhotos, selectedResident, fetchPhotos, fetchResidents, showToast])

  const handleConfirmSelection = useCallback(() => {
    if (!selectedResident || selectedPhotos.size === 0) {
      showToast('error', '사진을 선택해주세요')
      return
    }

    const selectedPhotoList = photos.filter((photo) => selectedPhotos.has(photo.id))

    sessionStorage.setItem(
      'selectedPhotos',
      JSON.stringify({
        residentId: selectedResident.id,
        photoIds: Array.from(selectedPhotos),
        photos: selectedPhotoList,
      })
    )

    navigate('/residents')
  }, [selectedResident, selectedPhotos, photos, navigate, showToast])

  const togglePhoto = useCallback((photoId: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }, [])

  const selectAllInGroup = useCallback((groupPhotos: Photo[]) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev)
      groupPhotos.forEach((photo) => next.add(photo.id))
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPhotos(new Set())
  }, [])

  const filteredPhotos = useMemo(() => {
    let filtered = photos

    if (filterMode === 'sent') {
      filtered = filtered.filter((photo) => photo.is_sent)
    } else if (filterMode === 'unsent') {
      filtered = filtered.filter((photo) => !photo.is_sent)
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.trim().toLowerCase()
      filtered = filtered.filter((photo) =>
        photo.file_name.toLowerCase().includes(lowerQuery)
      )
    }

    return filtered
  }, [photos, filterMode, searchQuery])

  const groupedFilteredPhotos = useMemo(() => {
    return buildPhotoGroups(filteredPhotos)
  }, [filteredPhotos])

  const isBusy = residentsLoading || photosLoading || uploading || deleteLoading

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {fromResident && (
                <button
                  onClick={() => navigate('/residents')}
                  className="rounded-lg p-2 hover:bg-gray-100"
                  aria-label="뒤로 가기"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}

              <div>
                <h1 className="text-2xl font-bold text-gray-900">사진 관리</h1>
                <p className="text-sm text-gray-600">
                  {fromResident
                    ? '사진을 선택하고 돌아가기'
                    : '입소자별 사진 업로드 및 관리'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {fromResident && selectedPhotos.size > 0 && (
                <button
                  onClick={handleConfirmSelection}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
                >
                  <Check className="h-5 w-5" />
                  {selectedPhotos.size}장 선택 완료
                </button>
              )}

              {selectedResident && (
                <div className="rounded-lg bg-blue-50 px-4 py-2">
                  <div className="text-xs text-blue-600">총 사진</div>
                  <div className="text-xl font-bold text-blue-900">
                    {photos.length}장
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span className="flex-1 text-sm text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0"
              aria-label="에러 메시지 닫기"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
            <span className="flex-1 text-sm text-green-800">{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="flex-shrink-0"
              aria-label="성공 메시지 닫기"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 p-6 lg:grid-cols-4">
        <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">입소자 선택</h2>
            {residentsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </div>

          <div className="max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto">
            {residents.length > 0 ? (
              residents.map((resident) => (
                <button
                  key={resident.id}
                  onClick={() => void handleSelectResident(resident)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                    selectedResident?.id === resident.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="mb-1 font-semibold text-gray-900">
                    {resident.name}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{resident.room_number || '-'}</span>
                    <span>사진 {getResidentPhotoCount(resident)}장</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                {residentsLoading
                  ? '입소자 목록을 불러오는 중입니다...'
                  : '등록된 입소자가 없습니다'}
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-6 lg:col-span-3">
          {!selectedResident ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
              <div className="text-center">
                <ImageIcon className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  입소자를 선택해주세요
                </h3>
                <p className="text-sm text-gray-500">
                  좌측에서 입소자를 선택하면 사진을 관리할 수 있습니다
                </p>
              </div>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                  <>
                        <label
                          className={`cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
                            uploading ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          <Upload className="mr-1 inline h-4 w-4" />
                          파일 업로드
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files) {
                                void uploadPhotos(e.target.files, false)
                                e.currentTarget.value = ''
                              }
                            }}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>

                        <label
                          className={`cursor-pointer rounded-lg border-2 border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 ${
                            uploading ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          <FolderOpen className="mr-1 inline h-4 w-4" />
                          폴더 업로드
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            // @ts-expect-error browser-specific attribute
                            webkitdirectory=""
                            directory=""
                            onChange={(e) => {
                              if (e.target.files) {
                                void uploadPhotos(e.target.files, true)
                                e.currentTarget.value = ''
                              }
                            }}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      </>

                    {selectedPhotos.size > 0 && (
                      <>
                        <button
                          onClick={clearSelection}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          disabled={deleteLoading}
                        >
                          선택 해제
                        </button>

                        {!fromResident && (
                          <button
                            onClick={() => void handleDeleteSelected()}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={deleteLoading}
                          >
                            {deleteLoading ? (
                              <>
                                <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                                삭제 중...
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-1 inline h-4 w-4" />
                                {selectedPhotos.size}장 삭제
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="파일명 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-48 rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <select
                      value={filterMode}
                      onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">전체</option>
                      <option value="sent">발송됨</option>
                      <option value="unsent">미발송</option>
                    </select>

                    <div className="flex overflow-hidden rounded-lg border border-gray-300">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-2 ${
                          viewMode === 'grid'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                        aria-label="그리드 보기"
                      >
                        <Grid3x3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('timeline')}
                        className={`border-l px-3 py-2 ${
                          viewMode === 'timeline'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                        aria-label="타임라인 보기"
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {(uploading || photosLoading) && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {uploading
                        ? '업로드 중입니다...'
                        : '사진 목록을 불러오는 중입니다...'}
                    </span>
                  </div>
                )}
              </section>

              {viewMode === 'grid' && (
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
                  {filteredPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {filteredPhotos.map((photo) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          selected={selectedPhotos.has(photo.id)}
                          onToggle={() => togglePhoto(photo.id)}
                          onPreview={() => setSelectedPhoto(photo)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={
                        searchQuery || filterMode !== 'all'
                          ? '검색 결과가 없습니다'
                          : '업로드된 사진이 없습니다'
                      }
                    />
                  )}
                </section>
              )}

              {viewMode === 'timeline' && (
                <section className="space-y-6">
                  {groupedFilteredPhotos.length > 0 ? (
                    groupedFilteredPhotos.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg"
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {group.yearLabel} {group.monthLabel} {group.weekLabel}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {group.photos.length}장
                            </p>
                          </div>

                          <button
                            onClick={() => selectAllInGroup(group.photos)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            전체 선택
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                          {group.photos.map((photo) => (
                            <PhotoCard
                              key={photo.id}
                              photo={photo}
                              selected={selectedPhotos.has(photo.id)}
                              onToggle={() => togglePhoto(photo.id)}
                              onPreview={() => setSelectedPhoto(photo)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-12">
                      <EmptyState title="업로드된 사진이 없습니다" />
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {isBusy && uploading && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          업로드 중...
        </div>
      )}

      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  )
}

interface PhotoCardProps {
  photo: Photo
  selected: boolean
  onToggle: () => void
  onPreview: () => void
}

function PhotoCard({ photo, selected, onToggle, onPreview }: PhotoCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2'
          : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="block w-full cursor-pointer text-left"
        aria-pressed={selected}
      >
        <img
          src={photo.image_url}
          alt={photo.file_name}
          loading="lazy"
          className="aspect-square w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/0 transition-all group-hover:bg-black/40">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPreview()
              }}
              className="rounded-full bg-white p-2 shadow-lg"
              aria-label="사진 크게 보기"
            >
              <Eye className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>

        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
            <CheckCircle className="h-8 w-8 text-blue-600" />
          </div>
        )}

        {photo.is_sent && (
          <div className="absolute right-2 top-2 rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white shadow">
            <Send className="mr-1 inline h-3 w-3" />
            {photo.sent_count || 0}회
          </div>
        )}
      </button>
    </div>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="py-12 text-center">
      <ImageIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  )
}

interface PhotoDetailModalProps {
  photo: Photo
  onClose: () => void
}

function PhotoDetailModal({ photo, onClose }: PhotoDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="사진 상세 보기"
    >
      <div
        className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow-lg hover:bg-gray-100"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        <img
          src={photo.file_url}
          alt={photo.file_name}
          className="w-full"
        />

        <div className="p-6">
          <h3 className="mb-4 text-xl font-bold text-gray-900">사진 정보</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">파일명:</span>
              <span className="break-all text-right font-medium text-gray-900">
                {photo.file_name}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">업로드 일시:</span>
              <span className="text-right font-medium text-gray-900">
                {formatDateTime(photo.uploaded_at)}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">발송 상태:</span>
              <span
                className={`text-right font-medium ${
                  photo.is_sent ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {photo.is_sent ? `${photo.sent_count || 0}회 발송됨` : '미발송'}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <a
              href={photo.file_url}
              download={photo.file_name}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download className="mr-1 inline h-4 w-4" />
              다운로드
            </a>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotosPage
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, Upload, X, Eye, EyeOff, ImagePlus,
  Users, Folder, Play, Image, Search, ChevronDown,
  Loader2, AlertCircle, RefreshCw, Edit2,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import { adminAlbumAPI } from '@/api/albumClient'
import { canManageFamilyAccounts } from '@/utils/role'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const PAGE_SIZE = 12

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface Album {
  id: string; title: string; description: string
  cover_url: string | null; is_public: boolean
  media_count: number; resident_name: string
  resident_id: string; created_at: string
}
interface Media {
  id: string; media_type: 'photo' | 'video'
  file_url: string; thumbnail_url: string | null
  file_name: string; created_at: string
}
interface Guardian {
  id: string; name: string; phone: string; is_active: boolean
  residents: { id: string; name: string; relation: string }[]
}

type ModalType = 'none' | 'createAlbum' | 'uploadMedia' | 'viewMedia' | 'createGuardian'

const mediaUrl = (url: string) =>
  url.startsWith('http') ? url : `${API_BASE}${url}`

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function EvalAlbumPage() {
  const { residents, loaded, loadAll } = useLtcStore()
  const { user } = useAuthStore()
  const canManage = canManageFamilyAccounts(user)

  // 데이터
  const [albums,    setAlbums]    = useState<Album[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [media,     setMedia]     = useState<Media[]>([])

  // UI 상태
  const [selAlbum,  setSelAlbum]  = useState<Album | null>(null)
  const [selMedia,  setSelMedia]  = useState<Media | null>(null)
  const [modal,     setModal]     = useState<ModalType>('none')
  const [tab,       setTab]       = useState<'albums' | 'guardians'>('albums')

  // 요양보호사는 guardians 탭 접근 불가 — 강제로 albums로 돌려보냄
  useEffect(() => {
    if (!canManage && tab === 'guardians') setTab('albums')
  }, [canManage, tab])
  const [uploading, setUploading] = useState(false)
  const [albumsLoading, setAlbumsLoading] = useState(false)
  const [albumsError,   setAlbumsError]   = useState('')
  const [editAlbum,    setEditAlbum]    = useState<Album | null>(null)
  const [editGuardian, setEditGuardian] = useState<Guardian | null>(null)

  // 필터 / 검색
  const [filterRes,    setFilterRes]    = useState('')       // 수급자 ID
  const [resSearch,    setResSearch]    = useState('')       // 드롭다운 내 검색
  const [resDropOpen,  setResDropOpen]  = useState(false)
  const [albumSearch,  setAlbumSearch]  = useState('')       // 앨범 검색
  const [guardianSearch, setGuardianSearch] = useState('')   // 보호자 검색

  // 페이지네이션
  const [page, setPage] = useState(1)

  const fileRef   = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])
  useEffect(() => { fetchAlbums(); fetchGuardians() }, [])

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setResDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // filterRes 변경 시 앨범 재조회
  useEffect(() => {
    fetchAlbums()
    setPage(1)
    setAlbumSearch('')
  }, [filterRes])

  const fetchAlbums = async () => {
    setAlbumsLoading(true); setAlbumsError('')
    try {
      const data = await adminAlbumAPI.listAlbums(filterRes || undefined)
      setAlbums(data)
    } catch {
      setAlbumsError('앨범을 불러오지 못했습니다')
    } finally { setAlbumsLoading(false) }
  }

  const fetchGuardians = async () => {
    try { setGuardians(await adminAlbumAPI.listGuardians()) } catch {}
  }

  const fetchMedia = async (albumId: string) => {
    try { setMedia(await adminAlbumAPI.listMedia(albumId)) } catch {}
  }

  const openAlbum = async (album: Album) => {
    setSelAlbum(album)
    await fetchMedia(album.id)
    setModal('uploadMedia')
  }

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || !selAlbum) return
    setUploading(true)
    try {
      await adminAlbumAPI.uploadMedia(selAlbum.id, Array.from(files))
      await fetchMedia(selAlbum.id)
      await fetchAlbums()
    } finally { setUploading(false) }
  }, [selAlbum])

  const togglePublic = async (album: Album) => {
    const form = new FormData()
    form.append('is_public', String(!album.is_public))
    await adminAlbumAPI.updateAlbum(album.id, form)
    fetchAlbums()
  }

  const deleteAlbum = async (id: string) => {
    if (!confirm('앨범을 삭제하시겠습니까? 사진/영상도 모두 삭제됩니다.')) return
    await adminAlbumAPI.deleteAlbum(id)
    fetchAlbums()
    if (selAlbum?.id === id) { setSelAlbum(null); setModal('none') }
  }

  const deleteMedia = async (mediaId: string) => {
    if (!selAlbum) return
    await adminAlbumAPI.deleteMedia(selAlbum.id, mediaId)
    await fetchMedia(selAlbum.id)
    await fetchAlbums()
  }

  const activeResidents = residents.filter(r => r.status === 'active')
  const selectedResident = activeResidents.find(r => r.id === filterRes)

  // 수급자 드롭다운 필터링
  const filteredResidents = useMemo(() =>
    activeResidents.filter(r =>
      !resSearch || r.name.includes(resSearch)
    ), [activeResidents, resSearch])

  // 앨범 프론트 검색
  const searchedAlbums = useMemo(() => {
    if (!albumSearch.trim()) return albums
    const q = albumSearch.toLowerCase()
    return albums.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.resident_name.toLowerCase().includes(q) ||
      (a.description?.toLowerCase().includes(q))
    )
  }, [albums, albumSearch])

  // 페이지네이션
  const pagedAlbums  = searchedAlbums.slice(0, page * PAGE_SIZE)
  const hasMore      = page * PAGE_SIZE < searchedAlbums.length

  // 보호자 검색
  const filteredGuardians = useMemo(() => {
    if (!guardianSearch.trim()) return guardians
    const q = guardianSearch.toLowerCase()
    return guardians.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.phone.includes(q) ||
      g.residents.some(r => r.name.toLowerCase().includes(q))
    )
  }, [guardians, guardianSearch])

  const overview = useMemo(() => ({
    total: albums.length,
    publicCount: albums.filter(a => a.is_public).length,
    privateCount: albums.filter(a => !a.is_public).length,
    photos: albums.reduce((sum, a) => sum + (a.media_count || 0), 0),
    guardians: guardians.length,
  }), [albums, guardians])

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">보호자 앨범 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {canManage
              ? '어르신 사진 공유와 보호자 계정을 함께 관리합니다.'
              : '어르신 사진을 보호자님께 공유할 수 있습니다.'}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'albums' && (
            <button onClick={() => setModal('createAlbum')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-primary-orange text-white text-sm font-semibold px-4 py-3 sm:py-2 rounded-xl hover:bg-primary-orange/90 shadow-sm">
              <Plus size={15}/> 앨범 만들기
            </button>
          )}
          {canManage && tab === 'guardians' && (
            <button onClick={() => setModal('createGuardian')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-teal-600 text-white text-sm font-semibold px-4 py-3 sm:py-2 rounded-xl hover:bg-teal-700 shadow-sm">
              <Plus size={15}/> 보호자 추가
            </button>
          )}
        </div>
      </div>

      {/* 탭 — 요양보호사는 앨범만, 그 외 2개 탭 */}
      {canManage && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['albums', 'guardians'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'albums'
                ? `앨범 관리${albums.length > 0 ? ` (${albums.length})` : ''}`
                : '보호자 계정'}
            </button>
          ))}
        </div>
      )}

      {/* ── 앨범 탭 ── */}
      {tab === 'albums' && (
        <div className="space-y-4">
          {/* 요약 스트립 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
              <p className="text-[11px] sm:text-xs font-medium text-gray-500">전체 앨범</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{overview.total}</p>
            </div>
            <div className="rounded-xl p-3 sm:p-4 border bg-green-50 border-green-100">
              <p className="text-[11px] sm:text-xs font-medium text-green-600">공개 중</p>
              <p className="text-xl sm:text-2xl font-bold text-green-700">{overview.publicCount}</p>
            </div>
            <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
              <p className="text-[11px] sm:text-xs font-medium text-gray-500">전체 사진</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{overview.photos}</p>
            </div>
            <div className="rounded-xl p-3 sm:p-4 border bg-gray-50 border-gray-100">
              <p className="text-[11px] sm:text-xs font-medium text-gray-500">{canManage ? '보호자' : '비공개'}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{canManage ? overview.guardians : overview.privateCount}</p>
            </div>
          </div>

          {/* 검색 바 */}
          <div className="flex gap-2 flex-wrap">
            {/* 수급자 선택 드롭다운 */}
            <div className="relative" ref={dropRef}>
              <button onClick={() => setResDropOpen(v => !v)}
                className="flex items-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-primary-orange hover:text-primary-orange transition-colors min-w-[160px]">
                <Users size={14} className="text-gray-400 flex-shrink-0"/>
                <span className="truncate flex-1 text-left">
                  {selectedResident ? selectedResident.name : '전체 수급자'}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${resDropOpen ? 'rotate-180' : ''}`}/>
              </button>

              {resDropOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                  {/* 검색 */}
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input
                        autoFocus
                        value={resSearch}
                        onChange={e => setResSearch(e.target.value)}
                        placeholder="수급자 이름 검색..."
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
                      />
                    </div>
                  </div>
                  {/* 목록 */}
                  <div className="max-h-60 overflow-y-auto">
                    <button onClick={() => { setFilterRes(''); setResDropOpen(false); setResSearch('') }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${!filterRes ? 'text-primary-orange font-semibold bg-orange-50' : 'text-gray-700'}`}>
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">전</span>
                      전체 보기
                    </button>
                    {filteredResidents.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">검색 결과 없음</p>
                    ) : filteredResidents.map(r => (
                      <button key={r.id}
                        onClick={() => { setFilterRes(r.id); setResDropOpen(false); setResSearch('') }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${filterRes===r.id ? 'text-primary-orange font-semibold bg-orange-50' : 'text-gray-700'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${r.gender==='female'?'bg-pink-100 text-pink-700':'bg-blue-100 text-blue-700'}`}>
                          {r.name[0]}
                        </span>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 앨범 검색 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                value={albumSearch}
                onChange={e => { setAlbumSearch(e.target.value); setPage(1) }}
                placeholder="앨범 제목, 수급자명, 설명 검색..."
                className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
              />
              {albumSearch && (
                <button onClick={() => setAlbumSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13}/>
                </button>
              )}
            </div>

            {/* 새로고침 */}
            <button onClick={fetchAlbums} disabled={albumsLoading}
              className="h-10 w-10 flex items-center justify-center border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 disabled:opacity-50">
              <RefreshCw size={14} className={albumsLoading ? 'animate-spin' : ''}/>
            </button>
          </div>

          {/* 결과 요약 */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {albumsLoading ? '불러오는 중...' :
               `${searchedAlbums.length}개 앨범${albumSearch ? ` (검색: "${albumSearch}")` : ''}`}
            </p>
            {filterRes && (
              <button onClick={() => setFilterRes('')}
                className="text-xs text-primary-orange hover:underline flex items-center gap-1">
                <X size={11}/> 필터 해제
              </button>
            )}
          </div>

          {/* 에러 */}
          {albumsError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15}/>
              {albumsError}
              <button onClick={fetchAlbums} className="ml-auto text-xs underline">다시 시도</button>
            </div>
          )}

          {/* 로딩 */}
          {albumsLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-primary-orange"/>
            </div>
          )}

          {/* 빈 상태 */}
          {!albumsLoading && !albumsError && searchedAlbums.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ImagePlus size={28} className="text-primary-orange"/>
              </div>
              <p className="font-semibold text-gray-700">
                {albumSearch ? `"${albumSearch}" 검색 결과가 없습니다` : '아직 앨범이 없습니다'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {albumSearch ? '다른 검색어를 입력해보세요' : '앨범 만들기를 눌러 시작하세요'}
              </p>
            </div>
          )}

          {/* 앨범 그리드 */}
          {!albumsLoading && !albumsError && pagedAlbums.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pagedAlbums.map(album => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onOpen={() => openAlbum(album)}
                    onEdit={() => setEditAlbum(album)}
                    onToggle={() => togglePublic(album)}
                    onDelete={() => deleteAlbum(album.id)}
                  />
                ))}
              </div>

              {/* 더 보기 */}
              {hasMore && (
                <div className="text-center pt-2">
                  <button onClick={() => setPage(p => p + 1)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                    더 보기 ({searchedAlbums.length - page * PAGE_SIZE}개 남음)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 보호자 탭 — canManage인 경우만 렌더링 ── */}
      {canManage && tab === 'guardians' && (
        <div className="space-y-3">
          {/* 보호자 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              value={guardianSearch}
              onChange={e => setGuardianSearch(e.target.value)}
              placeholder="보호자명, 전화번호, 수급자명 검색..."
              className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"
            />
            {guardianSearch && (
              <button onClick={() => setGuardianSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13}/>
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">{filteredGuardians.length}명</p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filteredGuardians.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">
                  {guardianSearch ? `"${guardianSearch}" 검색 결과 없음` : '등록된 보호자가 없습니다'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredGuardians.map(g => (
                  <div key={g.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-700 font-bold text-sm">{g.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
                      <p className="text-xs text-gray-500">{g.phone}</p>
                      {g.residents.length > 0 && (
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {g.residents.map(r => (
                            <span key={r.id} className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                              {r.name} ({r.relation})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.is_active ? '활성' : '비활성'}
                    </span>
                    <button
                      onClick={() => setEditGuardian(g)}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0">
                      <Edit2 size={14} className="text-gray-400" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`${g.name} 보호자를 삭제할까요?`)) return
                        await adminAlbumAPI.deleteGuardian(g.id)
                        fetchGuardians()
                      }}
                      className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 size={13} className="text-red-400"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 모달들 ── */}
      {modal === 'createAlbum' && (
        <AlbumCreateModal
          residents={activeResidents}
          defaultResidentId={filterRes}
          onClose={() => setModal('none')}
          onCreated={() => { fetchAlbums(); setModal('none') }}
        />
      )}

      {canManage && modal === 'createGuardian' && (
        <GuardianCreateModal
          residents={activeResidents}
          onClose={() => setModal('none')}
          onCreated={() => { fetchGuardians(); setModal('none') }}
        />
      )}

      {editAlbum && (
        <AlbumEditModal
          album={editAlbum}
          onClose={() => setEditAlbum(null)}
          onSaved={() => { fetchAlbums(); setEditAlbum(null) }}
        />
      )}

      {canManage && editGuardian && (
        <GuardianEditModal
          guardian={editGuardian}
          residents={activeResidents}
          onClose={() => setEditGuardian(null)}
          onSaved={() => { fetchGuardians(); setEditGuardian(null) }}
        />
      )}

      {modal === 'uploadMedia' && selAlbum && (
        <MediaModal
          album={selAlbum}
          media={media}
          uploading={uploading}
          onUpload={handleUpload}
          onDeleteMedia={deleteMedia}
          onViewMedia={m => { setSelMedia(m); setModal('viewMedia') }}
          onClose={() => { setModal('none'); setSelAlbum(null); setMedia([]) }}
          fileRef={fileRef}
          folderRef={folderRef}
        />
      )}

      {modal === 'viewMedia' && selMedia && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => { setModal('uploadMedia'); setSelMedia(null) }}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
            onClick={() => { setModal('uploadMedia'); setSelMedia(null) }}>
            <X size={24}/>
          </button>
          {selMedia.media_type === 'photo' ? (
            <img src={mediaUrl(selMedia.file_url)}
              className="max-w-full max-h-full object-contain"
              onClick={e => e.stopPropagation()} alt=""/>
          ) : (
            <video src={mediaUrl(selMedia.file_url)} controls
              className="max-w-full max-h-full" onClick={e => e.stopPropagation()}/>
          )}
        </div>
      )}
    </div>
  )
}

// ── 앨범 카드 ──────────────────────────────────────────────────────────────────
function AlbumCard({ album, onOpen, onEdit, onToggle, onDelete }: {
  album: Album; onOpen: ()=>void; onEdit: ()=>void; onToggle: ()=>void; onDelete: ()=>void
}) {
  const fmt = (s: string) => {
    const d = new Date(s)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      {/* 커버 */}
      <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-amber-100 cursor-pointer"
        onClick={onOpen}>
        {album.cover_url ? (
          <img src={mediaUrl(album.cover_url)} className="w-full h-full object-cover" loading="lazy" decoding="async" alt={album.title}/>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1.5">
            <Image size={28} className="text-orange-300"/>
            <span className="text-[10px] text-orange-300">사진 없음</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded-full transition-opacity">
            열기
          </span>
        </div>
        {/* 공개 뱃지 */}
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            album.is_public ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
          }`}>{album.is_public ? '공개' : '비공개'}</span>
        </div>
        {/* 미디어 수 */}
        {album.media_count > 0 && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/50 text-white">
              📸 {album.media_count}
            </span>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{album.title}</p>
        </div>
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
            {album.resident_name}
          </span>
          <span className="text-[11px] text-gray-400">{fmt(album.created_at)}</span>
        </div>
        {album.description && (
          <p className="text-[11px] text-gray-400 line-clamp-1 mb-2">{album.description}</p>
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={onOpen}
            className="flex-1 text-xs py-1.5 rounded-lg bg-orange-50 text-primary-orange font-semibold hover:bg-orange-100 transition-colors">
            사진 관리
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors" title="앨범 수정">
            <Edit2 size={14} className="text-gray-500" />
          </button>
          <button onClick={onToggle}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors" title={album.is_public ? '비공개로 변경' : '공개로 변경'}>
            {album.is_public
              ? <Eye size={13} className="text-green-600"/>
              : <EyeOff size={13} className="text-gray-400"/>}
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
            <Trash2 size={13} className="text-red-400"/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 미디어 모달 ───────────────────────────────────────────────────────────────
function MediaModal({ album, media, uploading, onUpload, onDeleteMedia, onViewMedia, onClose, fileRef, folderRef }: {
  album: Album; media: Media[]; uploading: boolean
  onUpload: (f: FileList|null)=>void
  onDeleteMedia: (id: string)=>void
  onViewMedia: (m: Media)=>void
  onClose: ()=>void
  fileRef: React.RefObject<HTMLInputElement>
  folderRef: React.RefObject<HTMLInputElement>
}) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [deleting,   setDeleting]   = useState(false)

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deleteSelected = async () => {
    if (!selected.size) return
    if (!confirm(`선택한 ${selected.size}장을 삭제할까요?`)) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id => onDeleteMedia(id)))
      setSelected(new Set())
      setSelectMode(false)
    } finally { setDeleting(false) }
  }

  const fmt = (s: string) => {
    const d = new Date(s)
    return `${d.getMonth()+1}/${d.getDate()}`
  }

  const photoCount = media.filter(m => m.media_type === 'photo').length
  const videoCount = media.filter(m => m.media_type === 'video').length

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white flex flex-col h-full sm:h-auto sm:max-h-[95vh] sm:m-auto sm:w-full sm:max-w-2xl sm:rounded-3xl sm:shadow-2xl overflow-hidden">

        {/* ── 헤더 ── */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 text-base leading-tight truncate">
                {album.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  {album.resident_name}
                </span>
                {media.length > 0 && (
                  <span className="text-xs text-gray-400">
                    📸 {photoCount}장{videoCount > 0 ? ` · 🎬 ${videoCount}개` : ''}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  album.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {album.is_public ? '공개중' : '비공개'}
                </span>
              </div>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500">
              <X size={18}/>
            </button>
          </div>

          {/* 액션 바 */}
          <div className="flex gap-2 mt-3">
            {!selectMode ? (
              <>
                {/* 사진 업로드 — 모바일 메인 액션 */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-orange text-white py-3 rounded-2xl text-sm font-bold hover:bg-primary-orange/90 active:scale-95 transition-transform shadow-sm shadow-orange-200">
                  <ImagePlus size={18}/> 사진 올리기
                </button>
                {/* 폴더 업로드 — 보조 */}
                <button
                  onClick={() => folderRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-3 border border-gray-200 rounded-2xl text-sm text-gray-600 hover:bg-gray-50">
                  <Folder size={16}/>
                  <span className="hidden sm:inline">폴더</span>
                </button>
                {/* 선택 삭제 모드 */}
                {media.length > 0 && (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="flex items-center gap-1.5 px-3 py-3 border border-gray-200 rounded-2xl text-sm text-gray-600 hover:bg-gray-50">
                    <Trash2 size={15}/>
                    <span className="hidden sm:inline">선택삭제</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={deleteSelected}
                  disabled={selected.size === 0 || deleting}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40 hover:bg-red-600">
                  <Trash2 size={16}/>
                  {deleting ? '삭제 중...' : selected.size > 0 ? `${selected.size}장 삭제` : '삭제할 사진 선택'}
                </button>
                <button
                  onClick={() => { setSelectMode(false); setSelected(new Set()) }}
                  className="px-4 py-3 border border-gray-200 rounded-2xl text-sm text-gray-600 hover:bg-gray-50">
                  취소
                </button>
                {media.length > 0 && (
                  <button
                    onClick={() => setSelected(
                      selected.size === media.length
                        ? new Set()
                        : new Set(media.map(m => m.id))
                    )}
                    className="px-3 py-3 border border-gray-200 rounded-2xl text-xs text-gray-600 hover:bg-gray-50">
                    {selected.size === media.length ? '해제' : '전체'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 파일 인풋 */}
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => { onUpload(e.target.files); e.target.value = '' }}/>
        <input ref={folderRef} type="file" multiple accept="image/*,video/*" className="hidden"
          {...{ webkitdirectory: '', directory: '' } as any}
          onChange={e => { onUpload(e.target.files); e.target.value = '' }}/>

        {/* ── 콘텐츠 ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50">

          {/* 업로드 진행 중 */}
          {uploading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 bg-orange-50 border-b border-orange-100">
              <Loader2 size={28} className="animate-spin text-primary-orange"/>
              <p className="text-sm font-semibold text-primary-orange">사진 올리는 중...</p>
              <p className="text-xs text-orange-400">잠시만 기다려주세요</p>
            </div>
          )}

          {/* 빈 상태 — 드래그 영역 */}
          {media.length === 0 && !uploading && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); onUpload(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center py-20 px-6 gap-4 cursor-pointer group">
              <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <ImagePlus size={36} className="text-primary-orange"/>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700 text-lg">아직 사진이 없어요</p>
                <p className="text-sm text-gray-400 mt-1">여기를 눌러 사진을 추가하거나<br/>위의 <b>사진 올리기</b> 버튼을 눌러주세요</p>
              </div>
            </div>
          )}

          {/* 사진 그리드 */}
          {media.length > 0 && (
            <div className="p-3">
              {/* 드래그 업로드 존 (소형) */}
              {!selectMode && (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); onUpload(e.dataTransfer.files) }}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 mb-3 p-3 border border-dashed border-gray-300 rounded-2xl text-sm text-gray-400 hover:border-primary-orange hover:text-primary-orange transition-colors cursor-pointer">
                  <Upload size={14}/> 여기에 사진을 드래그하거나 눌러서 추가
                </div>
              )}

              {/* 날짜별 그룹 */}
              <MediaGrid
                media={media}
                selectMode={selectMode}
                selected={selected}
                onToggle={toggleSelect}
                onView={onViewMedia}
                onDelete={onDeleteMedia}
                fmt={fmt}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 미디어 그리드 (날짜별 그룹화) ───────────────────────────────────────────
function MediaGrid({ media, selectMode, selected, onToggle, onView, onDelete, fmt }: {
  media: Media[]
  selectMode: boolean
  selected: Set<string>
  onToggle: (id: string) => void
  onView: (m: Media) => void
  onDelete: (id: string) => void
  fmt: (s: string) => string
}) {
  // 날짜별 그룹화
  const groups = media.reduce<Record<string, Media[]>>((acc, m) => {
    const day = m.created_at.slice(0, 10)
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})

  const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  const formatDay = (s: string) => {
    const d = new Date(s)
    const weekday = ['일','월','화','수','목','금','토'][d.getDay()]
    return `${d.getMonth()+1}월 ${d.getDate()}일 (${weekday})`
  }

  return (
    <div className="space-y-5">
      {sortedDays.map(day => (
        <div key={day}>
          <p className="text-xs font-semibold text-gray-400 mb-2 px-1 flex items-center gap-2">
            <span className="bg-gray-200 rounded-full px-2.5 py-0.5">{formatDay(day)}</span>
            <span className="text-gray-300">{groups[day].length}장</span>
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {groups[day].map(m => (
              <MediaTile key={m.id} m={m}
                selectMode={selectMode}
                isSelected={selected.has(m.id)}
                onToggle={() => onToggle(m.id)}
                onView={() => onView(m)}
                onDelete={() => onDelete(m.id)}
                fmt={fmt}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 미디어 타일 ──────────────────────────────────────────────────────────────
function MediaTile({ m, selectMode, isSelected, onToggle, onView, onDelete, fmt }: {
  m: Media; selectMode: boolean; isSelected: boolean
  onToggle: () => void; onView: () => void; onDelete: () => void
  fmt: (s: string) => string
}) {
  const url = m.thumbnail_url || m.file_url

  const handleClick = () => {
    if (selectMode) onToggle()
    else onView()
  }

  return (
    <div
      onClick={handleClick}
      className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all ${
        isSelected ? 'ring-3 ring-primary-orange scale-95' : 'hover:opacity-90'
      }`}>
      {/* 이미지 / 영상 */}
      {m.media_type === 'photo' ? (
        <img src={mediaUrl(url)} alt=""
          className="w-full h-full object-cover"
          loading="lazy" decoding="async"/>
      ) : (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5"/>
            </div>
          </div>
        </div>
      )}

      {/* 선택 체크 */}
      {selectMode && (
        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-primary-orange border-primary-orange'
            : 'bg-white/80 border-gray-300'
        }`}>
          {isSelected && (
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      )}

      {/* 날짜 (선택 모드 아닐 때) */}
      {!selectMode && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
          <p className="text-[10px] text-white/90">{fmt(m.created_at)}</p>
        </div>
      )}

      {/* 삭제 버튼 — 일반 모드, 모바일 친화적으로 항상 표시 */}
      {!selectMode && (
        <button
          onClick={e => { e.stopPropagation(); if (confirm('이 사진을 삭제할까요?')) onDelete() }}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors sm:opacity-0 sm:group-hover:opacity-100">
          <X size={12}/>
        </button>
      )}
    </div>
  )
}

// ── 앨범 생성 모달 ─────────────────────────────────────────────────────────────
function AlbumCreateModal({ residents, defaultResidentId, onClose, onCreated }: {
  residents: { id:string; name:string; gender?:string }[]
  defaultResidentId?: string
  onClose: ()=>void; onCreated: ()=>void
}) {
  const [title,      setTitle]      = useState('')
  const [desc,       setDesc]       = useState('')
  const [isPublic,   setIsPublic]   = useState(true)
  const [selIds,     setSelIds]     = useState<string[]>(
    defaultResidentId ? [defaultResidentId] : []
  )
  const [search,     setSearch]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

  const filtered = residents.filter(r =>
    !search || r.name.includes(search)
  )

  const toggle = (id: string) =>
    setSelIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const selectAll = () => setSelIds(filtered.map(r => r.id))
  const clearAll  = () => setSelIds([])

  const submit = async () => {
    if (!title.trim())      { setError('앨범 제목을 입력하세요'); return }
    if (selIds.length === 0) { setError('수급자를 1명 이상 선택하세요'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('title',        title.trim())
      fd.append('description',  desc.trim())
      fd.append('is_public',    String(isPublic))
      fd.append('resident_ids', JSON.stringify(selIds))
      await adminAlbumAPI.createAlbum(fd)
      onCreated()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '앨범 생성 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">새 앨범 만들기</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              여러 어르신을 선택하면 각각 앨범이 생성됩니다
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* 앨범 제목 */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                앨범 제목 <span className="text-red-400">*</span>
              </label>
              <input className={ic} value={title} autoFocus
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 2026년 봄 나들이"/>
            </div>

            {/* 수급자 선택 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">
                  수급자 선택 <span className="text-red-400">*</span>
                  {selIds.length > 0 && (
                    <span className="ml-1.5 bg-primary-orange text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {selIds.length}명 선택
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <button onClick={selectAll}
                    className="text-[11px] text-primary-orange hover:underline font-semibold">
                    전체선택
                  </button>
                  <button onClick={clearAll}
                    className="text-[11px] text-gray-400 hover:underline">
                    초기화
                  </button>
                </div>
              </div>

              {/* 검색 */}
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="수급자 이름 검색"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-orange/40"/>
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={12}/>
                  </button>
                )}
              </div>

              {/* 수급자 목록 */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">검색 결과 없음</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map(r => {
                      const selected = selIds.includes(r.id)
                      return (
                        <button key={r.id} onClick={() => toggle(r.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            selected ? 'bg-orange-50' : 'hover:bg-gray-50'
                          }`}>
                          {/* 체크박스 */}
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected
                              ? 'bg-primary-orange border-primary-orange'
                              : 'border-gray-300'
                          }`}>
                            {selected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          {/* 아바타 */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            r.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {r.name[0]}
                          </div>
                          <span className={`text-sm font-medium ${selected ? 'text-primary-orange' : 'text-gray-700'}`}>
                            {r.name}
                          </span>
                          {selected && (
                            <span className="ml-auto text-[10px] text-primary-orange font-semibold">✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 선택된 수급자 태그 */}
              {selIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selIds.map(id => {
                    const r = residents.find(r => r.id === id)
                    if (!r) return null
                    return (
                      <span key={id}
                        className="flex items-center gap-1 text-xs bg-orange-100 text-primary-orange px-2.5 py-1 rounded-full font-medium">
                        {r.name}
                        <button onClick={() => toggle(id)} className="hover:text-red-500">
                          <X size={10}/>
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 설명 */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">설명</label>
              <textarea className={ic} rows={2} value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="앨범에 대한 설명을 입력하세요"/>
            </div>

            {/* 공개 여부 */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 border border-gray-100">
              <input type="checkbox" checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-orange-500"/>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">보호자에게 공개</p>
                <p className="text-xs text-gray-400">
                  {isPublic ? '보호자 앱에서 이 앨범을 볼 수 있습니다' : '보호자에게 숨겨집니다'}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{isPublic ? '공개' : '비공개'}</span>
            </label>

            {/* 미리보기 */}
            {selIds.length > 1 && title && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">📋 생성 예시</p>
                <div className="space-y-0.5">
                  {selIds.slice(0, 3).map(id => {
                    const r = residents.find(r => r.id === id)
                    return r ? (
                      <p key={id} className="text-xs text-blue-600">
                        · {r.name} — "{title}"
                      </p>
                    ) : null
                  })}
                  {selIds.length > 3 && (
                    <p className="text-xs text-blue-400">... 외 {selIds.length - 3}명</p>
                  )}
                </div>
                <p className="text-xs text-blue-500 mt-1.5">
                  총 {selIds.length}개 앨범이 생성됩니다
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle size={13}/> {error}
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0">
          <button onClick={submit}
            disabled={saving || !title.trim() || selIds.length === 0}
            className="flex-1 bg-primary-orange text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50 transition-colors">
            {saving
              ? '생성 중...'
              : selIds.length > 1
                ? `앨범 ${selIds.length}개 만들기`
                : '앨범 만들기'}
          </button>
          <button onClick={onClose}
            className="px-5 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm hover:bg-gray-50">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 보호자 추가 모달 ──────────────────────────────────────────────────────────
function GuardianCreateModal({ residents, onClose, onCreated }: {
  residents: { id:string; name:string }[]; onClose: ()=>void; onCreated: ()=>void
}) {
  const [form, setForm] = useState({ name:'', phone:'', password:'', resident_id:'', relation:'보호자' })
  const [saving, setSaving]  = useState(false)
  const [error,  setError]   = useState('')
  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"

  const submit = async () => {
    if (!form.name || !form.phone || !form.password) { setError('이름, 전화번호, 비밀번호를 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k, String(v)))
      await adminAlbumAPI.createGuardian(fd)
      onCreated()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '이미 등록된 전화번호이거나 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">보호자 계정 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">이름 *</label>
              <input className={ic} value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} placeholder="홍길동"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">관계</label>
              <select className={ic} value={form.relation}
                onChange={e => setForm({...form, relation: e.target.value})}>
                {['보호자','아들','딸','배우자','며느리','사위','손자','손녀','형제/자매','기타'].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">전화번호 * (로그인 아이디)</label>
            <input className={ic} type="tel" value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})} placeholder="010-0000-0000"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">초기 비밀번호 *</label>
            <input type="password" className={ic} value={form.password}
              onChange={e => setForm({...form, password: e.target.value})} placeholder="보호자에게 전달할 비밀번호"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">연결할 수급자</label>
            <select className={ic} value={form.resident_id}
              onChange={e => setForm({...form, resident_id: e.target.value})}>
              <option value="">선택 안 함</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={13}/> {error}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {saving ? '등록 중...' : '🌸 보호자 등록'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 보호자 수정 모달 ──────────────────────────────────────────────────────────
function GuardianEditModal({ guardian, residents, onClose, onSaved }: {
  guardian: Guardian
  residents: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name,       setName]       = useState(guardian.name)
  const [phone,      setPhone]      = useState(guardian.phone)
  const [password,   setPassword]   = useState('')
  const [isActive,   setIsActive]   = useState(guardian.is_active)
  const [newResId,   setNewResId]   = useState('')
  const [relation,   setRelation]   = useState('보호자')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"

  const save = async () => {
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      if (name  !== guardian.name)     fd.append('name',      name)
      if (phone !== guardian.phone)    fd.append('phone',     phone)
      if (password)                    fd.append('password',  password)
      if (isActive !== guardian.is_active) fd.append('is_active', String(isActive))
      if (newResId) {
        fd.append('resident_id', newResId)
        fd.append('relation',    relation)
      }
      await adminAlbumAPI.updateGuardian(guardian.id, fd)
      onSaved()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? '저장 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  const unlink = async (residentId: string, residentName: string) => {
    if (!confirm(`${residentName} 수급자와의 연결을 해제할까요?`)) return
    try {
      await adminAlbumAPI.unlinkResident(guardian.id, residentId)
      onSaved()
    } catch { setError('연결 해제 실패') }
  }

  // 이미 연결된 수급자 제외
  const linkedIds     = guardian.residents.map(r => r.id)
  const unlinkableRes = residents.filter(r => !linkedIds.includes(r.id))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-gray-900">보호자 정보 수정</h2>
            <p className="text-xs text-gray-400 mt-0.5">{guardian.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 기본 정보 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">이름</label>
            <input className={ic} value={name} onChange={e => setName(e.target.value)}/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              전화번호 <span className="text-gray-400 font-normal">(로그인 아이디)</span>
            </label>
            <input className={ic} value={phone} type="tel"
              onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000 또는 01000000000"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              새 비밀번호 <span className="text-gray-400 font-normal">(변경 시에만 입력)</span>
            </label>
            <input className={ic} value={password} type="password"
              onChange={e => setPassword(e.target.value)} placeholder="변경하지 않으면 비워두세요"/>
          </div>

          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input type="checkbox" checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-teal-600"/>
            <span className="text-sm text-gray-700">계정 활성화</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-auto ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isActive ? '활성' : '비활성'}
            </span>
          </label>

          {/* 연결된 수급자 */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">연결된 수급자</p>
            {guardian.residents.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">연결된 수급자 없음</p>
            ) : (
              <div className="space-y-1.5">
                {guardian.residents.map(r => (
                  <div key={r.id}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-xl">
                    <span className="w-6 h-6 bg-purple-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-purple-800 flex-shrink-0">
                      {r.name[0]}
                    </span>
                    <span className="text-sm font-medium text-purple-900 flex-1">{r.name}</span>
                    <span className="text-[10px] text-purple-500">{r.relation}</span>
                    <button onClick={() => unlink(r.id, r.name)}
                      className="text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded-lg transition-colors">
                      연결 해제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 수급자 추가 연결 */}
          {unlinkableRes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">수급자 추가 연결</p>
              <div className="flex gap-2">
                <select className={`${ic} flex-1`} value={newResId}
                  onChange={e => setNewResId(e.target.value)}>
                  <option value="">수급자 선택</option>
                  {unlinkableRes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <select className={`${ic} w-28`} value={relation}
                  onChange={e => setRelation(e.target.value)}>
                  {['보호자','아들','딸','배우자','며느리','사위','손자','손녀','형제/자매','기타'].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* 저장 */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 앨범 수정 모달 ────────────────────────────────────────────────────────────
function AlbumEditModal({ album, onClose, onSaved }: {
  album: Album; onClose: () => void; onSaved: () => void
}) {
  const [title,       setTitle]       = useState(album.title)
  const [description, setDescription] = useState(album.description ?? '')
  const [isPublic,    setIsPublic]    = useState(album.is_public)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

  const save = async () => {
    if (!title.trim()) { setError('앨범 제목을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('title',       title.trim())
      fd.append('description', description.trim())
      fd.append('is_public',   String(isPublic))
      await adminAlbumAPI.updateAlbum(album.id, fd)
      onSaved()
    } catch {
      setError('저장 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">앨범 수정</h2>
            <p className="text-xs text-gray-400 mt-0.5">{album.resident_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">앨범 제목 *</label>
            <input
              className={ic}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 2026년 봄 나들이"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">설명</label>
            <textarea
              className={ic}
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="앨범에 대한 설명을 입력하세요"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-700 font-medium">보호자에게 공개</p>
              <p className="text-xs text-gray-400">
                {isPublic ? '보호자가 이 앨범을 볼 수 있습니다' : '보호자에게 숨겨집니다'}
              </p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isPublic ? '공개' : '비공개'}
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-600">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

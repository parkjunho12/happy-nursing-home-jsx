import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, Upload, X, Eye, EyeOff, ImagePlus,
  Users, Folder, Play, Image, Search, ChevronDown,
  Loader2, AlertCircle, RefreshCw,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { adminAlbumAPI } from '@/api/albumClient'

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

  // 데이터
  const [albums,    setAlbums]    = useState<Album[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [media,     setMedia]     = useState<Media[]>([])

  // UI 상태
  const [selAlbum,  setSelAlbum]  = useState<Album | null>(null)
  const [selMedia,  setSelMedia]  = useState<Media | null>(null)
  const [modal,     setModal]     = useState<ModalType>('none')
  const [tab,       setTab]       = useState<'albums' | 'guardians'>('albums')
  const [uploading, setUploading] = useState(false)
  const [albumsLoading, setAlbumsLoading] = useState(false)
  const [albumsError,   setAlbumsError]   = useState('')

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

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보호자 앨범</h1>
          <p className="text-sm text-gray-500 mt-0.5">수급자별 앨범을 관리하고 보호자에게 공개합니다</p>
        </div>
        <div className="flex gap-2">
          {tab === 'albums' && (
            <button onClick={() => setModal('createAlbum')}
              className="flex items-center gap-1.5 bg-primary-orange text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-orange/90 shadow-sm">
              <Plus size={15}/> 앨범 만들기
            </button>
          )}
          {tab === 'guardians' && (
            <button onClick={() => setModal('createGuardian')}
              className="flex items-center gap-1.5 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-700 shadow-sm">
              <Plus size={15}/> 보호자 추가
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['albums','guardians'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab===t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t==='albums' ? `앨범 관리 ${albums.length > 0 ? `(${albums.length})` : ''}` : '보호자 계정'}
          </button>
        ))}
      </div>

      {/* ── 앨범 탭 ── */}
      {tab === 'albums' && (
        <div className="space-y-4">
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
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pagedAlbums.map(album => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onOpen={() => openAlbum(album)}
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

      {/* ── 보호자 탭 ── */}
      {tab === 'guardians' && (
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

      {modal === 'createGuardian' && (
        <GuardianCreateModal
          residents={activeResidents}
          onClose={() => setModal('none')}
          onCreated={() => { fetchGuardians(); setModal('none') }}
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
function AlbumCard({ album, onOpen, onToggle, onDelete }: {
  album: Album; onOpen: ()=>void; onToggle: ()=>void; onDelete: ()=>void
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
          <img src={mediaUrl(album.cover_url)} className="w-full h-full object-cover" alt={album.title}/>
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
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">{album.title}</h2>
            <p className="text-xs text-gray-500">{album.resident_name} · {media.length}개</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm bg-primary-orange text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-primary-orange/90">
              <Upload size={13}/> 파일 추가
            </button>
            <button onClick={() => folderRef.current?.click()}
              className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
              <Folder size={13}/> 폴더
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => onUpload(e.target.files)}/>
        <input ref={folderRef} type="file" multiple accept="image/*,video/*" className="hidden"
          {...{ webkitdirectory: '', directory: '' } as any}
          onChange={e => onUpload(e.target.files)}/>

        <div className="flex-1 overflow-y-auto p-4">
          {uploading && (
            <div className="flex items-center justify-center py-6 gap-2 text-primary-orange">
              <Loader2 size={18} className="animate-spin"/>
              <span className="text-sm">업로드 중...</span>
            </div>
          )}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onUpload(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4 text-center text-sm text-gray-400 hover:border-primary-orange hover:text-primary-orange transition-colors cursor-pointer ${media.length === 0 ? 'py-10' : 'py-3'}`}>
            {media.length === 0
              ? '여기에 사진/영상을 드래그하거나 클릭하세요'
              : '+ 추가 업로드'}
          </div>
          {media.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {media.map(m => (
                <div key={m.id} className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
                  onClick={() => onViewMedia(m)}>
                  {m.media_type === 'photo' ? (
                    <img src={mediaUrl(m.file_url)} className="w-full h-full object-cover" alt=""/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Play size={24} className="text-white"/>
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteMedia(m.id) }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <X size={11}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 앨범 생성 모달 ─────────────────────────────────────────────────────────────
function AlbumCreateModal({ residents, defaultResidentId, onClose, onCreated }: {
  residents: { id:string; name:string; gender?:string }[]
  defaultResidentId?: string
  onClose: ()=>void; onCreated: ()=>void
}) {
  const [form, setForm] = useState({
    title: '', resident_id: defaultResidentId ?? '',
    description: '', is_public: true,
  })
  const [saving, setSaving] = useState(false)
  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

  const submit = async () => {
    if (!form.title || !form.resident_id) return
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k, String(v)))
      await adminAlbumAPI.createAlbum(fd)
      onCreated()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">새 앨범 만들기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">수급자 *</label>
            <select className={ic} value={form.resident_id}
              onChange={e => setForm({...form, resident_id: e.target.value})}>
              <option value="">수급자 선택</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">앨범 제목 *</label>
            <input className={ic} value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} placeholder="예: 2026년 봄 나들이"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">설명</label>
            <textarea className={ic} rows={2} value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}/>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_public}
              onChange={e => setForm({...form, is_public: e.target.checked})}
              className="w-4 h-4 accent-orange-500"/>
            <span className="text-sm text-gray-700">보호자에게 공개</span>
          </label>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={submit} disabled={saving || !form.title || !form.resident_id}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">
            {saving ? '만드는 중...' : '앨범 만들기'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
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

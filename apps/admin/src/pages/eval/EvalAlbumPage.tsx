import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Trash2, Upload, X, Eye, EyeOff, ImagePlus,
  Users, Folder, Play, Image,
} from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { adminAlbumAPI } from '@/api/albumClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type Album   = { id:string; title:string; description:string; cover_url:string|null; is_public:boolean; media_count:number; resident_name:string; resident_id:string; created_at:string }
type Media   = { id:string; media_type:string; file_url:string; thumbnail_url:string|null; file_name:string; created_at:string }
type Guardian = { id:string; name:string; phone:string; is_active:boolean; residents:{id:string;name:string;relation:string}[] }

type ModalType = 'none' | 'createAlbum' | 'uploadMedia' | 'viewMedia' | 'createGuardian'

export default function EvalAlbumPage() {
  const { residents, loaded, loadAll } = useLtcStore()
  const [albums,    setAlbums]    = useState<Album[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [media,     setMedia]     = useState<Media[]>([])
  const [selAlbum,  setSelAlbum]  = useState<Album | null>(null)
  const [selMedia,  setSelMedia]  = useState<Media | null>(null)
  const [modal,     setModal]     = useState<ModalType>('none')
  const [tab,       setTab]       = useState<'albums' | 'guardians'>('albums')
  const [filterRes, setFilterRes] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef   = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!loaded) loadAll() }, [loaded, loadAll])
  useEffect(() => { fetchAlbums(); fetchGuardians() }, [])

  const fetchAlbums    = async () => { try { setAlbums(await adminAlbumAPI.listAlbums(filterRes || undefined)) } catch {} }
  const fetchGuardians = async () => { try { setGuardians(await adminAlbumAPI.listGuardians()) } catch {} }
  const fetchMedia     = async (albumId: string) => {
    try { setMedia(await adminAlbumAPI.listMedia(albumId)) } catch {}
  }

  useEffect(() => { fetchAlbums() }, [filterRes])

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
  const mediaUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE}${url}`

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
        {([['albums','앨범 관리'],['guardians','보호자 계정']] as const).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab===t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {/* ── 앨범 탭 ── */}
      {tab === 'albums' && (
        <div className="space-y-4">
          {/* 수급자 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFilterRes('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                !filterRes ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>전체</button>
            {activeResidents.map(r => (
              <button key={r.id} onClick={() => setFilterRes(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                  filterRes===r.id ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}>{r.name}</button>
            ))}
          </div>

          {/* 앨범 그리드 */}
          {albums.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ImagePlus size={28} className="text-primary-orange"/>
              </div>
              <p className="font-semibold text-gray-700">아직 앨범이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">앨범 만들기를 눌러 시작하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {albums.map(album => (
                <div key={album.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                  {/* 커버 이미지 */}
                  <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-amber-100 cursor-pointer"
                    onClick={() => openAlbum(album)}>
                    {album.cover_url ? (
                      <img src={mediaUrl(album.cover_url)} className="w-full h-full object-cover" alt={album.title}/>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Image size={32} className="text-orange-300"/>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded-full transition-opacity">
                        열기
                      </span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        album.is_public ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                      }`}>{album.is_public ? '공개' : '비공개'}</span>
                    </div>
                  </div>
                  {/* 카드 정보 */}
                  <div className="p-3">
                    <p className="font-bold text-gray-900 text-sm truncate">{album.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{album.resident_name} · {album.media_count}개</p>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <button onClick={() => openAlbum(album)}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-orange-50 text-primary-orange font-semibold hover:bg-orange-100 transition-colors">
                        사진 관리
                      </button>
                      <button onClick={() => togglePublic(album)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        {album.is_public ? <Eye size={13} className="text-green-600"/> : <EyeOff size={13} className="text-gray-400"/>}
                      </button>
                      <button onClick={() => deleteAlbum(album.id)}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} className="text-red-400"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 보호자 탭 ── */}
      {tab === 'guardians' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {guardians.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">등록된 보호자가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {guardians.map(g => (
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {g.is_active ? '활성' : '비활성'}
                  </span>
                  <button onClick={async () => { await adminAlbumAPI.deleteGuardian(g.id); fetchGuardians() }}
                    className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 size={13} className="text-red-400"/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 앨범 만들기 모달 ── */}
      {modal === 'createAlbum' && (
        <AlbumCreateModal
          residents={activeResidents}
          onClose={() => setModal('none')}
          onCreated={() => { fetchAlbums(); setModal('none') }}
        />
      )}

      {/* ── 보호자 추가 모달 ── */}
      {modal === 'createGuardian' && (
        <GuardianCreateModal
          residents={activeResidents}
          onClose={() => setModal('none')}
          onCreated={() => { fetchGuardians(); setModal('none') }}
        />
      )}

      {/* ── 사진 관리 모달 ── */}
      {modal === 'uploadMedia' && selAlbum && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setModal('none')}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">{selAlbum.title}</h2>
                <p className="text-xs text-gray-500">{selAlbum.resident_name} · {media.length}개</p>
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
                <button onClick={() => setModal('none')} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
              onChange={e => handleUpload(e.target.files)}/>
            <input ref={folderRef} type="file" multiple accept="image/*,video/*" className="hidden"
              {...{ webkitdirectory: '', directory: '' } as any}
              onChange={e => handleUpload(e.target.files)}/>

            {/* 미디어 그리드 */}
            <div className="flex-1 overflow-y-auto p-4">
              {uploading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-orange border-t-transparent rounded-full animate-spin mr-2"/>
                  <span className="text-sm text-gray-600">업로드 중...</span>
                </div>
              )}
              {/* 드래그앤드롭 영역 */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
                className={`${media.length === 0 ? 'min-h-[200px]' : ''} border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4 text-center text-sm text-gray-400 hover:border-primary-orange hover:text-primary-orange transition-colors cursor-pointer`}
                onClick={() => fileRef.current?.click()}>
                여기에 사진/영상을 드래그하거나 클릭하세요
              </div>
              {media.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {media.map(m => (
                    <div key={m.id} className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => { setSelMedia(m); setModal('viewMedia') }}>
                      {m.media_type === 'photo' ? (
                        <img src={mediaUrl(m.file_url)} className="w-full h-full object-cover" alt=""/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <Play size={24} className="text-white"/>
                          <span className="text-[10px] text-white absolute bottom-1 right-1 bg-black/50 px-1 rounded">동영상</span>
                        </div>
                      )}
                      <button onClick={e => { e.stopPropagation(); deleteMedia(m.id) }}
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
      )}

      {/* ── 미디어 크게 보기 ── */}
      {modal === 'viewMedia' && selMedia && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => { setModal('uploadMedia'); setSelMedia(null) }}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => { setModal('uploadMedia'); setSelMedia(null) }}>
            <X size={24}/>
          </button>
          {selMedia.media_type === 'photo' ? (
            <img src={mediaUrl(selMedia.file_url)} className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} alt=""/>
          ) : (
            <video src={mediaUrl(selMedia.file_url)} controls className="max-w-full max-h-full" onClick={e => e.stopPropagation()}/>
          )}
        </div>
      )}
    </div>
  )
}

// ── 앨범 생성 모달 ──────────────────────────────────────────────────────────
function AlbumCreateModal({ residents, onClose, onCreated }: {
  residents: any[]; onClose: ()=>void; onCreated: ()=>void
}) {
  const [form, setForm] = useState({ title:'', resident_id:'', description:'', is_public: true })
  const [saving, setSaving] = useState(false)

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

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">새 앨범 만들기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">수급자 *</label>
            <select className={ic} value={form.resident_id} onChange={e => setForm({...form, resident_id:e.target.value})}>
              <option value="">수급자 선택</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">앨범 제목 *</label>
            <input className={ic} value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="예: 2026년 봄 나들이"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">설명</label>
            <textarea className={ic} rows={2} value={form.description} onChange={e => setForm({...form, description:e.target.value})}/>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm({...form, is_public:e.target.checked})} className="w-4 h-4 accent-orange-500"/>
            <span className="text-sm text-gray-700">보호자에게 공개</span>
          </label>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={submit} disabled={saving || !form.title || !form.resident_id}
            className="flex-1 bg-primary-orange text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">
            {saving ? '만드는 중...' : '앨범 만들기'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 보호자 추가 모달 ────────────────────────────────────────────────────────
function GuardianCreateModal({ residents, onClose, onCreated }: {
  residents: any[]; onClose: ()=>void; onCreated: ()=>void
}) {
  const [form, setForm] = useState({ name:'', phone:'', password:'', resident_id:'', relation:'보호자' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name || !form.phone || !form.password) return
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k, String(v)))
      await adminAlbumAPI.createGuardian(fd)
      onCreated()
    } finally { setSaving(false) }
  }

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40"

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">보호자 계정 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">이름 *</label>
              <input className={ic} value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="홍길동"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">관계</label>
              <select className={ic} value={form.relation} onChange={e => setForm({...form, relation:e.target.value})}>
                {['보호자','아들','딸','배우자','형제/자매','기타'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">전화번호 * (로그인 아이디)</label>
            <input className={ic} value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="010-1234-5678"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">비밀번호 *</label>
            <input type="password" className={ic} value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="초기 비밀번호 설정"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">연결할 수급자</label>
            <select className={ic} value={form.resident_id} onChange={e => setForm({...form, resident_id:e.target.value})}>
              <option value="">선택 안 함</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5 text-xs text-teal-700">
          📱 보호자는 <strong>{import.meta.env.VITE_FAMILY_URL || window.location.origin + '/family'}</strong> 에서 로그인합니다
        </div>
        <div className="flex gap-3">
          <button onClick={submit} disabled={saving || !form.name || !form.phone || !form.password}
            className="flex-1 bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {saving ? '등록 중...' : '보호자 등록'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
        </div>
      </div>
    </div>
  )
}

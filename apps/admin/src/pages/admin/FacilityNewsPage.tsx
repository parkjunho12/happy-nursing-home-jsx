import { useEffect, useState, useCallback } from 'react'
import {
  Megaphone, Plus, X, Trash2, Loader2, Pin, ImagePlus, Send, AlertCircle, Eye, EyeOff,
} from 'lucide-react'
import { newsAPI, NEWS_CATEGORIES, type FacilityNews } from '../../api/newsClient'

const CAT_EMOJI: Record<string, string> = {
  일반: '📢', 행사: '🎉', 면회: '🤝', 건강: '💊', 식단: '🍚', 봉사: '💛', 긴급: '🚨', 기타: '📌',
}
const CAT_COLOR: Record<string, string> = {
  일반: 'bg-gray-100 text-gray-600', 행사: 'bg-pink-100 text-pink-700', 면회: 'bg-blue-100 text-blue-700',
  건강: 'bg-emerald-100 text-emerald-700', 식단: 'bg-amber-100 text-amber-700', 봉사: 'bg-violet-100 text-violet-700',
  긴급: 'bg-red-100 text-red-700', 기타: 'bg-slate-100 text-slate-600',
}
const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function FacilityNewsPage() {
  const [rows, setRows] = useState<FacilityNews[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FacilityNews | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await newsAPI.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">시설소식 관리</h1>
            <p className="text-xs text-gray-400">행사·면회·건강·식단 등 가정통신문을 보호자에게 전달합니다.</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setAddOpen(true) }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm shadow-sm">
          <Plus className="w-4 h-4" /> 새 소식 작성
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400 bg-white rounded-xl border border-gray-100">
          아직 등록된 시설소식이 없습니다.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(n => (
            <button key={n.id} onClick={() => { setEditing(n); setAddOpen(true) }}
              className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all p-3 text-left">
              {n.image_url ? (
                <img src={newsAPI.imageUrl(n.image_url)!} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center text-2xl shrink-0">{CAT_EMOJI[n.category] ?? '📢'}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {n.is_pinned && <Pin className="w-3.5 h-3.5 text-orange-500" />}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${CAT_COLOR[n.category] ?? 'bg-gray-100 text-gray-600'}`}>{CAT_EMOJI[n.category]} {n.category}</span>
                  {!n.is_published && <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-400">초안</span>}
                </div>
                <p className="text-sm font-bold text-gray-800 truncate mt-1">{n.title}</p>
                <p className="text-xs text-gray-400 truncate">{fmtDate(n.published_at || n.created_at)}{n.author_name ? ` · ${n.author_name}` : ''}{n.summary ? ` · ${n.summary}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {addOpen && (
        <NewsFormModal editing={editing}
          onClose={() => { setAddOpen(false); setEditing(null) }}
          onSaved={() => { setAddOpen(false); setEditing(null); load() }} />
      )}
    </div>
  )
}

function NewsFormModal({ editing, onClose, onSaved }:
  { editing: FacilityNews | null; onClose: () => void; onSaved: (pushInfo?: any) => void }) {
  const isEdit = !!editing
  const [category, setCategory] = useState(editing?.category ?? '일반')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [summary, setSummary] = useState(editing?.summary ?? '')
  const [content, setContent] = useState(editing?.content ?? '')
  const [isPinned, setIsPinned] = useState(editing?.is_pinned ?? false)
  const [isPublished, setIsPublished] = useState(editing?.is_published ?? true)
  const [file, setFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const existingImg = editing?.image_url && !removeImage ? newsAPI.imageUrl(editing.image_url) : null
  const willPush = isPublished && (!isEdit || !editing?.is_published)

  const submit = async () => {
    if (!title.trim()) { setErr('제목을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('category', category)
      fd.append('title', title.trim())
      fd.append('summary', summary)
      fd.append('content', content)
      fd.append('is_pinned', String(isPinned))
      fd.append('is_published', String(isPublished))
      if (file) fd.append('image', file)
      if (isEdit && removeImage) fd.append('remove_image', 'true')
      const res: any = isEdit ? await newsAPI.update(editing!.id, fd) : await newsAPI.create(fd)
      onSaved(res?.push)
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  const del = async () => {
    if (!isEdit) return
    if (!confirm('이 시설소식을 삭제할까요?')) return
    setSaving(true)
    try { await newsAPI.remove(editing!.id); onSaved() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{isEdit ? '시설소식 수정' : '새 시설소식'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {NEWS_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${category === c ? (CAT_COLOR[c] ?? 'bg-gray-100 text-gray-700') + ' border-transparent' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {CAT_EMOJI[c]} {c}
                </button>
              ))}
            </div>
          </div>
          <Field label="제목 *"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 7월 생신잔치 안내" className="ninp" autoFocus /></Field>
          <Field label="요약 (카드에 표시)"><input value={summary} onChange={e => setSummary(e.target.value)} placeholder="한 줄 요약" className="ninp" /></Field>
          <Field label="본문"><textarea value={content} onChange={e => setContent(e.target.value)} rows={5} className="ninp resize-none" placeholder="자세한 내용을 입력하세요." /></Field>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">대표 이미지</label>
            {existingImg && (
              <div className="relative inline-block mb-2">
                <img src={existingImg} alt="" className="w-24 h-24 rounded-lg object-cover border border-gray-200" />
                <button onClick={() => { setRemoveImage(true); setFile(null) }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
              </div>
            )}
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3.5 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
              <ImagePlus className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{file ? file.name : '이미지 선택 (1장)'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false) }} />
            </label>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <button onClick={() => setIsPinned(v => !v)} className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isPinned ? 'text-orange-600' : 'text-gray-400'}`}>
              <Pin className="w-4 h-4" /> 상단 고정
            </button>
            <button onClick={() => setIsPublished(v => !v)} className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isPublished ? 'text-emerald-600' : 'text-gray-400'}`}>
              {isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} {isPublished ? '발행(보호자 공개)' : '초안(비공개)'}
            </button>
          </div>

          {willPush && (
            <div className="bg-orange-50 text-orange-700 rounded-lg px-3 py-2.5 text-xs flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> 발행 시 전체 보호자에게 푸시 알림이 발송됩니다.
            </div>
          )}
          {err && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {isEdit && (
            <button onClick={del} disabled={saving} className="px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1.5 mr-auto"><Trash2 className="w-4 h-4" />삭제</button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}{isEdit ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>{children}</div>
}

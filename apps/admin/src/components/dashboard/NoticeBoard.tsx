import { useEffect, useState } from 'react'
import { Megaphone, Pin, Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { noticeAPI, NOTICE_LEVEL, type InternalNotice, type NoticeLevel } from '@/api/noticeClient'

const rel = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  return `${d.getMonth() + 1}.${d.getDate()}`
}

/** 내부 공지사항 (직원용) — 읽기: 전 직원 / 작성: ADMIN·시설장 */
export default function NoticeBoard() {
  const { user } = useAuthStore()
  const canWrite = user?.role === 'ADMIN' || user?.position === '시설장'

  const [list, setList] = useState<InternalNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InternalNotice | null | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    noticeAPI.list(10).then(setList).catch(() => setList([])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary-orange/10 flex items-center justify-center">
            <Megaphone size={14} className="text-primary-orange" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">내부 공지</h2>
          {list.length > 0 && <span className="text-[11px] text-gray-400">{list.length}건</span>}
        </div>
        {canWrite && (
          <button onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-orange hover:bg-orange-50 px-2 py-1 rounded-lg">
            <Plus size={13} /> 공지 등록
          </button>
        )}
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : list.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            등록된 공지가 없습니다{canWrite && ' — 「공지 등록」으로 직원에게 알릴 내용을 올려보세요'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {list.map(n => {
              const lv = NOTICE_LEVEL[n.level] ?? NOTICE_LEVEL.info
              const open = openId === n.id
              return (
                <li key={n.id} className={`rounded-xl border transition-colors ${n.pinned ? 'border-orange-100 bg-orange-50/40' : 'border-gray-100 hover:bg-gray-50/60'}`}>
                  <div className="flex items-start gap-2 p-2.5 min-h-[44px] cursor-pointer" onClick={() => setOpenId(open ? null : n.id)}>
                    <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${lv.cls}`}>{lv.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                        {n.pinned && <Pin size={11} className="text-primary-orange shrink-0" />}
                        <span className={open ? '' : 'truncate'}>{n.title}</span>
                      </p>
                      {open && n.content && (
                        <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {n.author_name ?? '관리자'} · {rel(n.created_at)}
                      </p>
                    </div>
                    {canWrite && open && (
                      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditing(n)} aria-label="수정" className="p-2.5 md:p-1 text-gray-300 hover:text-gray-600 rounded"><Pencil size={13} /></button>
                        <button onClick={async () => { if (confirm('이 공지를 삭제할까요?')) { await noticeAPI.remove(n.id); load() } }}
                          aria-label="삭제" className="p-2.5 md:p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editing !== undefined && (
        <NoticeModal notice={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load() }} />
      )}
    </section>
  )
}

function NoticeModal({ notice, onClose, onSaved }: { notice: InternalNotice | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!notice
  const [title, setTitle] = useState(notice?.title ?? '')
  const [content, setContent] = useState(notice?.content ?? '')
  const [level, setLevel] = useState<NoticeLevel>(notice?.level ?? 'info')
  const [pinned, setPinned] = useState(!!notice?.pinned)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

  const save = async () => {
    if (!title.trim()) { setErr('제목을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const body = { title: title.trim(), content: content.trim() || null, level, pinned }
      if (isEdit) await noticeAPI.update(notice!.id, body)
      else await noticeAPI.create(body)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">{isEdit ? '공지 수정' : '내부 공지 등록'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">중요도</label>
            <div className="flex gap-1.5">
              {(['info', 'important', 'urgent'] as NoticeLevel[]).map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${level === l ? NOTICE_LEVEL[l].cls + ' ring-2 ring-offset-1 ring-gray-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {NOTICE_LEVEL[l].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inp} autoFocus placeholder="예: 8월 근무표 확정 안내" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">내용</label>
            <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} className={`${inp} resize-none`} placeholder="직원에게 전달할 내용을 입력하세요" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-primary-orange" />
            상단 고정 (핀)
          </label>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-semibold">취소</button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-primary-orange hover:bg-primary-orange/90 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

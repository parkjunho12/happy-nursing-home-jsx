import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import { templateAPI, type NoticeTemplate, type TemplateInput } from '@/api/templateClient'
import { NOTICE_LEVEL, type NoticeLevel } from '@/api/noticeClient'
import ImageUploader from '@/components/notices/ImageUploader'

const EMPTY: TemplateInput = { name: '', level: 'info', title: '', content: '', image_url: null }

export default function TemplateManagerModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<NoticeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)     // 편집 중 id (null=신규)
  const [form, setForm] = useState<TemplateInput>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setList(await templateAPI.list()) } catch { setList([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const pick = (t: NoticeTemplate) => {
    setSel(t.id); setForm({ name: t.name, level: t.level, title: t.title ?? '', content: t.content ?? '', image_url: t.image_url ?? null })
  }
  const reset = () => { setSel(null); setForm(EMPTY) }

  const save = async () => {
    if (!(form.name || '').trim()) { alert('템플릿 이름을 입력해주세요.'); return }
    setSaving(true)
    try {
      if (sel) await templateAPI.update(sel, form)
      else await templateAPI.create(form)
      await load(); reset()
    } catch (e: any) { alert(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }
  const del = async (id: string) => {
    if (!confirm('이 템플릿을 삭제할까요?')) return
    try { await templateAPI.remove(id); if (sel === id) reset(); await load() }
    catch (e: any) { alert(e?.message ?? '삭제 실패') }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">공지 템플릿 관리</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden flex-1 min-h-0">
          {/* 목록 */}
          <div className="border-r border-gray-100 overflow-y-auto p-3">
            <button onClick={reset}
              className="w-full mb-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-semibold hover:border-primary-orange hover:text-primary-orange">
              <Plus size={15} /> 새 템플릿
            </button>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
            ) : list.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">템플릿이 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {list.map(t => {
                  const lv = NOTICE_LEVEL[t.level] ?? NOTICE_LEVEL.info
                  return (
                    <li key={t.id}>
                      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer ${sel === t.id ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50 border border-transparent'}`}
                        onClick={() => pick(t)}>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${lv.cls}`}>{lv.label}</span>
                        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">{t.name}</span>
                        <button onClick={e => { e.stopPropagation(); del(t.id) }} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 편집 폼 */}
          <div className="overflow-y-auto p-4 space-y-3">
            <p className="text-xs font-bold text-gray-400">{sel ? '템플릿 수정' : '새 템플릿'}</p>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">이름 *</label>
              <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="예: 정전 안내" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">기본 중요도</label>
              <div className="flex gap-1.5">
                {(['info', 'important', 'urgent'] as NoticeLevel[]).map(l => (
                  <button key={l} type="button" onClick={() => setForm(f => ({ ...f, level: l }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${form.level === l ? NOTICE_LEVEL[l].cls + ' ring-2 ring-offset-1 ring-gray-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                    {NOTICE_LEVEL[l].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">기본 제목</label>
              <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} placeholder="공지 제목 기본값" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">기본 내용</label>
              <textarea rows={6} value={form.content ?? ''} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className={`${inp} resize-none`} placeholder="공지 내용 기본값 (○ 자리에 실제 값을 채워 쓰세요)" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">기본 이미지</label>
              <ImageUploader value={form.image_url} onChange={(url) => setForm(f => ({ ...f, image_url: url }))} />
            </div>
            <div className="flex gap-2 pt-1">
              {sel && <button onClick={reset} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold">새로 작성</button>}
              <button onClick={save} disabled={saving}
                className="flex-1 bg-primary-orange hover:bg-primary-orange/90 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                {saving ? '저장 중...' : sel ? '수정 저장' : '템플릿 추가'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { NotebookPen, Loader2, Trash2, Copy, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { meetingPrepAPI, type MeetingPrep } from '@/api/meetingPrepClient'

/** 회의 준비 — 카카오톡 대화(txt) 하나로 회의 때 챙겨야 할 것을 만든다. ADMIN 전용. */
export default function MeetingPrepPage() {
  const [items, setItems] = useState<MeetingPrep[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MeetingPrep | null>(null)   // source_text 포함
  const [showSource, setShowSource] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => meetingPrepAPI.list().then(setItems).catch(() => setItems([]))
  useEffect(() => { load() }, [])

  const create = async (f: File) => {
    setCreating(true); setErr('')
    try {
      const created = await meetingPrepAPI.create(f)
      await load()
      setOpenId(created.id)
      setDetail(null); setShowSource(false)
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '생성에 실패했습니다.')
    } finally {
      setCreating(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggle = async (p: MeetingPrep) => {
    if (openId === p.id) { setOpenId(null); setDetail(null); setShowSource(false); return }
    setOpenId(p.id); setDetail(null); setShowSource(false)
    try { setDetail(await meetingPrepAPI.get(p.id)) } catch { /* 목록의 content 로 대체 표시 */ }
  }

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('복사했습니다.') }
    catch { alert('복사에 실패했습니다.') }
  }

  const remove = async (p: MeetingPrep) => {
    if (!confirm(`'${p.title}' 문서를 삭제할까요?`)) return
    try { await meetingPrepAPI.remove(p.id); if (openId === p.id) { setOpenId(null); setDetail(null) } ; await load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '삭제 실패') }
  }

  const fmt = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="w-6 h-6 text-primary-orange" />
        <h1 className="text-xl font-bold text-gray-900">회의 준비</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <button onClick={() => fileRef.current?.click()} disabled={creating}
          className="w-full bg-primary-orange hover:bg-primary-orange/90 text-white rounded-xl py-3.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          {creating
            ? <><Loader2 size={16} className="animate-spin" /> AI가 회의 준비 문서를 만드는 중… (1~2분)</>
            : <><FileText size={16} /> 카카오톡 대화(.txt/.csv)로 회의 준비 만들기</>}
        </button>
        <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) create(f) }} />
        <p className="text-[11px] text-gray-400 mt-2 text-center">
          채팅방 메뉴 → 대화 내용 → 내보내기로 저장한 텍스트(.txt)나 CSV(.csv) 파일을 선택하면,
          회의 안건 · 결정할 것 · 챙길 것 · 미결사항을 정리해 줍니다. 관리자만 볼 수 있습니다.
        </p>
        {err && <p className="text-xs text-red-500 mt-2 text-center">{err}</p>}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">아직 만든 회의 준비 문서가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {items.map(p => {
            const open = openId === p.id
            const doc = (open && detail?.id === p.id) ? detail : p
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <button onClick={() => toggle(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {fmt(p.created_at)}{p.source_name ? ` · ${p.source_name}` : ''}{p.author_name ? ` · ${p.author_name}` : ''}
                    </p>
                  </div>
                  {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="text-[14px] text-gray-700 leading-[1.8] whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3.5">
                      {doc.content}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copy(doc.content)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
                        <Copy size={13} /> 복사
                      </button>
                      {detail?.id === p.id && detail.source_text && (
                        <button onClick={() => setShowSource(s => !s)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
                          <FileText size={13} /> {showSource ? '대화 원문 닫기' : '대화 원문 보기'}
                        </button>
                      )}
                      <button onClick={() => remove(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 border border-red-100 rounded-lg px-2.5 py-1.5 hover:bg-red-50 ml-auto">
                        <Trash2 size={13} /> 삭제
                      </button>
                    </div>
                    {showSource && detail?.id === p.id && detail.source_text && (
                      <div className="text-[12px] text-gray-500 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3.5 max-h-80 overflow-y-auto">
                        {detail.source_text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Check, History, Loader2, Pencil, RotateCcw, X } from 'lucide-react'
import { residentDocAPI, type DocSop, type DocSopHistory, type SopKey } from '@/api/residentDocClient'

/**
 * 처리 순서 안내문 — 보기 · 고치기 · 이력.
 *
 * ■ 왜 고칠 수 있어야 하는가
 *
 *   이 순서는 코드에 박혀 있었다. 그런데 실제로는 바뀐다 — 복지톡이 다른
 *   것으로 바뀌거나, 원본을 두는 자리가 바뀐다. 그때마다 배포를 기다려야 하면
 *   결국 종이에 따로 적어 붙이게 되고, 화면의 것은 틀린 채로 남는다.
 *
 * ■ 왜 이력이 필요한가
 *
 *   여러 사람이 그대로 따라 하는 절차다. 어느 날 한 줄이 사라졌는데 누가 왜
 *   지웠는지 모르면, 빠뜨린 것인지 일부러 뺀 것인지 판단할 수 없다.
 *   이력에서 그때 내용을 통째로 보고, 눌러서 되돌릴 수 있다.
 *
 * ■ 왜 저장 버튼을 두는가
 *
 *   다른 곳(메모·기록)은 칸을 벗어나면 저장하지만 여기는 다르다. 여러 사람이
 *   따라 하는 절차라, 고치다 만 상태가 그대로 남으면 그걸 보고 일한다.
 *   다 고친 뒤 한 번 눌러 확정하는 편이 안전하다.
 */
export default function SopEditor({ open }: { open: boolean }) {
  const [sop, setSop] = useState<Record<SopKey, DocSop> | null>(null)
  const [editing, setEditing] = useState<SopKey | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [histFor, setHistFor] = useState<SopKey | null>(null)
  const [hist, setHist] = useState<DocSopHistory[] | null>(null)

  useEffect(() => {
    if (!open || sop) return
    residentDocAPI.sop().then(setSop).catch(() => setSop(null))
  }, [open, sop])

  const startEdit = (k: SopKey) => { setEditing(k); setDraft(sop?.[k]?.content ?? '') }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const r = await residentDocAPI.saveSop(editing, draft)
      setSop(s => s && ({ ...s, [editing]: { content: r.content, updated_by: r.updated_by, updated_at: r.updated_at } }))
      setEditing(null)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '저장하지 못했습니다.')
    } finally { setBusy(false) }
  }

  const openHist = async (k: SopKey) => {
    setHistFor(k); setHist(null)
    try { setHist(await residentDocAPI.sopHistory(k)) } catch { setHist([]) }
  }

  /** 되돌리기 — 그때 내용을 편집칸에 올린다. 바로 저장하지는 않는다.
   *  눈으로 확인하고 저장하게 해야 잘못 되돌리는 일이 없다. */
  const restore = (h: DocSopHistory) => {
    if (!histFor) return
    setEditing(histFor); setDraft(h.content); setHistFor(null)
  }

  if (!open) return null

  const when = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : ''

  const block = (k: SopKey, title: string, mono: boolean) => {
    const v = sop?.[k]
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <p className="font-bold text-amber-800 text-sm">{title}</p>
          {v?.updated_by && (
            <span className="text-[10px] text-amber-600">{v.updated_by} {when(v.updated_at)} 수정</span>
          )}
          <button onClick={() => openHist(k)} title="바뀐 이력"
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-700 hover:text-amber-900">
            <History size={11} /> 이력
          </button>
          <button onClick={() => startEdit(k)} title="고치기"
            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-700 hover:text-amber-900">
            <Pencil size={11} /> 수정
          </button>
        </div>
        {editing === k ? (
          <div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={mono ? 11 : 4}
              className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-[13px] leading-relaxed resize-y focus:outline-none focus:border-amber-500" />
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-amber-700">여러 사람이 이 글을 보고 일합니다 — 다 고치신 뒤 저장해주세요</span>
              <button onClick={() => setEditing(null)} disabled={busy}
                className="ml-auto px-3 py-1.5 rounded-lg border border-amber-300 text-[11px] font-bold text-amber-800">취소</button>
              <button onClick={save} disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold disabled:opacity-40">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} 저장
              </button>
            </div>
          </div>
        ) : mono ? (
          <pre className="whitespace-pre-wrap text-[13px] text-amber-800 leading-relaxed font-sans">{v?.content ?? ''}</pre>
        ) : (
          <div className="bg-white rounded-lg p-2.5 text-[13px] text-gray-600 whitespace-pre-wrap">{v?.content ?? ''}</div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 text-sm space-y-3">
      {sop === null ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-amber-400" /></div>
      ) : (
        <>
          {block('renewal_sop', '★ 인정서·개장기 갱신 서류 도착 시 처리 순서 ★', true)}
          {block('renewal_sms', '보호자 안내 문자 예시', false)}
        </>
      )}

      {/* 이력 — 그때 내용을 통째로 보고 되돌린다 */}
      {histFor && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setHistFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
              <History size={15} className="text-gray-500" />
              <h3 className="text-sm font-bold text-gray-900">바뀐 이력</h3>
              <span className="text-[11px] text-gray-400">고치기 전 내용이 남습니다</span>
              <button onClick={() => setHistFor(null)} className="ml-auto text-gray-300 hover:text-gray-500"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {hist === null ? (
                <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
              ) : hist.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">아직 고친 적이 없습니다.</p>
              ) : hist.map(h => (
                <div key={h.id} className="rounded-xl border border-gray-200 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-gray-600">
                      {h.created_at ? new Date(h.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {h.changed_by && <span className="text-[11px] text-gray-400">{h.changed_by} 님이 고침</span>}
                    <button onClick={() => restore(h)}
                      title="이 내용을 편집칸에 올립니다 — 확인 후 저장하세요"
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50">
                      <RotateCcw size={11} /> 이 내용으로
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-[12px] text-gray-500 leading-relaxed font-sans max-h-40 overflow-y-auto">{h.content}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

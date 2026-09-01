import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Check, X } from 'lucide-react'
import { staffEvalAPI, type EvalConfig } from '@/api/staffEvalClient'

type Draft = { key?: string; label: string }

/**
 * 평가 항목·배점 설정 — 관리자만.
 *
 * 여기서 무엇을 바꾸든 **지난 평가는 그대로다.** 평가마다 그때의 항목과
 * 배점을 함께 저장해 두기 때문이다. 그걸 화면에도 적어 둔다 — 안 적어 두면
 * 지난 기록이 망가질까 봐 아무도 못 바꾼다.
 */
export default function StaffEvalSettings({ onClose, onSaved }: {
  onClose: () => void
  onSaved: () => void
}) {
  const [cfg, setCfg] = useState<EvalConfig | null>(null)
  const [items, setItems] = useState<Draft[]>([])
  const [max, setMax] = useState(5)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    staffEvalAPI.config()
      .then(c => { setCfg(c); setItems(c.items.map(i => ({ ...i }))); setMax(c.max_score) })
      .catch(() => setErr('설정을 불러오지 못했습니다'))
  }, [])

  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const n = [...items]
    ;[n[i], n[j]] = [n[j], n[i]]
    setItems(n)
  }

  const save = async () => {
    const cleaned = items.map(i => ({ ...i, label: i.label.trim() })).filter(i => i.label)
    if (cleaned.length === 0) { setErr('항목을 하나 이상 넣어주세요.'); return }
    setSaving(true); setErr('')
    try {
      await staffEvalAPI.saveConfig({ items: cleaned, max_score: max })
      onSaved(); onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? '저장하지 못했습니다')
    } finally { setSaving(false) }
  }

  const lim = cfg?.limits
  const total = items.filter(i => i.label.trim()).length * max

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">평가 항목·배점 설정</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!cfg ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
        ) : (
          <div className="p-5 space-y-4">
            {/* 이 안내가 없으면 지난 기록이 망가질까 봐 아무도 못 바꾼다 */}
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 leading-relaxed">
              여기서 바꿔도 <b>이미 매긴 평가는 그대로</b>입니다. 평가마다 그때의 항목과
              배점을 함께 저장해 두기 때문입니다. 바뀐 항목은 <b>다음에 저장하는 평가부터</b> 쓰입니다.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                항목당 배점 <span className="font-normal text-gray-400">({lim?.min_score}~{lim?.max_score})</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min={lim?.min_score} max={lim?.max_score} value={max}
                  onChange={e => setMax(Number(e.target.value))}
                  onFocus={e => e.currentTarget.select()}
                  className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                <span className="text-xs text-gray-500">점 만점 · 합계 <b className="text-gray-800">{total}점</b></span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                평가 항목 <span className="font-normal text-gray-400">
                  ({items.length}/{lim?.max_items}개 · 최대 {lim?.label_max}자)
                </span>
              </label>
              <div className="space-y-1.5">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-5 text-[11px] text-gray-300 text-right">{i + 1}</span>
                    <input value={it.label} maxLength={lim?.label_max}
                      onChange={e => setItems(s => s.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                      placeholder="항목 이름"
                      className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                    <button onClick={() => move(i, -1)} disabled={i === 0}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30" aria-label="위로">
                      <ArrowUp size={13} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30" aria-label="아래로">
                      <ArrowDown size={13} /></button>
                    <button onClick={() => setItems(s => s.filter((_, j) => j !== i))}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200" aria-label="지우기">
                      <Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              {items.length < (lim?.max_items ?? 20) && (
                <button onClick={() => setItems(s => [...s, { label: '' }])}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  <Plus size={13} /> 항목 추가
                </button>
              )}
            </div>

            {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 저장
              </button>
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">취소</button>
              {cfg.updated_by && (
                <span className="text-[11px] text-gray-400 ml-auto">마지막 수정 {cfg.updated_by}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

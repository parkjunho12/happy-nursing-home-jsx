import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'

export interface FieldSpec {
  key: string
  label: string
  type?: 'text' | 'date' | 'time' | 'select' | 'bool'
  options?: string[]
  required?: boolean
  placeholder?: string
}

interface Props {
  title: string
  base: string                       // 예: /api/v1/eval/carefor/residents
  fields: FieldSpec[]
  row: Record<string, any> | null    // null = 새로 추가
  onClose: () => void
  onSaved: () => void
}

/** 케어포 참고자료 공용 행 편집기 (추가 / 수정 / 삭제) */
export default function CareforRowEditor({ title, base, fields, row, onClose, onSaved }: Props) {
  const isEdit = !!row?.id
  const [f, setF] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {}
    fields.forEach(x => { init[x.key] = row?.[x.key] ?? (x.type === 'bool' ? true : '') })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

  const save = async () => {
    const miss = fields.find(x => x.required && !String(f[x.key] ?? '').trim())
    if (miss) { setErr(`${miss.label}을(를) 입력해주세요.`); return }
    setSaving(true); setErr('')
    try {
      const body: Record<string, any> = {}
      fields.forEach(x => { body[x.key] = x.type === 'bool' ? !!f[x.key] : (String(f[x.key] ?? '').trim() || null) })
      if (isEdit) await apiClient.patch(`${base}/${row!.id}`, body)
      else await apiClient.post(base, body)
      onSaved(); onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? '저장 실패')
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!isEdit || !confirm('이 행을 삭제할까요?')) return
    setSaving(true)
    try { await apiClient.delete(`${base}/${row!.id}`); onSaved(); onClose() }
    catch (e: any) { setErr(e?.response?.data?.detail ?? '삭제 실패') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{isEdit ? `${title} 수정` : `${title} 추가`}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {fields.map(x => (
            <div key={x.key}>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                {x.label}{x.required && <span className="text-red-400"> *</span>}
              </label>
              {x.type === 'bool' ? (
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={!!f[x.key]} onChange={e => setF({ ...f, [x.key]: e.target.checked })} className="accent-primary-orange" />
                  근무함
                </label>
              ) : x.type === 'select' ? (
                <select value={f[x.key] ?? ''} onChange={e => setF({ ...f, [x.key]: e.target.value })} className={inp}>
                  <option value="">선택</option>
                  {(x.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={x.type === 'date' ? 'date' : x.type === 'time' ? 'time' : 'text'}
                  value={f[x.key] ?? ''}
                  onChange={e => setF({ ...f, [x.key]: e.target.value })}
                  placeholder={x.placeholder}
                  className={inp}
                />
              )}
            </div>
          ))}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t">
          {isEdit && (
            <button onClick={del} disabled={saving}
              className="px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> 삭제
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg">취소</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-orange hover:bg-primary-orange/90 rounded-lg disabled:opacity-50">
            {saving ? '저장 중...' : isEdit ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

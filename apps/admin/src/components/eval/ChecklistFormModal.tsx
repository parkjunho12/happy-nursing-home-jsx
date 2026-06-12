import { useState } from 'react'
import { useLtcStore } from '@/store/ltc'
import type { ChecklistItem } from '@/utils/period'
import { RECURRING, EVENT_FREQS, FREQUENCY_LABELS } from '@/utils/period'

const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"
const ALL_FREQS = [...RECURRING, ...EVENT_FREQS]

interface Props {
  existing?: ChecklistItem   // 있으면 수정 모드, 없으면 추가 모드
  onClose: () => void
}

export default function ChecklistFormModal({ existing, onClose }: Props) {
  const { addChecklist, updateChecklist, domains, categories, indicators, residents, staffList } = useLtcStore()
  const isEdit = !!existing

  const [form, setForm] = useState({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    frequency: existing?.frequency ?? 'monthly',
    relatedDomainId: existing?.relatedDomainId ?? '',
    relatedCategoryId: existing?.relatedCategoryId ?? '',
    relatedIndicatorId: existing?.relatedIndicatorId ?? '',
    assignee: existing?.assignee ?? '',
    evidenceRequired: existing?.evidenceRequired ?? '',
    storageLocation: existing?.storageLocation ?? '',
    howTo: existing?.howTo ?? '',
    evalNote: existing?.evalNote ?? '',
    riskLevel: (existing?.riskLevel ?? 'medium') as 'low'|'medium'|'high',
    personId: existing?.personId ?? '',
    personType: (existing?.personType ?? 'facility') as string,
  })
  const [saving, setSaving] = useState(false)

  const filteredCategories = categories.filter(c => !form.relatedDomainId || c.domainId === form.relatedDomainId)
  const filteredIndicators = indicators.filter(i => !form.relatedCategoryId || i.categoryId === form.relatedCategoryId)

  const activeResidents = residents.filter(r => r.status === 'active')
  const activeStaff     = staffList.filter(s => s.status === 'active')

  // 수정 모드에서 대상 인물이 퇴소/퇴사자인 경우에도 목록에 표시되도록 보강
  const personOptions = (() => {
    const opts = { residents: [...activeResidents], staff: [...activeStaff] }
    if (existing?.personId && existing.personType === 'resident' && !opts.residents.some(r=>r.id===existing.personId)) {
      const found = residents.find(r=>r.id===existing.personId)
      if (found) opts.residents.push(found)
    }
    if (existing?.personId && existing.personType === 'staff' && !opts.staff.some(s=>s.id===existing.personId)) {
      const found = staffList.find(s=>s.id===existing.personId)
      if (found) opts.staff.push(found)
    }
    return opts
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      let personName: string | undefined
      if (form.personId) {
        personName = personOptions.residents.find(r=>r.id===form.personId)?.name
          ?? personOptions.staff.find(s=>s.id===form.personId)?.name
      }

      if (isEdit && existing) {
        await updateChecklist(existing.id, {
          title: form.title,
          description: form.description,
          frequency: form.frequency as any,
          relatedIndicatorId: form.relatedIndicatorId,
          relatedCategoryId: form.relatedCategoryId,
          relatedDomainId: form.relatedDomainId,
          assignee: form.assignee,
          evidenceRequired: form.evidenceRequired,
          storageLocation: form.storageLocation,
          howTo: form.howTo,
          evalNote: form.evalNote,
          riskLevel: form.riskLevel,
          personId: form.personId || undefined,
          personName: form.personId ? personName : undefined,
          personType: form.personId ? form.personType : 'facility',
        })
      } else {
        await addChecklist({
          title: form.title,
          description: form.description,
          frequency: form.frequency as any,
          relatedIndicatorId: form.relatedIndicatorId,
          relatedCategoryId: form.relatedCategoryId,
          relatedDomainId: form.relatedDomainId,
          assignee: form.assignee,
          evidenceRequired: form.evidenceRequired,
          storageLocation: form.storageLocation,
          howTo: form.howTo,
          evalNote: form.evalNote,
          riskLevel: form.riskLevel,
          active: true,
          memo: '',
          attachmentName: '',
          completed: false,
          personId: form.personId || undefined,
          personName,
          personType: form.personId ? form.personType : 'facility',
        } as any)
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 border-b flex items-center justify-between z-10">
          <h2 className="font-bold text-gray-900">{isEdit ? '체크리스트 항목 수정' : '새 체크리스트 항목 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">항목명 *</label>
            <input required className={ic} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="예: 야간점검일지 작성"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">설명</label>
            <textarea className={ic} rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">반복 주기 *</label>
              <select className={ic} value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value as any})}>
                {ALL_FREQS.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f as any]}</option>)}
              </select>
              {isEdit && (
                <p className="text-[11px] text-gray-400 mt-1">⚠️ 주기를 변경하면 기존 완료 이력의 표시 방식이 달라질 수 있습니다.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">위험도</label>
              <select className={ic} value={form.riskLevel} onChange={e=>setForm({...form,riskLevel:e.target.value as any})}>
                <option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option>
              </select>
            </div>
          </div>

          {/* 평가지표 연결 */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-semibold text-gray-500">평가지표 연결 (선택)</p>
            <div className="grid grid-cols-3 gap-2">
              <select className={ic} value={form.relatedDomainId} onChange={e=>setForm({...form,relatedDomainId:e.target.value,relatedCategoryId:'',relatedIndicatorId:''})}>
                <option value="">영역 선택</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={ic} value={form.relatedCategoryId} onChange={e=>setForm({...form,relatedCategoryId:e.target.value,relatedIndicatorId:''})} disabled={!form.relatedDomainId}>
                <option value="">항목 선택</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={ic} value={form.relatedIndicatorId} onChange={e=>setForm({...form,relatedIndicatorId:e.target.value})} disabled={!form.relatedCategoryId}>
                <option value="">지표 선택</option>
                {filteredIndicators.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>

          {/* 담당자/대상 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자</label>
              <input className={ic} value={form.assignee} onChange={e=>setForm({...form,assignee:e.target.value})} placeholder="예: 사회복지사"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">대상 (개인별)</label>
              <select className={ic} value={form.personId} onChange={e => {
                const id = e.target.value
                const isRes = personOptions.residents.some(r=>r.id===id)
                setForm({...form, personId:id, personType: id ? (isRes?'resident':'staff') : 'facility'})
              }}>
                <option value="">시설 공통</option>
                {personOptions.residents.length>0 && <optgroup label="수급자">{personOptions.residents.map(r=><option key={r.id} value={r.id}>{r.name}{r.status==='discharged'?' (퇴소)':''}</option>)}</optgroup>}
                {personOptions.staff.length>0 && <optgroup label="직원">{personOptions.staff.map(s=><option key={s.id} value={s.id}>{s.name}{s.status==='resigned'?' (퇴사)':''}</option>)}</optgroup>}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">필요한 증빙자료</label>
            <input className={ic} value={form.evidenceRequired} onChange={e=>setForm({...form,evidenceRequired:e.target.value})} placeholder="예: 점검일지, 사진, 서명부"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">보관 위치</label>
            <input className={ic} value={form.storageLocation} onChange={e=>setForm({...form,storageLocation:e.target.value})} placeholder="예: 안전관리대장 > 환기점검"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">어떻게 해야 하나요?</label>
            <textarea className={ic} rows={2} value={form.howTo} onChange={e=>setForm({...form,howTo:e.target.value})} placeholder="수행 방법을 구체적으로 작성하세요"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">평가 시 유의사항</label>
            <textarea className={ic} rows={2} value={form.evalNote} onChange={e=>setForm({...form,evalNote:e.target.value})} placeholder="감점 기준, 주의할 점 등"/>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50">
              {saving ? '저장 중...' : isEdit ? '수정 완료' : '추가하기'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm">취소</button>
          </div>
        </form>
      </div>
    </div>
  )
}

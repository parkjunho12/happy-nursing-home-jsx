import DateField from '@/components/ui/DateField'
import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/api/client'
import type { ChecklistItem } from '@/utils/period'
import { RECURRING, EVENT_FREQS, FREQUENCY_LABELS, FREQUENCY_COLORS } from '@/utils/period'

const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/40"

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']  // index 0=일..6=토
const WEEK_OF_MONTH = [
  { v: 1, label: '첫째 주' }, { v: 2, label: '둘째 주' }, { v: 3, label: '셋째 주' },
  { v: 4, label: '넷째 주' }, { v: 5, label: '마지막 주' },
]

// 주기 그룹 정의
const FREQ_GROUPS = [
  {
    label: '정기 반복',
    options: RECURRING,
  },
  {
    label: '일회성',
    options: ['one_time'],
  },
  {
    label: '이벤트 (자동 생성)',
    options: EVENT_FREQS,
    disabled: true,
  },
]

interface Props {
  existing?: ChecklistItem
  onClose: () => void
}

export default function ChecklistFormModal({ existing, onClose }: Props) {
  const { addChecklist, updateChecklist, domains, categories, indicators, residents, staffList } = useLtcStore()
  const { user } = useAuthStore()
  const isEdit = !!existing

  // 담당자(계정) 후보 목록 + 선택값 (기본값: 본인)
  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ id: string; name: string; position?: string | null }>
  >([])
  // 신규 생성 시: 관리자는 '지정 안 함'(기존 동작 유지), 직원은 본인이 기본값
  const isAdmin = user?.role === 'ADMIN'
  const [assignedUserId, setAssignedUserId] = useState<string>(
    (existing as any)?.assigned_user_id ?? (isAdmin ? '' : (user?.id ?? '')),
  )

  useEffect(() => {
    apiClient
      .get('/api/v1/users/assignee-options')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? []
        setAssigneeOptions(data)
      })
      .catch(err => console.error('assignee-options 로드 실패:', err))
  }, [])

  const [form, setForm] = useState({
    title:              existing?.title              ?? '',
    description:        existing?.description        ?? '',
    frequency:          existing?.frequency          ?? 'monthly',
    dueDate:            existing?.dueDate            ?? '',
    relatedDomainId:    existing?.relatedDomainId    ?? '',
    relatedCategoryId:  existing?.relatedCategoryId  ?? '',
    relatedIndicatorId: existing?.relatedIndicatorId ?? '',
    assignee:           existing?.assignee           ?? '',
    evidenceRequired:   existing?.evidenceRequired   ?? '',
    storageLocation:    existing?.storageLocation    ?? '',
    howTo:              existing?.howTo              ?? '',
    evalNote:           existing?.evalNote           ?? '',
    riskLevel:          (existing?.riskLevel ?? 'medium') as 'low' | 'medium' | 'high',
    personId:           existing?.personId           ?? '',
    personType:         (existing?.personType        ?? 'facility') as string,
    recurWeekday:       (existing?.recurWeekday     ?? 0) as number,
    recurWeekOfMonth:   (existing?.recurWeekOfMonth ?? 1) as number,
    monthlyRange:       !!(existing?.frequency === 'monthly' && (existing?.recurDay || existing?.recurDueDay)),
    recurDay:           (existing?.recurDay         ?? 1) as number,
    recurDueDay:        (existing?.recurDueDay      ?? 25) as number,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const isOneTime  = form.frequency === 'one_time'
  const isEvent    = EVENT_FREQS.includes(form.frequency as any)
  const isWeeklyDow     = form.frequency === 'weekly_dow'
  const isMonthlyDay    = form.frequency === 'monthly_day'
  const isMonthlyNthDow = form.frequency === 'monthly_nth_dow'

  const filteredCategories = categories.filter(c => !form.relatedDomainId || c.domainId === form.relatedDomainId)
  const filteredIndicators = indicators.filter(i => !form.relatedCategoryId || i.categoryId === form.relatedCategoryId)

  const activeResidents = residents.filter(r => r.status === 'active')
  const activeStaff     = staffList.filter(s => s.status === 'active')

  // 수정 모드: 퇴소/퇴사자도 목록에 유지
  const personOptions = (() => {
    const opts = { residents: [...activeResidents], staff: [...activeStaff] }
    if (existing?.personId && existing.personType === 'resident' && !opts.residents.some(r => r.id === existing.personId)) {
      const found = residents.find(r => r.id === existing.personId)
      if (found) opts.residents.push(found)
    }
    if (existing?.personId && existing.personType === 'staff' && !opts.staff.some(s => s.id === existing.personId)) {
      const found = staffList.find(s => s.id === existing.personId)
      if (found) opts.staff.push(found)
    }
    return opts
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('항목명을 입력하세요.'); return }
    if (isOneTime && !form.dueDate) { setError('일회성 항목은 기한 날짜가 필요합니다.'); return }

    setSaving(true)
    try {
      const personName = form.personId
        ? (personOptions.residents.find(r => r.id === form.personId)?.name
          ?? personOptions.staff.find(s => s.id === form.personId)?.name)
        : undefined

      const payload = {
        title:              form.title,
        description:        form.description,
        frequency:          form.frequency as any,
        dueDate:            isOneTime ? (form.dueDate || undefined) : undefined,
        relatedIndicatorId: form.relatedIndicatorId,
        relatedCategoryId:  form.relatedCategoryId,
        relatedDomainId:    form.relatedDomainId,
        assignee:           form.assignee,
        assigned_user_id:   assignedUserId || null,
        evidenceRequired:   form.evidenceRequired,
        storageLocation:    form.storageLocation,
        howTo:              form.howTo,
        evalNote:           form.evalNote,
        riskLevel:          form.riskLevel,
        personId:           form.personId || undefined,
        personName:         form.personId ? personName : undefined,
        personType:         form.personId ? form.personType : 'facility',
        recurWeekday:       (isWeeklyDow || isMonthlyNthDow) ? Number(form.recurWeekday) : null,
        recurWeekOfMonth:   isMonthlyNthDow ? Number(form.recurWeekOfMonth) : null,
        recurDay:           isMonthlyDay ? Number(form.recurDay) : (form.frequency === 'monthly' && form.monthlyRange ? Number(form.recurDay) : null),
        recurDueDay:        isMonthlyDay ? Number(form.recurDueDay) : (form.frequency === 'monthly' && form.monthlyRange ? Number(form.recurDueDay) : null),
      }

      if (isEdit && existing) {
        await updateChecklist(existing.id, payload)
      } else {
        await addChecklist({
          ...payload,
          active:           true,
          memo:             '',
          attachmentName:   '',
          completed:        false,
          completionHistory: [],
          occurrences:      [],
        } as any)
      }
      onClose()
    } catch (e: any) {
      setError(e?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b flex items-center justify-between z-10">
          <h2 className="font-bold text-gray-900">
            {isEdit ? '체크리스트 항목 수정' : '새 체크리스트 항목 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 에러 */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={14} className="flex-shrink-0"/>
              {error}
            </div>
          )}

          {/* 항목명 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">항목명 *</label>
            <input
              required className={ic}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="예: 6월 직원 교육 이수 확인"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">설명</label>
            <textarea className={ic} rows={2} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* 주기 + 기한 (one_time) + 위험도 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* 주기 선택 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">반복 주기 *</label>
                <select
                  className={ic}
                  value={form.frequency}
                  onChange={e => setForm({ ...form, frequency: e.target.value as any, dueDate: '' })}
                >
                  {FREQ_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map(f => (
                        <option key={f} value={f} disabled={group.disabled}>
                          {FREQUENCY_LABELS[f as any] ?? f}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {isEdit && (
                  <p className="text-[11px] text-gray-400 mt-1">⚠️ 주기 변경 시 기존 이력 표시가 달라질 수 있습니다.</p>
                )}
              </div>

              {/* 위험도 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">위험도</label>
                <select className={ic} value={form.riskLevel}
                  onChange={e => setForm({ ...form, riskLevel: e.target.value as any })}>
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
            </div>

            {/* 일회성 기한 입력 */}
            {isOneTime && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FREQUENCY_COLORS['one_time']}`}>일회성</span>
                  <p className="text-xs text-amber-700 font-medium">기한까지만 표시되고, 이후엔 자동으로 사라집니다.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">기한 날짜 *</label>
                  <DateField
                    className={ic}
                    value={form.dueDate}
                    onChange={v => setForm({ ...form, dueDate: v })}
                  />
                </div>
              </div>
            )}

            {/* 이벤트성 안내 */}
            {isEvent && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 text-xs text-blue-700">
                ℹ️ 이벤트 주기는 입소·퇴소·입사 시 자동 생성됩니다. 직접 추가가 필요한 경우에만 선택하세요.
              </div>
            )}

            {/* 매주 특정 요일 */}
            {isWeeklyDow && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 space-y-2">
                <label className="block text-xs font-semibold text-gray-600">반복 요일 *</label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map((w, i) => (
                    <button key={i} type="button"
                      onClick={() => setForm({ ...form, recurWeekday: i })}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                        form.recurWeekday === i ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-green-100'
                      }`}>
                      {w}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-green-700">매주 {WEEKDAYS[form.recurWeekday]}요일에 생성·완료하는 항목입니다.</p>
              </div>
            )}

            {/* 매월 생성일 + 기한일 */}
            {isMonthlyDay && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">생성일 (매월) *</label>
                  <select className={ic} value={form.recurDay}
                    onChange={e => setForm({ ...form, recurDay: Number(e.target.value) })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}일</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">기한일 (매월) *</label>
                  <select className={ic} value={form.recurDueDay}
                    onChange={e => setForm({ ...form, recurDueDay: Number(e.target.value) })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}일</option>
                    ))}
                  </select>
                </div>
                <p className="col-span-2 text-[11px] text-purple-700">
                  매월 {form.recurDay}일에 생성되어 {form.recurDueDay}일까지가 기한입니다.
                </p>
              </div>
            )}

            {/* 월별 — 선택적 기간 지정 (매월 X일부터 Y일까지) */}
            {form.frequency === 'monthly' && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.monthlyRange}
                    onChange={e => setForm({ ...form, monthlyRange: e.target.checked })}
                    className="w-4 h-4 accent-purple-600" />
                  기간 지정 — 매월 언제부터 언제까지 해야 하는 업무예요
                </label>
                {form.monthlyRange && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">시작일 (매월)</label>
                      <select className={ic} value={form.recurDay}
                        onChange={e => setForm({ ...form, recurDay: Number(e.target.value) })}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">종료일 (매월)</label>
                      <select className={ic} value={form.recurDueDay}
                        onChange={e => setForm({ ...form, recurDueDay: Number(e.target.value) })}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
                      </select>
                    </div>
                    <p className="col-span-2 text-[11px] text-purple-700">
                      매월 <b>{form.recurDay}일 ~ {form.recurDueDay}일</b> 사이에 완료해야 하는 항목으로 표시됩니다 — 달력 보기에도 이 기간이 막대로 나와요.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 매월 N째 주 특정 요일 */}
            {isMonthlyNthDow && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">몇째 주 *</label>
                  <select className={ic} value={form.recurWeekOfMonth}
                    onChange={e => setForm({ ...form, recurWeekOfMonth: Number(e.target.value) })}>
                    {WEEK_OF_MONTH.map(w => <option key={w.v} value={w.v}>{w.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">요일 *</label>
                  <select className={ic} value={form.recurWeekday}
                    onChange={e => setForm({ ...form, recurWeekday: Number(e.target.value) })}>
                    {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}요일</option>)}
                  </select>
                </div>
                <p className="col-span-2 text-[11px] text-purple-700">
                  매월 {WEEK_OF_MONTH.find(w => w.v === form.recurWeekOfMonth)?.label} {WEEKDAYS[form.recurWeekday]}요일에 생성됩니다.
                </p>
              </div>
            )}
          </div>

          {/* 평가지표 연결 */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-semibold text-gray-500">평가지표 연결 (선택)</p>
            <div className="grid grid-cols-3 gap-2">
              <select className={ic} value={form.relatedDomainId}
                onChange={e => setForm({ ...form, relatedDomainId: e.target.value, relatedCategoryId: '', relatedIndicatorId: '' })}>
                <option value="">영역 선택</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className={ic} value={form.relatedCategoryId} disabled={!form.relatedDomainId}
                onChange={e => setForm({ ...form, relatedCategoryId: e.target.value, relatedIndicatorId: '' })}>
                <option value="">항목 선택</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={ic} value={form.relatedIndicatorId} disabled={!form.relatedCategoryId}
                onChange={e => setForm({ ...form, relatedIndicatorId: e.target.value })}>
                <option value="">지표 선택</option>
                {filteredIndicators.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>

          {/* 담당자 / 대상자 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자 지정</label>
              <select
                className={ic}
                value={assignedUserId}
                onChange={e => {
                  const id = e.target.value
                  setAssignedUserId(id)
                  const picked = assigneeOptions.find(o => o.id === id)
                  setForm({ ...form, assignee: picked ? picked.name : '' })
                }}
              >
                <option value="">지정 안 함</option>
                {assigneeOptions.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name}{o.position ? ` (${o.position})` : ''}{user && o.id === user.id ? ' · 나' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">지정된 담당자 계정에만 이 항목이 보입니다.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">대상 (개인별)</label>
              <select className={ic} value={form.personId}
                onChange={e => {
                  const id = e.target.value
                  const isRes = personOptions.residents.some(r => r.id === id)
                  setForm({ ...form, personId: id, personType: id ? (isRes ? 'resident' : 'staff') : 'facility' })
                }}>
                <option value="">시설 공통</option>
                {personOptions.residents.length > 0 && (
                  <optgroup label="수급자">
                    {personOptions.residents.map(r => (
                      <option key={r.id} value={r.id}>{r.name}{r.status === 'discharged' ? ' (퇴소)' : ''}</option>
                    ))}
                  </optgroup>
                )}
                {personOptions.staff.length > 0 && (
                  <optgroup label="직원">
                    {personOptions.staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.status === 'resigned' ? ' (퇴사)' : ''}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* 증빙 / 보관 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">필요한 증빙자료</label>
            <input className={ic} value={form.evidenceRequired}
              onChange={e => setForm({ ...form, evidenceRequired: e.target.value })}
              placeholder="예: 점검일지, 사진, 서명부"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">보관 위치</label>
            <input className={ic} value={form.storageLocation}
              onChange={e => setForm({ ...form, storageLocation: e.target.value })}
              placeholder="예: 안전관리대장 > 환기점검"
            />
          </div>

          {/* 수행 방법 / 평가 유의사항 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">어떻게 해야 하나요?</label>
            <textarea className={ic} rows={2} value={form.howTo}
              onChange={e => setForm({ ...form, howTo: e.target.value })}
              placeholder="수행 방법을 구체적으로 작성하세요"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">평가 시 유의사항</label>
            <textarea className={ic} rows={2} value={form.evalNote}
              onChange={e => setForm({ ...form, evalNote: e.target.value })}
              placeholder="감점 기준, 주의할 점 등"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={saving || (isOneTime && !form.dueDate)}
              className="flex-1 bg-primary-orange text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-orange/90 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : isEdit ? '수정 완료' : '추가하기'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

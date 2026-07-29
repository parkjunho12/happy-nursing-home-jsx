import { create } from 'zustand'
import {
  evalChecklistAPI,
  evalResidentsAPI,
  evalStaffAPI,
  evalIndicatorsAPI,
  evalSettingsAPI,
  occurrenceAPI,
} from '@/api/evalClient'
import {
  generateResidentAdmissionChecklists,
  generateResidentDischargeChecklists,
  generateStaffHireChecklists,
} from '@/lib/checklistTemplates'
import { normalizeFrequency } from '@/utils/period'

// ── 타입 ────────────────────────────────────────────────────────────────

export interface CompletionRecord {
  periodKey: string
  completedDate: string
  memo: string
  attachmentName: string
}

export interface ChecklistItem {
  id: string
  title: string
  description: string
  frequency: string
  relatedIndicatorId: string
  relatedCategoryId: string
  relatedDomainId: string
  assignee: string
  assigned_user_id?: string | null
  recurWeekday?: number | null
  recurWeekOfMonth?: number | null
  recurDay?: number | null
  recurDueDay?: number | null
  evidenceRequired: string
  storageLocation: string
  howTo: string
  evalNote: string
  riskLevel: 'low' | 'medium' | 'high'
  active: boolean
  memo: string
  attachmentName: string
  completed: boolean
  completedDate?: string
  lastCheckedDate?: string
  completionHistory: CompletionRecord[]
  occurrences: ChecklistOccurrence[]   // 신규 — 없으면 [], 있으면 우선 사용
  dueDate?: string         // one_time 기한
  personId?: string
  personName?: string
  personType?: string
  templateId?: string
  createdAt: string
}

export interface LtcResident {
  id: string; name: string; birthDate: string; gender: string
  admissionDate: string; dischargeDate?: string; careGradeStartDate: string
  grade?: string; certEnd?: string
  floor?: string
  status: string; memo: string; createdAt: string
  room?: string
}

export interface LtcStaff {
  id: string; name: string; birthDate: string; gender: string
  hireDate: string; resignDate?: string; position?: string
  residentNo?: string; address?: string; addressDetail?: string; phone?: string; licenseDate?: string; licenseNo?: string; bankAccount?: string
  leaves?: { start?: string | null; end?: string | null; reason?: string | null }[]
  status: string; memo: string; createdAt: string
}

export interface EvalDomain     { id: string; name: string; color: string; active: boolean }
export interface EvalCategory   { id: string; domainId: string; name: string; questionCount: number; totalScore: number; active: boolean }
export interface EvalIndicator  { id: string; categoryId: string; name: string; score: number; criteria: string; evidenceList: string[]; active: boolean }
export interface EvalSettings   { facilityName: string; evalYear: number; alertDaysBeforeDue: number; longInactiveThresholdDays: number }

export interface ChecklistOccurrence {
  id: string
  checklistItemId: string
  periodKey: string
  frequency: string
  scheduledDate: string
  dueDate: string
  status: 'pending' | 'completed' | 'overdue' | 'in_progress'
  startedBy?: string
  completedDate?: string
  memo: string
  attachmentName: string
  createdAt: string
  updatedAt: string
}

// ── 매핑 헬퍼 ────────────────────────────────────────────────────────────

function mapOcc(raw: any): ChecklistOccurrence {
  return {
    id:              raw.id,
    checklistItemId: raw.checklist_item_id,
    periodKey:       raw.period_key,
    frequency:       normalizeFrequency(raw.frequency),
    scheduledDate:   raw.scheduled_date,
    dueDate:         raw.due_date,
    status:          raw.status,
    startedBy:       raw.started_by ?? undefined,
    completedDate:   raw.completed_date ?? undefined,
    memo:            raw.memo ?? '',
    attachmentName:  raw.attachment_name ?? '',
    createdAt:       raw.created_at ?? '',
    updatedAt:       raw.updated_at ?? '',
  }
}

function mapCL(raw: any): ChecklistItem {
  return {
    id: raw.id, title: raw.title, description: raw.description ?? '',
    frequency: normalizeFrequency(raw.frequency),
    relatedIndicatorId: raw.related_indicator_id ?? '',
    relatedCategoryId:  raw.related_category_id  ?? '',
    relatedDomainId:    raw.related_domain_id    ?? '',
    assignee:        raw.assignee        ?? '',
    assigned_user_id: raw.assigned_user_id ?? null,
    recurWeekday:     raw.recur_weekday        ?? null,
    recurWeekOfMonth: raw.recur_week_of_month  ?? null,
    recurDay:         raw.recur_day            ?? null,
    recurDueDay:      raw.recur_due_day        ?? null,
    evidenceRequired:raw.evidence_required ?? '',
    storageLocation: raw.storage_location  ?? '',
    howTo:           raw.how_to           ?? '',
    evalNote:        raw.eval_note        ?? '',
    riskLevel:       raw.risk_level       ?? 'medium',
    active:          raw.active           ?? true,
    memo:            raw.memo             ?? '',
    attachmentName:  raw.attachment_name  ?? '',
    completed:       raw.completed        ?? false,
    completedDate:   raw.completed_date   ?? undefined,
    lastCheckedDate: raw.last_checked_date ?? undefined,
    personId:        raw.person_id        ?? undefined,
    personName:      raw.person_name      ?? undefined,
    personType:      raw.person_type      ?? 'facility',
    templateId:      raw.template_id      ?? undefined,
    createdAt:       raw.created_at       ?? '',
    dueDate:         raw.due_date          ?? undefined,
    completionHistory: (raw.completion_history ?? []).map((r: any) => ({
      periodKey:      r.period_key,
      completedDate:  r.completed_date,
      memo:           r.memo           ?? '',
      attachmentName: r.attachment_name ?? '',
    })),
    // 신규: occurrence 이력 (없으면 빈 배열, 있으면 우선 사용)
    occurrences: (raw.occurrences ?? []).map(mapOcc),
  }
}
function mapR(raw: any): LtcResident {
  return { id:raw.id, name:raw.name, birthDate:raw.birth_date, gender:raw.gender,
    admissionDate:raw.admission_date, dischargeDate:raw.discharge_date,
    careGradeStartDate:raw.care_grade_start_date, floor:raw.floor??undefined, room:(raw as any).room??undefined, status:raw.status,
    memo:raw.memo??'', createdAt:raw.created_at??'' }
}
function mapS(raw: any): LtcStaff {
  return { id:raw.id, name:raw.name, birthDate:raw.birth_date, gender:raw.gender,
    hireDate:raw.hire_date, resignDate:raw.resign_date, position:raw.position??undefined,
    residentNo:raw.resident_no??undefined, address:raw.address??undefined, addressDetail:raw.address_detail??undefined, phone:raw.phone??undefined,
    licenseDate:raw.license_date??undefined, licenseNo:raw.license_no??undefined, bankAccount:raw.bank_account??undefined,
    leaves:raw.leaves??undefined,
    status:raw.status, memo:raw.memo??'', createdAt:raw.created_at??'' }
}
function mapSettings(raw: any): EvalSettings {
  return { facilityName:raw.facility_name, evalYear:raw.eval_year,
    alertDaysBeforeDue:raw.alert_days_before_due,
    longInactiveThresholdDays:raw.long_inactive_threshold_days }
}
function clPayload(item: Omit<ChecklistItem,'id'|'createdAt'|'completionHistory'>) {
  return {
    title:item.title, description:item.description, frequency:item.frequency,
    related_indicator_id:item.relatedIndicatorId, related_category_id:item.relatedCategoryId,
    related_domain_id:item.relatedDomainId, assignee:item.assignee,
    assigned_user_id:(item as any).assigned_user_id ?? null,
    recur_weekday:(item as any).recurWeekday ?? null,
    recur_week_of_month:(item as any).recurWeekOfMonth ?? null,
    recur_day:(item as any).recurDay ?? null,
    recur_due_day:(item as any).recurDueDay ?? null,
    evidence_required:item.evidenceRequired, storage_location:item.storageLocation,
    how_to:item.howTo, eval_note:item.evalNote, risk_level:item.riskLevel,
    memo:item.memo, attachment_name:item.attachmentName,
    person_id:item.personId, person_name:item.personName,
    person_type:item.personType, template_id:item.templateId,
    due_date:(item as any).dueDate || null,
  }
}

// ── 스토어 ───────────────────────────────────────────────────────────────

interface LtcState {
  checklists:   ChecklistItem[]
  residents:    LtcResident[]
  staffList:    LtcStaff[]
  domains:      EvalDomain[]
  categories:   EvalCategory[]
  indicators:   EvalIndicator[]
  settings:     EvalSettings
  occurrences:  ChecklistOccurrence[]   // 신규
  loaded:       boolean
  loading:      boolean

  loadAll:           () => Promise<void>
  syncOccurrences:   () => Promise<void>   // 신규
  reset:             () => void            // 로그아웃 시 캐시 초기화
  completeOccurrence:   (id: string, completedDate: string, memo?: string, attachmentName?: string) => Promise<void>
  uncompleteOccurrence: (id: string) => Promise<void>
  addChecklist:      (item: Omit<ChecklistItem,'id'|'createdAt'|'completionHistory'>) => Promise<ChecklistItem>
  updateChecklist:   (id: string, u: Partial<ChecklistItem>) => Promise<void>
  setProgress:       (id: string, on: boolean) => Promise<void>
  deleteChecklist:   (id: string) => Promise<void>
  toggleComplete:    (id: string, completed?: boolean) => Promise<void>
  addResident:       (r: Omit<LtcResident,'id'|'createdAt'>) => Promise<void>
  updateResident:    (id: string, u: Partial<LtcResident>) => Promise<void>
  dischargeResident: (id: string, date: string) => Promise<void>
  deleteResident:    (id: string) => Promise<void>
  addStaff:          (s: Omit<LtcStaff,'id'|'createdAt'>) => Promise<void>
  updateStaff:       (id: string, u: Partial<LtcStaff>) => Promise<void>
  resignStaff:       (id: string, date: string) => Promise<void>
  updateSettings:    (u: Partial<EvalSettings>) => Promise<void>
}

const DEFAULT_SETTINGS: EvalSettings = { facilityName:'행복한 요양원', evalYear:2025, alertDaysBeforeDue:7, longInactiveThresholdDays:14 }

export const useLtcStore = create<LtcState>((set, get) => ({
  checklists:[], residents:[], staffList:[], domains:[], categories:[], indicators:[],
  settings: DEFAULT_SETTINGS, occurrences: [], loaded:false, loading:false,

  loadAll: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const [cls, res, stf, doms, cats, inds, settings, occs] = await Promise.all([
        evalChecklistAPI.list({ active_only: false }),
        evalResidentsAPI.list(),
        evalStaffAPI.list(),
        evalIndicatorsAPI.domains(),
        evalIndicatorsAPI.categories(),
        evalIndicatorsAPI.indicators(),
        evalSettingsAPI.get(),
        occurrenceAPI.list().catch(() => []),  // occurrence는 실패해도 무시
      ])
      set({
        checklists:  cls.map(mapCL),
        residents:   res.map(mapR),
        staffList:   stf.map(mapS),
        domains:     doms.map((d:any) => ({ id:d.id, name:d.name, color:d.color, active:d.active })),
        categories:  cats.map((c:any) => ({ id:c.id, domainId:c.domain_id, name:c.name, questionCount:c.question_count, totalScore:c.total_score, active:c.active })),
        indicators:  inds.map((i:any) => ({ id:i.id, categoryId:i.category_id, name:i.name, score:i.score, criteria:i.criteria, evidenceList:i.evidence_list??[], active:i.active })),
        settings:    mapSettings(settings),
        occurrences: occs.map(mapOcc),
        loaded:      true,
      })
    } catch(e) { console.error('[LTC] loadAll failed', e) }
    finally { set({ loading: false }) }
  },

  reset: () => {
    set({
      checklists: [], residents: [], staffList: [], domains: [],
      categories: [], indicators: [], occurrences: [],
      loaded: false, loading: false,
    })
  },

  syncOccurrences: async () => {
    try {
      await occurrenceAPI.sync()
      const occs = await occurrenceAPI.list()
      set({ occurrences: occs.map(mapOcc) })
    } catch(e) { console.error('[LTC] syncOccurrences failed', e) }
  },

  completeOccurrence: async (id, completedDate, memo='', attachmentName='') => {
    const raw = await occurrenceAPI.complete(id, { completed_date: completedDate, memo, attachment_name: attachmentName })
    set(s => ({ occurrences: s.occurrences.map(o => o.id===id ? mapOcc(raw) : o) }))
    // checklist 상태도 갱신
    const updated = await evalChecklistAPI.list({ active_only: false }).catch(() => null)
    if (updated) set(_s => ({ checklists: updated.map(mapCL) }))
  },

  uncompleteOccurrence: async (id) => {
    const raw = await occurrenceAPI.uncomplete(id)
    set(s => ({ occurrences: s.occurrences.map(o => o.id===id ? mapOcc(raw) : o) }))
    const updated = await evalChecklistAPI.list({ active_only: false }).catch(() => null)
    if (updated) set(_s => ({ checklists: updated.map(mapCL) }))
  },

  addChecklist: async (item) => {
    const raw = await evalChecklistAPI.create(clPayload({ ...item, completionHistory:[] } as any))
    const newItem = mapCL(raw)
    set(s => ({ checklists: [...s.checklists, newItem] }))

    // 백엔드에서 occurrence를 생성했으므로 해당 아이템 occurrence를 당겨온다
    const newOccs = await occurrenceAPI.list({ checklist_item_id: newItem.id }).catch(() => [])
    if (newOccs.length > 0) {
      set(s => ({ occurrences: [...s.occurrences.filter(o => o.checklistItemId !== newItem.id), ...newOccs.map(mapOcc)] }))
    }
    return newItem
  },
  updateChecklist: async (id, u) => {
    const p: any = {}
    if (u.title !== undefined)            p.title             = u.title
    if (u.description !== undefined)      p.description       = u.description
    if (u.frequency !== undefined)        p.frequency         = u.frequency
    if ((u as any).dueDate !== undefined) p.due_date          = (u as any).dueDate || null
    if (u.relatedDomainId !== undefined)  p.related_domain_id = u.relatedDomainId
    if (u.relatedCategoryId !== undefined)p.related_category_id = u.relatedCategoryId
    if (u.relatedIndicatorId !== undefined) p.related_indicator_id = u.relatedIndicatorId
    if (u.assignee !== undefined)         p.assignee          = u.assignee
    if ((u as any).assigned_user_id !== undefined) p.assigned_user_id = (u as any).assigned_user_id || null
    if ((u as any).recurWeekday !== undefined)     p.recur_weekday       = (u as any).recurWeekday
    if ((u as any).recurWeekOfMonth !== undefined) p.recur_week_of_month = (u as any).recurWeekOfMonth
    if ((u as any).recurDay !== undefined)         p.recur_day           = (u as any).recurDay
    if ((u as any).recurDueDay !== undefined)      p.recur_due_day       = (u as any).recurDueDay
    if (u.evidenceRequired !== undefined) p.evidence_required = u.evidenceRequired
    if (u.storageLocation !== undefined)  p.storage_location  = u.storageLocation
    if (u.howTo !== undefined)            p.how_to            = u.howTo
    if (u.evalNote !== undefined)         p.eval_note         = u.evalNote
    if (u.riskLevel !== undefined)        p.risk_level        = u.riskLevel
    if (u.memo !== undefined)             p.memo              = u.memo
    if (u.attachmentName !== undefined)   p.attachment_name   = u.attachmentName
    if (u.active !== undefined)           p.active            = u.active
    if (u.personId !== undefined)         p.person_id         = u.personId || null
    if (u.personName !== undefined)       p.person_name       = u.personName || null
    if (u.personType !== undefined)       p.person_type       = u.personType
    const raw = await evalChecklistAPI.update(id, p)
    set(s => ({ checklists: s.checklists.map(c => c.id===id ? mapCL(raw) : c) }))
  },
  deleteChecklist: async (id) => {
    await evalChecklistAPI.delete(id)
    set(s => ({ checklists: s.checklists.filter(c => c.id!==id) }))
  },
  toggleComplete: async (id, completed) => {
    // period_key/completed_date는 서버(KST) 결정. completed 를 주면 그 상태로 '설정'
    const raw = await evalChecklistAPI.toggle(id, completed === undefined ? {} : { completed })
    const updated = mapCL(raw)
    set(s => ({ checklists: s.checklists.map(c => c.id===id ? updated : c) }))
    // occurrences 스토어도 동기화
    if (updated.occurrences.length > 0) {
      set(s => ({
        occurrences: [
          ...s.occurrences.filter(o => o.checklistItemId !== id),
          ...updated.occurrences,
        ]
      }))
    }
  },

  setProgress: async (id, on) => {
    const raw = await evalChecklistAPI.setProgress(id, on)
    const updated = mapCL(raw)
    set(s => ({ checklists: s.checklists.map(c => c.id===id ? updated : c) }))
    if (updated.occurrences.length > 0) {
      set(s => ({
        occurrences: [
          ...s.occurrences.filter(o => o.checklistItemId !== id),
          ...updated.occurrences,
        ]
      }))
    }
  },

  addResident: async (r) => {
    const raw = await evalResidentsAPI.create({ name:r.name, birth_date:r.birthDate, gender:r.gender, admission_date:r.admissionDate, care_grade_start_date:r.careGradeStartDate, floor:r.floor, room:(r as any).room, certifications:(r as any).certifications, contract_lines:(r as any).contract_lines, plan_lines:(r as any).plan_lines, eval_lines:(r as any).eval_lines, memo:r.memo })
    const newR = mapR(raw)
    const templates = generateResidentAdmissionChecklists(newR as any)
    const newCls = await evalChecklistAPI.createBulk(templates.map(clPayload as any))
    const newItemIds = newCls.map((c: any) => c.id)
    set(s => ({ residents:[newR,...s.residents], checklists:[...s.checklists,...newCls.map(mapCL)] }))
    // 새 체크리스트의 occurrence 즉시 반영
    const newOccs = await occurrenceAPI.list({ person_id: newR.id }).catch(() => [])
    if (newOccs.length > 0)
      set(s => ({ occurrences: [...s.occurrences.filter(o => !newItemIds.includes(o.checklistItemId)), ...newOccs.map(mapOcc)] }))
  },
  updateResident: async (id, u) => {
    const p: any = {}
    if (u.name !== undefined)               p.name                  = u.name
    if (u.birthDate !== undefined)          p.birth_date            = u.birthDate
    if (u.gender !== undefined)             p.gender                = u.gender
    if (u.admissionDate !== undefined)      p.admission_date        = u.admissionDate
    if (u.careGradeStartDate !== undefined) p.care_grade_start_date = u.careGradeStartDate
    if (u.floor !== undefined)              p.floor                 = u.floor
    if ((u as any).room !== undefined)      p.room                  = (u as any).room
    if (u.memo !== undefined)               p.memo                  = u.memo
    const raw = await evalResidentsAPI.update(id, p)
    set(s => ({ residents: s.residents.map(r => r.id===id ? mapR(raw) : r) }))
  },
  dischargeResident: async (id, date) => {
    const resident = get().residents.find(r => r.id===id)
    if (!resident) return
    const templates = generateResidentDischargeChecklists(resident as any, date)
    const [raw, newCls] = await Promise.all([
      evalResidentsAPI.discharge(id, date),
      evalChecklistAPI.createBulk(templates.map(clPayload as any)),
    ])
    const newItemIds = newCls.map((c: any) => c.id)
    set(s => ({
      residents:  s.residents.map(r => r.id===id ? mapR(raw) : r),
      checklists: [...s.checklists.map(c => c.personId===id&&!c.completed ? {...c,active:false} : c), ...newCls.map(mapCL)],
    }))
    const newOccs = await occurrenceAPI.list({ person_id: id }).catch(() => [])
    if (newOccs.length > 0)
      set(s => ({ occurrences: [...s.occurrences.filter(o => !newItemIds.includes(o.checklistItemId)), ...newOccs.map(mapOcc)] }))
  },

  deleteResident: async (id) => {
    await evalResidentsAPI.delete(id)
    set(s => ({
      residents:   s.residents.filter(r => r.id !== id),
      checklists:  s.checklists.filter(c => c.personId !== id),
      occurrences: s.occurrences.filter(o => {
        const cl = s.checklists.find(c => c.id === o.checklistItemId)
        return cl ? cl.personId !== id : true
      }),
    }))
  },

  addStaff: async (s) => {
    const raw = await evalStaffAPI.create({ name:s.name, birth_date:s.birthDate, gender:s.gender, hire_date:s.hireDate, position:(s as any).position, resident_no:(s as any).residentNo, address:(s as any).address, address_detail:(s as any).addressDetail, phone:(s as any).phone, license_date:(s as any).licenseDate, license_no:(s as any).licenseNo, bank_account:(s as any).bankAccount, leaves:(s as any).leaves, memo:s.memo })
    const newS = mapS(raw)
    const templates = generateStaffHireChecklists(newS as any)
    const newCls = await evalChecklistAPI.createBulk(templates.map(clPayload as any))
    const newItemIds = newCls.map((c: any) => c.id)
    set(st => ({ staffList:[newS,...st.staffList], checklists:[...st.checklists,...newCls.map(mapCL)] }))
    const newOccs = await occurrenceAPI.list({ person_id: newS.id }).catch(() => [])
    if (newOccs.length > 0)
      set(st => ({ occurrences: [...st.occurrences.filter(o => !newItemIds.includes(o.checklistItemId)), ...newOccs.map(mapOcc)] }))
  },
  updateStaff: async (id, u) => {
    const p: any = {}
    if (u.name !== undefined)      p.name       = u.name
    if (u.birthDate !== undefined) p.birth_date = u.birthDate
    if (u.gender !== undefined)    p.gender     = u.gender
    if (u.hireDate !== undefined)  p.hire_date  = u.hireDate
    if ((u as any).position !== undefined) p.position = (u as any).position
    if ((u as any).residentNo !== undefined) p.resident_no = (u as any).residentNo
    if ((u as any).address !== undefined)    p.address = (u as any).address
    if ((u as any).addressDetail !== undefined) p.address_detail = (u as any).addressDetail
    if ((u as any).phone !== undefined)      p.phone = (u as any).phone
    if ((u as any).licenseDate !== undefined) p.license_date = (u as any).licenseDate
    if ((u as any).licenseNo !== undefined)  p.license_no = (u as any).licenseNo
    if ((u as any).bankAccount !== undefined) p.bank_account = (u as any).bankAccount
    if ((u as any).leaves !== undefined)     p.leaves = (u as any).leaves
    if (u.memo !== undefined)      p.memo       = u.memo
    const raw = await evalStaffAPI.update(id, p)
    set(st => ({ staffList: st.staffList.map(s => s.id===id ? mapS(raw) : s) }))
  },
  resignStaff: async (id, date) => {
    const raw = await evalStaffAPI.resign(id, date)
    set(st => ({
      staffList:  st.staffList.map(s => s.id===id ? mapS(raw) : s),
      checklists: st.checklists.map(c => c.personId===id&&!c.completed ? {...c,active:false} : c),
    }))
  },

  updateSettings: async (u) => {
    const p: any = {}
    if (u.facilityName !== undefined)              p.facility_name              = u.facilityName
    if (u.evalYear !== undefined)                  p.eval_year                  = u.evalYear
    if (u.alertDaysBeforeDue !== undefined)        p.alert_days_before_due      = u.alertDaysBeforeDue
    if (u.longInactiveThresholdDays !== undefined) p.long_inactive_threshold_days = u.longInactiveThresholdDays
    const raw = await evalSettingsAPI.update(p)
    set({ settings: mapSettings(raw) })
  },
}))

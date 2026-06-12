import { create } from 'zustand'
import {
  evalChecklistAPI,
  evalResidentsAPI,
  evalStaffAPI,
  evalIndicatorsAPI,
  evalSettingsAPI,
} from '@/api/evalClient'
import { getCurrentPeriodKey, EVENT_FREQS } from '@/utils/period'
import {
  generateResidentAdmissionChecklists,
  generateResidentDischargeChecklists,
  generateStaffHireChecklists,
} from '@/lib/checklistTemplates'

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
  personId?: string
  personName?: string
  personType?: string
  templateId?: string
  createdAt: string
}

export interface LtcResident {
  id: string; name: string; birthDate: string; gender: string
  admissionDate: string; dischargeDate?: string; careGradeStartDate: string
  status: string; memo: string; createdAt: string
}

export interface LtcStaff {
  id: string; name: string; birthDate: string; gender: string
  hireDate: string; resignDate?: string; status: string; memo: string; createdAt: string
}

export interface EvalDomain     { id: string; name: string; color: string; active: boolean }
export interface EvalCategory   { id: string; domainId: string; name: string; questionCount: number; totalScore: number; active: boolean }
export interface EvalIndicator  { id: string; categoryId: string; name: string; score: number; criteria: string; evidenceList: string[]; active: boolean }
export interface EvalSettings   { facilityName: string; evalYear: number; alertDaysBeforeDue: number; longInactiveThresholdDays: number }

// ── 매핑 헬퍼 ────────────────────────────────────────────────────────────

function mapCL(raw: any): ChecklistItem {
  return {
    id: raw.id, title: raw.title, description: raw.description ?? '',
    frequency: raw.frequency,
    relatedIndicatorId: raw.related_indicator_id ?? '',
    relatedCategoryId:  raw.related_category_id  ?? '',
    relatedDomainId:    raw.related_domain_id    ?? '',
    assignee:        raw.assignee        ?? '',
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
    completionHistory: (raw.completion_history ?? []).map((r: any) => ({
      periodKey:      r.period_key,
      completedDate:  r.completed_date,
      memo:           r.memo           ?? '',
      attachmentName: r.attachment_name ?? '',
    })),
  }
}
function mapR(raw: any): LtcResident {
  return { id:raw.id, name:raw.name, birthDate:raw.birth_date, gender:raw.gender,
    admissionDate:raw.admission_date, dischargeDate:raw.discharge_date,
    careGradeStartDate:raw.care_grade_start_date, status:raw.status,
    memo:raw.memo??'', createdAt:raw.created_at??'' }
}
function mapS(raw: any): LtcStaff {
  return { id:raw.id, name:raw.name, birthDate:raw.birth_date, gender:raw.gender,
    hireDate:raw.hire_date, resignDate:raw.resign_date, status:raw.status,
    memo:raw.memo??'', createdAt:raw.created_at??'' }
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
    evidence_required:item.evidenceRequired, storage_location:item.storageLocation,
    how_to:item.howTo, eval_note:item.evalNote, risk_level:item.riskLevel,
    memo:item.memo, attachment_name:item.attachmentName,
    person_id:item.personId, person_name:item.personName,
    person_type:item.personType, template_id:item.templateId,
  }
}

// ── 스토어 ───────────────────────────────────────────────────────────────

interface LtcState {
  checklists:  ChecklistItem[]
  residents:   LtcResident[]
  staffList:   LtcStaff[]
  domains:     EvalDomain[]
  categories:  EvalCategory[]
  indicators:  EvalIndicator[]
  settings:    EvalSettings
  loaded:      boolean
  loading:     boolean

  loadAll:           () => Promise<void>
  addChecklist:      (item: Omit<ChecklistItem,'id'|'createdAt'|'completionHistory'>) => Promise<void>
  updateChecklist:   (id: string, u: Partial<ChecklistItem>) => Promise<void>
  deleteChecklist:   (id: string) => Promise<void>
  toggleComplete:    (id: string) => Promise<void>
  addResident:       (r: Omit<LtcResident,'id'|'createdAt'>) => Promise<void>
  updateResident:    (id: string, u: Partial<LtcResident>) => Promise<void>
  dischargeResident: (id: string, date: string) => Promise<void>
  addStaff:          (s: Omit<LtcStaff,'id'|'createdAt'>) => Promise<void>
  updateStaff:       (id: string, u: Partial<LtcStaff>) => Promise<void>
  resignStaff:       (id: string, date: string) => Promise<void>
  updateSettings:    (u: Partial<EvalSettings>) => Promise<void>
}

const DEFAULT_SETTINGS: EvalSettings = { facilityName:'행복한 요양원', evalYear:2025, alertDaysBeforeDue:7, longInactiveThresholdDays:14 }

export const useLtcStore = create<LtcState>((set, get) => ({
  checklists:[], residents:[], staffList:[], domains:[], categories:[], indicators:[],
  settings: DEFAULT_SETTINGS, loaded:false, loading:false,

  loadAll: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const [cls, res, stf, doms, cats, inds, settings] = await Promise.all([
        evalChecklistAPI.list({ active_only: false }),
        evalResidentsAPI.list(),
        evalStaffAPI.list(),
        evalIndicatorsAPI.domains(),
        evalIndicatorsAPI.categories(),
        evalIndicatorsAPI.indicators(),
        evalSettingsAPI.get(),
      ])
      set({
        checklists:  cls.map(mapCL),
        residents:   res.map(mapR),
        staffList:   stf.map(mapS),
        domains:     doms.map((d:any) => ({ id:d.id, name:d.name, color:d.color, active:d.active })),
        categories:  cats.map((c:any) => ({ id:c.id, domainId:c.domain_id, name:c.name, questionCount:c.question_count, totalScore:c.total_score, active:c.active })),
        indicators:  inds.map((i:any) => ({ id:i.id, categoryId:i.category_id, name:i.name, score:i.score, criteria:i.criteria, evidenceList:i.evidence_list??[], active:i.active })),
        settings:    mapSettings(settings),
        loaded:      true,
      })
    } catch(e) { console.error('[LTC] loadAll failed', e) }
    finally { set({ loading: false }) }
  },

  addChecklist: async (item) => {
    const raw = await evalChecklistAPI.create(clPayload({ ...item, completionHistory:[] } as any))
    set(s => ({ checklists: [...s.checklists, mapCL(raw)] }))
  },
  updateChecklist: async (id, u) => {
    const p: any = {}
    if (u.title !== undefined)            p.title             = u.title
    if (u.description !== undefined)      p.description       = u.description
    if (u.frequency !== undefined)        p.frequency         = u.frequency
    if (u.relatedDomainId !== undefined)  p.related_domain_id = u.relatedDomainId
    if (u.relatedCategoryId !== undefined)p.related_category_id = u.relatedCategoryId
    if (u.relatedIndicatorId !== undefined) p.related_indicator_id = u.relatedIndicatorId
    if (u.assignee !== undefined)         p.assignee          = u.assignee
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
  toggleComplete: async (id) => {
    const item = get().checklists.find(c => c.id===id)
    if (!item) return
    const today     = new Date().toISOString().split('T')[0]
    const isEvent   = EVENT_FREQS.includes(item.frequency as any)
    const periodKey = isEvent ? today : getCurrentPeriodKey(item.frequency as any)
    const raw = await evalChecklistAPI.toggle(id, { period_key:periodKey, completed_date:today, is_event:isEvent })
    set(s => ({ checklists: s.checklists.map(c => c.id===id ? mapCL(raw) : c) }))
  },

  addResident: async (r) => {
    const raw = await evalResidentsAPI.create({ name:r.name, birth_date:r.birthDate, gender:r.gender, admission_date:r.admissionDate, care_grade_start_date:r.careGradeStartDate, memo:r.memo })
    const newR = mapR(raw)
    const templates = generateResidentAdmissionChecklists(newR as any)
    const newCls    = await evalChecklistAPI.createBulk(templates.map(clPayload as any))
    set(s => ({ residents:[newR,...s.residents], checklists:[...s.checklists,...newCls.map(mapCL)] }))
  },
  updateResident: async (id, u) => {
    const p: any = {}
    if (u.name !== undefined)               p.name                  = u.name
    if (u.birthDate !== undefined)          p.birth_date            = u.birthDate
    if (u.gender !== undefined)             p.gender                = u.gender
    if (u.admissionDate !== undefined)      p.admission_date        = u.admissionDate
    if (u.careGradeStartDate !== undefined) p.care_grade_start_date = u.careGradeStartDate
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
    set(s => ({
      residents:  s.residents.map(r => r.id===id ? mapR(raw) : r),
      checklists: [...s.checklists.map(c => c.personId===id&&!c.completed ? {...c,active:false} : c), ...newCls.map(mapCL)],
    }))
  },

  addStaff: async (s) => {
    const raw = await evalStaffAPI.create({ name:s.name, birth_date:s.birthDate, gender:s.gender, hire_date:s.hireDate, memo:s.memo })
    const newS    = mapS(raw)
    const templates = generateStaffHireChecklists(newS as any)
    const newCls    = await evalChecklistAPI.createBulk(templates.map(clPayload as any))
    set(st => ({ staffList:[newS,...st.staffList], checklists:[...st.checklists,...newCls.map(mapCL)] }))
  },
  updateStaff: async (id, u) => {
    const p: any = {}
    if (u.name !== undefined)      p.name       = u.name
    if (u.birthDate !== undefined) p.birth_date = u.birthDate
    if (u.gender !== undefined)    p.gender     = u.gender
    if (u.hireDate !== undefined)  p.hire_date  = u.hireDate
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

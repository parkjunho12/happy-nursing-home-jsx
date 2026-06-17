/**
 * 제공기록지 검수 결과 전역 상태
 * 상세 페이지 ↔ 목록 페이지 이동 시 결과 유지
 */
import { create } from 'zustand'

interface AuditRecord {
  id:         string
  filename:   string
  auditor:    string
  created_at: string
  result:     any
  context?:   any
}

interface AuditStore {
  // 현재 검수 결과
  currentAudit: AuditRecord | null
  setCurrentAudit: (record: AuditRecord | null) => void

  // 검수 이력 (최근 20건)
  history: AuditRecord[]
  setHistory: (history: AuditRecord[]) => void
  addToHistory: (record: AuditRecord) => void

  // 초기화
  reset: () => void
}

export const useAuditStore = create<AuditStore>((set) => ({
  currentAudit: null,
  setCurrentAudit: (record) => set({ currentAudit: record }),

  history: [],
  setHistory: (history) => set({ history }),
  addToHistory: (record) =>
    set((state) => ({
      history: [record, ...state.history.filter(h => h.id !== record.id)].slice(0, 20),
    })),

  reset: () => set({ currentAudit: null, history: [] }),
}))

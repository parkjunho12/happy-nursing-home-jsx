import { useState } from 'react'
import { X, CheckCircle2, Circle, AlertTriangle, FileText, MapPin, BookOpen, Star, Clock, Edit2 } from 'lucide-react'
import { useLtcStore } from '@/store/ltc'
import type { ChecklistItem } from '@/utils/period'
import ChecklistFormModal from '@/components/eval/ChecklistFormModal'
import {
  FREQUENCY_LABELS, RISK_LABELS, RISK_COLORS,
  getCurrentPeriodKey, isPeriodCompleted, getPeriodLabel,
  RECURRING,
} from '@/utils/period'

interface Props {
  item: ChecklistItem
  onClose: () => void
}

export default function ChecklistDetailModal({ item, onClose }: Props) {
  const { toggleComplete, updateChecklist, deleteChecklist } = useLtcStore()
  const [memo, setMemo] = useState(item.memo)
  const [attachmentName, setAttachmentName] = useState(item.attachmentName)
  const [showHistory, setShowHistory] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const isRecurring = RECURRING.includes(item.frequency as any)
  const currentPeriodKey   = isRecurring ? getCurrentPeriodKey(item.frequency as any) : ''
  const isCurrentDone      = isRecurring ? isPeriodCompleted(item, currentPeriodKey) : item.completed
  const currentPeriodLabel = isRecurring ? getPeriodLabel(item.frequency as any, currentPeriodKey) : ''
  const currentRecord      = isRecurring ? item.completionHistory.find(r => r.periodKey === currentPeriodKey) : null

  const handleToggle = async () => {
    setToggling(true)
    try { await toggleComplete(item.id) } finally { setToggling(false) }
  }

  const handleSaveMemo = async () => {
    setSaving(true)
    try { await updateChecklist(item.id, { memo, attachmentName }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    await deleteChecklist(item.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b flex items-start justify-between rounded-t-2xl z-10">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[item.riskLevel]}`}>
                {RISK_LABELS[item.riskLevel]}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {FREQUENCY_LABELS[item.frequency as any]}
              </span>
              {item.personName && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  👤 {item.personName}
                </span>
              )}
            </div>
            <h2 className="font-bold text-gray-900 text-base leading-snug">{item.title}</h2>
            {/* 현재 주기 상태 */}
            {isRecurring && (
              <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                isCurrentDone ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {isCurrentDone ? <CheckCircle2 size={11}/> : <Circle size={11}/>}
                {currentPeriodLabel} — {isCurrentDone
                  ? `완료 (${currentRecord?.completedDate})`
                  : '미완료'}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <X size={18}/>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {item.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
          )}

          {/* 담당자 */}
          {item.assignee && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
              <BookOpen size={15} className="text-gray-400 flex-shrink-0"/>
              <span className="font-medium">담당:</span>
              <span>{item.assignee}</span>
            </div>
          )}

          {/* 수행 방법 */}
          {item.howTo && (
            <div className="bg-blue-50 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star size={14} className="text-blue-500"/>
                <span className="text-xs font-semibold text-blue-700">어떻게 해야 하나요?</span>
              </div>
              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{item.howTo}</p>
            </div>
          )}

          {/* 증빙자료 */}
          {item.evidenceRequired && (
            <div className="bg-gray-50 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText size={14} className="text-gray-500"/>
                <span className="text-xs font-semibold text-gray-600">필요한 증빙자료</span>
              </div>
              <p className="text-sm text-gray-700">{item.evidenceRequired}</p>
            </div>
          )}

          {/* 보관 위치 */}
          {item.storageLocation && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0"/>
              <span><span className="font-medium">보관위치:</span> {item.storageLocation}</span>
            </div>
          )}

          {/* 평가 유의사항 */}
          {item.evalNote && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={14} className="text-red-500"/>
                <span className="text-xs font-semibold text-red-600">평가 시 유의사항</span>
              </div>
              <p className="text-sm text-red-700 leading-relaxed">{item.evalNote}</p>
            </div>
          )}

          {/* 완료 이력 */}
          {isRecurring && item.completionHistory.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                <Clock size={13}/>
                완료 이력 ({item.completionHistory.length}건) {showHistory ? '▲' : '▼'}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                  {[...item.completionHistory].reverse().map(rec => (
                    <div key={rec.periodKey} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-gray-600 font-medium">
                        {getPeriodLabel(item.frequency as any, rec.periodKey)}
                      </span>
                      <span className="text-xs text-gray-400">{rec.completedDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 메모 */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">메모</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/50 resize-none"
                rows={2}
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">첨부파일명</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-orange/50"
                value={attachmentName}
                onChange={e => setAttachmentName(e.target.value)}
                placeholder="파일명 (예: 교육일지_6월.pdf)"
              />
            </div>
            <button
              onClick={handleSaveMemo}
              disabled={saving}
              className="text-xs font-medium text-primary-orange hover:underline disabled:opacity-50"
            >
              {saving ? '저장 중...' : '메모 저장'}
            </button>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                isCurrentDone
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-primary-orange text-white hover:bg-primary-orange/90'
              }`}
            >
              {isCurrentDone ? <Circle size={15}/> : <CheckCircle2 size={15}/>}
              {toggling ? '처리 중...' : isRecurring
                ? (isCurrentDone ? `${currentPeriodLabel} 완료 취소` : `${currentPeriodLabel} 완료`)
                : (item.completed ? '완료 취소' : '완료 체크')}
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Edit2 size={14}/>수정
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
      {showEditModal && (
        <ChecklistFormModal existing={item} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  )
}

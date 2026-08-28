import DateField from '@/components/ui/DateField'
import StickyToolbar from '../../components/common/StickyToolbar'
import { useEffect, useState, useCallback } from 'react'
import {
  Receipt, Plus, X, Check, Trash2, Paperclip, Loader2, Banknote,
  ChevronLeft, ChevronRight, FileText, AlertCircle, Ban,
} from 'lucide-react'
import {
  expenseAPI, won, type ExpenseRequest, type ExpenseMeta, type ExpenseSummary,
  type ExpenseStatus, type ExpenseAttachment,
} from '../../api/expenseClient'

/* ── helpers ── */
const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const STATUS: Record<ExpenseStatus, { label: string; chip: string; dot: string }> = {
  pending:  { label: '대기',  chip: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  manager_approved: { label: '시설장 승인 · 최종 대기', chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  approved: { label: '승인',  chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { label: '반려',  chip: 'bg-rose-50 text-rose-600 border-rose-200',      dot: 'bg-rose-500' },
}
const STATUS_TABS: ({ v: '' | ExpenseStatus; label: string })[] = [
  { v: '', label: '전체' }, { v: 'pending', label: '대기' }, { v: 'manager_approved', label: '최종 대기' },
  { v: 'approved', label: '승인' }, { v: 'rejected', label: '반려' },
]

/* 계좌이체 요청은 결제수단으로 구분한다 — 물건구입 요청은 결제수단을 쓰지 않는다 */
const TRANSFER_METHOD = '계좌이체'
const isTransfer = (r: ExpenseRequest) => r.payment_method === TRANSFER_METHOD
/* 이체 출금 통장은 시설에서 쓰는 세 통장으로 고정 */
const WITHDRAW_ACCOUNTS = ['통합통장', '기타비용', '직원통장']

export default function ExpensePage() {
  const [meta, setMeta] = useState<ExpenseMeta | null>(null)
  const [rows, setRows] = useState<ExpenseRequest[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | ExpenseStatus>('')
  const [category, setCategory] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [sumMonth, setSumMonth] = useState(() => new Date())
  const [formKind, setFormKind] = useState<'' | 'purchase' | 'transfer'>('')
  const [editing, setEditing] = useState<ExpenseRequest | null>(null)
  const [detail, setDetail] = useState<ExpenseRequest | null>(null)

  const isApprover = meta?.is_approver ?? false

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (status) params.status = status
      if (category) params.category = category
      if (mineOnly) params.mine = true
      setRows(await expenseAPI.list(params))
    } finally { setLoading(false) }
  }, [status, category, mineOnly])

  const loadSummary = useCallback(async () => {
    if (!isApprover) return
    try {
      setSummary(await expenseAPI.summary(sumMonth.getFullYear(), sumMonth.getMonth() + 1))
    } catch { /* noop */ }
  }, [isApprover, sumMonth])

  useEffect(() => { expenseAPI.meta().then(setMeta).catch(() => {}) }, [])
  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadSummary() }, [loadSummary])

  const refresh = () => { loadList(); loadSummary() }

  const openDetail = async (r: ExpenseRequest) => {
    try { setDetail(await expenseAPI.get(r.id)) } catch { setDetail(r) }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">지출결의 (회계 결제)</h1>
            <p className="text-xs text-gray-400">결제 서류를 등록하면 관리자가 승인/반려합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(null); setFormKind('purchase') }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> 물건구입 요청
          </button>
          <button onClick={() => { setEditing(null); setFormKind('transfer') }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Banknote className="w-4 h-4" /> 계좌이체 요청
          </button>
        </div>
      </div>

      {/* 월별 집계 (승인권자) */}
      {isApprover && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">월별 집계</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setSumMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
              <span className="text-sm font-bold text-gray-800 w-24 text-center">{sumMonth.getFullYear()}년 {sumMonth.getMonth() + 1}월</span>
              <button onClick={() => setSumMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="승인 총액" value={won(summary?.approved_total ?? 0)} sub={`${summary?.approved_count ?? 0}건`} tone="emerald" />
            <Stat label="대기 금액" value={won(summary?.pending_total ?? 0)} sub={`${summary?.pending_count ?? 0}건`} tone="amber" />
            <Stat label="지급 대기(이체 전)" value={won(summary?.unpaid_total ?? 0)} sub={`${summary?.unpaid_count ?? 0}건`} tone="amber" />
            <Stat label="반려" value={`${summary?.rejected_count ?? 0}건`} tone="rose" />
            <Stat label="이번 달 합계건수" value={`${(summary?.approved_count ?? 0) + (summary?.pending_count ?? 0) + (summary?.rejected_count ?? 0)}건`} tone="gray" />
          </div>
          {(summary?.by_withdraw_account ?? []).length > 0 && (
            <p className="mt-2 text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
              <b className="text-gray-400">출금 통장별 승인액</b>
              {(summary?.by_withdraw_account ?? []).map(x => (
                <span key={x.account}>{x.account} <b className="text-gray-700">{won(x.amount)}원</b></span>
              ))}
            </p>
          )}
          {(summary?.by_category?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">계정과목별 (승인 기준)</p>
              <div className="space-y-1.5">
                {summary!.by_category.map(c => {
                  const max = summary!.by_category[0].amount || 1
                  return (
                    <div key={c.category} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 w-20 shrink-0">{c.category}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max(4, (c.amount / max) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-24 text-right shrink-0">{won(c.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 필터 (상단 고정) */}
      <StickyToolbar edge="container">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          {STATUS_TABS.map(t => (
            <button key={t.v} onClick={() => setStatus(t.v)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${status === t.v ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
          ))}
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200">
          <option value="">전체 계정과목</option>
          {meta?.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isApprover && (
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-1">
            <input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} className="accent-emerald-600" />
            내 신청만
          </label>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
      </div>
      </StickyToolbar>

      {/* 목록 */}
      <div className="space-y-2">
        {rows.map(r => (
          <button key={r.id} onClick={() => openDetail(r)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all text-left">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold shrink-0 inline-flex items-center gap-1 ${STATUS[r.status].chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS[r.status].dot}`} />{STATUS[r.status].label}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800 truncate">{r.title}</p>
                {r.attachments.length > 0 && (
                  <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5 shrink-0"><Paperclip className="w-3 h-3" />{r.attachments.length}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {r.category}{r.vendor ? ` · ${r.vendor}` : ''} · {r.requester_name ?? '-'} · {fmtDate(r.created_at)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold text-gray-900">{won(r.amount)}</p>
              {r.payment_method && <p className="text-[11px] text-gray-400">{r.payment_method}{r.withdraw_account ? ` · ${r.withdraw_account}` : ''}</p>}
              {r.status === 'approved' && (
                r.paid_at
                  ? <p className="text-[10px] font-bold text-sky-600">💸 이체 완료</p>
                  : <p className="text-[10px] font-bold text-amber-600">⏳ 지급 대기</p>
              )}
            </div>
          </button>
        ))}
        {!loading && rows.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400">등록된 결제 서류가 없습니다.</div>
        )}
      </div>

      {formKind === 'purchase' && (
        <PurchaseFormModal
          editing={editing}
          onClose={() => { setFormKind(''); setEditing(null) }}
          onSaved={() => { setFormKind(''); setEditing(null); refresh() }}
        />
      )}
      {formKind === 'transfer' && (
        <TransferFormModal
          editing={editing}
          onClose={() => { setFormKind(''); setEditing(null) }}
          onSaved={() => { setFormKind(''); setEditing(null); refresh() }}
        />
      )}
      {detail && (
        /* 수정은 등록할 때 쓴 요청 종류 그대로 열어야 값이 맞는다 */
        <DetailModal
          r={detail}
          onClose={() => setDetail(null)}
          onChanged={() => { setDetail(null); refresh() }}
          onEdit={(r) => { setDetail(null); setEditing(r); setFormKind(isTransfer(r) ? 'transfer' : 'purchase') }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'emerald' | 'amber' | 'rose' | 'gray' }) {
  const map = {
    emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600', gray: 'bg-gray-50 text-gray-600',
  }[tone]
  return (
    <div className={`rounded-xl p-3 ${map}`}>
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="text-base font-extrabold mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── 물건구입 요청 등록/수정 모달 ── */
function PurchaseFormModal({ editing, onClose, onSaved }:
  { editing: ExpenseRequest | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const [title, setTitle] = useState(editing?.title ?? '')
  const [amount, setAmount] = useState<string>(editing ? String(editing.amount) : '')
  const [vendor, setVendor] = useState(editing?.vendor ?? '')
  const [neededAt, setNeededAt] = useState(editing?.purchased_at ?? ymd(new Date()))
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [removeIds, setRemoveIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const existing = (editing?.attachments ?? []).filter(a => !removeIds.includes(a.id))
  const amountNum = Number(amount.replace(/[^0-9]/g, '')) || 0

  const submit = async () => {
    if (!title.trim()) { setErr('품목/제목을 입력해주세요.'); return }
    if (amountNum <= 0) { setErr('금액을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('amount', String(amountNum))
      fd.append('vendor', vendor)
      fd.append('purchased_at', neededAt)
      fd.append('memo', memo)
      files.forEach(f => fd.append('files', f))
      if (isEdit) {
        if (removeIds.length) fd.append('remove_attachment_ids', removeIds.join(','))
        await expenseAPI.update(editing!.id, fd)
      } else {
        await expenseAPI.create(fd)
      }
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? '물건구입 요청 수정' : '물건구입 요청'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="품목 / 제목 *"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 어르신 간식 구매" className="einp" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="금액(원) *">
            <input inputMode="numeric" value={amount ? new Intl.NumberFormat('ko-KR').format(amountNum) : ''}
              onChange={e => setAmount(e.target.value)} placeholder="0" className="einp text-right font-bold" />
          </Field>
          <Field label="필요일자"><DateField value={neededAt} onChange={v => setNeededAt(v)} className="einp" clearable={false} /></Field>
        </div>
        <Field label="거래처 (선택)"><input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="예: OO마트" className="einp" /></Field>
        {/* 구입처 링크를 붙여넣으면 상세에서 바로 눌러 열 수 있다 */}
        <Field label="메모 / 링크 (선택)">
          <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className="einp resize-none"
            placeholder="구입 링크를 붙여넣으면 상세에서 바로 열립니다 — 예: https://..." />
        </Field>

        {/* 기존 첨부 */}
        {existing.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">기존 첨부</label>
            <div className="flex flex-wrap gap-2">
              {existing.map(a => (
                <div key={a.id} className="relative">
                  <AttThumb a={a} />
                  <button onClick={() => setRemoveIds(ids => [...ids, a.id])}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 파일 첨부 */}
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">영수증 / 견적서 첨부 (이미지·PDF)</label>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <Paperclip className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">파일 선택 (여러 개 가능)</span>
            <input type="file" multiple accept="image/*,application/pdf" className="hidden"
              onChange={e => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" />{f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {err && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{err}</p>}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{isEdit ? '수정' : '요청'}
        </button>
      </ModalFooter>
    </Modal>
  )
}

/* ── 계좌이체 요청 등록/수정 모달 ── */
function TransferFormModal({ editing, onClose, onSaved }:
  { editing: ExpenseRequest | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing
  const dep = parseDeposit(editing?.deposit_account)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [amount, setAmount] = useState<string>(editing ? String(editing.amount) : '')
  const [dueAt, setDueAt] = useState(editing?.purchased_at ?? '')
  // 기한 없는 이체가 흔해서 '없음'을 체크로 남긴다 (수정 시 저장된 기한이 없으면 없음으로 본다)
  const [noDue, setNoDue] = useState(isEdit && !editing?.purchased_at)
  const [withdrawAcc, setWithdrawAcc] = useState(editing?.withdraw_account ?? '')
  const [bank, setBank] = useState(dep.bank)
  const [accountNo, setAccountNo] = useState(dep.number)
  const [holder, setHolder] = useState(dep.holder)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const amountNum = Number(amount.replace(/[^0-9]/g, '')) || 0

  const submit = async () => {
    if (!title.trim()) { setErr('품목/제목을 입력해주세요.'); return }
    if (amountNum <= 0) { setErr('금액을 입력해주세요.'); return }
    if (!noDue && !dueAt) { setErr("기한일을 입력하거나 '없음'을 체크해주세요."); return }
    if (!withdrawAcc) { setErr('출금할 통장을 선택해주세요.'); return }
    if (!bank.trim() || !accountNo.trim() || !holder.trim()) { setErr('입금 통장(은행·계좌번호·예금주)을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('amount', String(amountNum))
      fd.append('payment_method', TRANSFER_METHOD)
      fd.append('purchased_at', noDue ? '' : dueAt)
      fd.append('withdraw_account', withdrawAcc)
      fd.append('deposit_account', formatDeposit(bank, accountNo, holder))
      if (isEdit) await expenseAPI.update(editing!.id, fd)
      else await expenseAPI.create(fd)
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? '계좌이체 요청 수정' : '계좌이체 요청'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="품목 / 제목 *"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 12월 세탁용역비" className="einp" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="금액(원) *">
            <input inputMode="numeric" value={amount ? new Intl.NumberFormat('ko-KR').format(amountNum) : ''}
              onChange={e => setAmount(e.target.value)} placeholder="0" className="einp text-right font-bold" />
          </Field>
          <Field label="기한일">
            <DateField value={noDue ? '' : dueAt} onChange={v => setDueAt(v)} className="einp" disabled={noDue} />
            <label className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={noDue} onChange={e => setNoDue(e.target.checked)} className="w-3.5 h-3.5 accent-sky-600" />
              없음
            </label>
          </Field>
        </div>
        <Field label="출금할 통장 *">
          <select value={withdrawAcc} onChange={e => setWithdrawAcc(e.target.value)} className="einp">
            <option value="">선택</option>
            {/* 예전 요청이 다른 통장으로 저장돼 있으면 그 값도 남겨 둔다 */}
            {withdrawAcc && !WITHDRAW_ACCOUNTS.includes(withdrawAcc) && <option value={withdrawAcc}>{withdrawAcc}</option>}
            {WITHDRAW_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">입금 통장 *</label>
          <div className="grid grid-cols-3 gap-2">
            <input value={bank} onChange={e => setBank(e.target.value)} placeholder="은행" className="einp" />
            <input value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="계좌번호" className="einp col-span-2" />
          </div>
          <input value={holder} onChange={e => setHolder(e.target.value)} placeholder="예금주" className="einp mt-2" />
        </div>
        {err && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{err}</p>}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}{isEdit ? '수정' : '요청'}
        </button>
      </ModalFooter>
    </Modal>
  )
}

/* 입금 통장은 백엔드에 한 줄로 저장돼 '은행 계좌번호 (예금주)' 서식을 그대로 쓴다 */
const formatDeposit = (bank: string, no: string, holder: string) => `${bank.trim()} ${no.trim()} (${holder.trim()})`
const parseDeposit = (s?: string | null) => {
  const m = /^\s*(\S+)\s+(\S+)\s*(?:\((.*)\))?\s*$/.exec(s ?? '')
  return { bank: m?.[1] ?? (s ?? ''), number: m?.[2] ?? '', holder: m?.[3] ?? '' }
}

/* ── 상세 모달 ── */
function DetailModal({ r, onClose, onChanged, onEdit }:
  { r: ExpenseRequest; onClose: () => void; onChanged: () => void; onEdit: (r: ExpenseRequest) => void }) {
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const doApprove = async () => { setBusy(true); try { await expenseAPI.approve(r.id); onChanged() } finally { setBusy(false) } }
  const doReject = async () => {
    if (!reason.trim()) return
    setBusy(true); try { await expenseAPI.reject(r.id, reason.trim()); onChanged() } finally { setBusy(false) }
  }
  const doDelete = async () => {
    if (!confirm('이 결제 서류를 삭제할까요?')) return
    setBusy(true); try { await expenseAPI.remove(r.id); onChanged() } finally { setBusy(false) }
  }

  return (
    <Modal title="결제 서류 상세" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1 ${STATUS[r.status].chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS[r.status].dot}`} />{STATUS[r.status].label}
          </span>
          <span className="text-2xl font-extrabold text-gray-900">{won(r.amount)}</span>
        </div>
        <p className="text-base font-bold text-gray-900">{r.title}</p>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-sm">
          {isTransfer(r) ? (
            <Info label="기한일" value={r.purchased_at ?? '없음'} />
          ) : (
            <>
              <Info label="거래처" value={r.vendor ?? '-'} />
              <Info label="필요일자" value={r.purchased_at ?? '-'} />
            </>
          )}
          <Info label="작성자" value={r.requester_name ?? '-'} />
          <Info label="등록" value={fmtDate(r.created_at)} />
        </div>
        {r.memo && (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap"><Linkify text={r.memo} /></p>
        )}

        {(r.withdraw_account || r.deposit_account) && (
          <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 space-y-0.5">
            {r.withdraw_account && <p><b className="text-gray-400 font-semibold">출금</b> {r.withdraw_account}</p>}
            {r.deposit_account && <p><b className="text-gray-400 font-semibold">입금</b> {r.deposit_account}</p>}
          </div>
        )}
        {r.manager_name && (r.status === 'manager_approved' || r.status === 'approved') && (
          <div className="bg-sky-50 text-sky-700 rounded-lg p-2.5 text-xs flex items-center gap-1.5">
            <Check className="w-4 h-4" /> 1차 — {r.manager_name} 시설장 승인 · {fmtDate(r.manager_approved_at)}
            {r.status === 'manager_approved' && <span className="ml-auto font-bold">관리자 최종 승인 대기</span>}
          </div>
        )}
        {r.status === 'approved' && r.approver_name && (
          <div className="bg-emerald-50 text-emerald-700 rounded-lg p-2.5 text-xs flex items-center gap-1.5">
            <Check className="w-4 h-4" /> {r.manager_name ? '최종 — ' : ''}{r.approver_name}님 승인 · {fmtDate(r.approved_at)}
          </div>
        )}
        {r.status === 'approved' && (
          r.paid_at ? (
            <div className="bg-sky-50 text-sky-700 rounded-lg p-2.5 text-xs flex items-center gap-1.5">
              💸 이체 완료 — {r.paid_by} · {fmtDate(r.paid_at)}
              <button onClick={async () => {
                if (!confirm('이체 완료를 취소할까요?')) return
                try { await expenseAPI.markPaid(r.id, false); onChanged() }
                catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
              }} className="ml-auto text-[10px] font-bold text-sky-500 hover:underline">취소</button>
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-700 rounded-lg p-2.5 text-xs flex items-center gap-1.5">
              ⏳ 지급 대기 — 승인은 됐지만 아직 이체 전입니다
              <button onClick={async () => {
                if (!confirm(`${won(r.amount)}원 이체를 완료했나요?\n지급 완료로 기록됩니다.`)) return
                try { await expenseAPI.markPaid(r.id, true); onChanged() }
                catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패 (최종 승인권자만 가능)') }
              }} className="ml-auto text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg">이체 완료</button>
            </div>
          )
        )}
        {r.status === 'rejected' && (
          <div className="bg-rose-50 text-rose-600 rounded-lg p-2.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold"><Ban className="w-4 h-4" /> {r.approver_name}님 반려 · {fmtDate(r.approved_at)}</p>
            {r.reject_reason && <p className="mt-1 pl-5">사유: {r.reject_reason}</p>}
          </div>
        )}

        {/* 첨부 */}
        {r.attachments.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">첨부 ({r.attachments.length})</label>
            <div className="flex flex-wrap gap-2">
              {r.attachments.map(a => <AttThumb key={a.id} a={a} openable />)}
            </div>
          </div>
        )}

        {/* 반려 사유 입력 */}
        {rejecting && (
          <div className="bg-rose-50 rounded-lg p-3 space-y-2">
            <label className="text-xs font-semibold text-rose-600">반려 사유 *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="einp resize-none" placeholder="예: 견적서 누락, 예산 초과 등" autoFocus />
          </div>
        )}
      </div>
      <ModalFooter>
        {r.can_edit && !rejecting && (
          <>
            <button onClick={doDelete} disabled={busy} className="px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />삭제</button>
            {r.status === 'pending' && (
              <button onClick={() => onEdit(r)} className="px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">수정</button>
            )}
          </>
        )}
        <div className="flex-1" />
        {r.can_approve && !rejecting && (
          <>
            <button onClick={() => setRejecting(true)} disabled={busy} className="px-4 py-2 text-sm font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg">반려</button>
            <button onClick={doApprove} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1.5">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}<Check className="w-4 h-4" />승인
            </button>
          </>
        )}
        {rejecting && (
          <>
            <button onClick={() => { setRejecting(false); setReason('') }} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
            <button onClick={doReject} disabled={busy || !reason.trim()} className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}반려 확정
            </button>
          </>
        )}
        {!r.can_approve && !r.can_edit && !rejecting && (
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg">닫기</button>
        )}
      </ModalFooter>
    </Modal>
  )
}

/* 메모에 적힌 구입 링크는 눈에 띄게(파란색) 보여주고 눌러서 바로 열리게 한다 */
function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+)/g).map((part, i) => (
        /^https?:\/\//.test(part)
          ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 underline break-all">{part}</a>
          : <span key={i}>{part}</span>
      ))}
    </>
  )
}

function AttThumb({ a, openable }: { a: ExpenseAttachment; openable?: boolean }) {
  const url = expenseAPI.fileUrl(a.file_url)
  const inner = a.is_image ? (
    <img src={url} alt={a.file_name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
  ) : (
    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-0.5">
      <FileText className="w-5 h-5 text-gray-400" />
      <span className="text-[9px] text-gray-400">PDF</span>
    </div>
  )
  if (openable) return <a href={url} target="_blank" rel="noreferrer" className="block hover:opacity-80" title={a.file_name}>{inner}</a>
  return <div title={a.file_name}>{inner}</div>
}

/* ── 공용 UI ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>{children}</div>
}
function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-gray-400 text-xs">{label}</span><p className="font-medium text-gray-700">{value}</p></div>
}

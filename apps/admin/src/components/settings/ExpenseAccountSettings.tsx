import { useEffect, useState } from 'react'
import { Landmark, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { expenseAPI } from '@/api/expenseClient'

/** 지출결의 계좌 목록 — ADMIN만 추가·삭제. 신청 폼 드롭다운의 소스. */
export default function ExpenseAccountSettings() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [withdraw, setWithdraw] = useState<string[]>([])
  const [deposit, setDeposit] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newW, setNewW] = useState('')
  const [newD, setNewD] = useState('')

  useEffect(() => {
    expenseAPI.accounts().then(r => { setWithdraw(r.withdraw); setDeposit(r.deposit) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (!isAdmin) return null

  const save = async (w: string[], d: string[]) => {
    setSaving(true)
    try {
      const r = await expenseAPI.saveAccounts({ withdraw_accounts: w, deposit_accounts: d })
      setWithdraw(r.withdraw); setDeposit(r.deposit)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const List = ({ title, hint, items, input, setInput, onChange }: {
    title: string; hint: string; items: string[]
    input: string; setInput: (v: string) => void; onChange: (items: string[]) => void
  }) => (
    <div className="flex-1 min-w-[250px]">
      <p className="text-xs font-bold text-gray-600 mb-0.5">{title}</p>
      <p className="text-[10px] text-gray-400 mb-1.5">{hint}</p>
      <ul className="space-y-1 mb-1.5">
        {items.map(a => (
          <li key={a} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700">
            {a}
            <button onClick={() => onChange(items.filter(x => x !== a))}
              className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
          </li>
        ))}
        {items.length === 0 && <li className="text-[11px] text-gray-300 py-1">등록된 계좌 없음</li>}
      </ul>
      <div className="flex gap-1.5">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { onChange([...items, input.trim()]); setInput('') } }}
          placeholder="예: 농협 운영비 301-****-1234"
          className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg" />
        <button disabled={!input.trim()}
          onClick={() => { onChange([...items, input.trim()]); setInput('') }}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"><Plus size={12} /></button>
      </div>
    </div>
  )

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark size={15} className="text-emerald-600" />
        <h2 className="text-sm font-bold text-gray-800">지출결의 계좌 관리 <span className="font-normal text-gray-400">— ADMIN 전용 · 신청 폼 드롭다운에 사용</span></h2>
        {(saving || loading) && <Loader2 size={13} className="animate-spin text-gray-300" />}
      </div>
      <div className="flex gap-4 flex-wrap">
        <List title="출금 통장 (시설 계좌)" hint="돈이 나가는 우리 시설 통장"
          items={withdraw} input={newW} setInput={setNewW}
          onChange={items => save(items, deposit)} />
        <List title="입금 통장 (거래처 계좌)" hint="거래처가 돈을 받는 계좌 — 자주 쓰는 곳만"
          items={deposit} input={newD} setInput={setNewD}
          onChange={items => save(withdraw, items)} />
      </div>
    </section>
  )
}

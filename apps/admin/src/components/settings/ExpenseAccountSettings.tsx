import { useEffect, useState } from 'react'
import { Landmark, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { expenseAPI } from '@/api/expenseClient'

/** 지출결의 계좌·카드 목록 — ADMIN만 추가·삭제. 신청 폼 드롭다운의 소스. */

// ⚠ 컴포넌트 안에서 컴포넌트를 정의하면 타이핑마다 리마운트되어 포커스가 풀린다 — 모듈 레벨로 분리
function AccountList({ title, hint, items, onChange }: {
  title: string; hint: string; items: string[]; onChange: (items: string[]) => void
}) {
  const [input, setInput] = useState('')
  const add = () => { if (input.trim()) { onChange([...items, input.trim()]); setInput('') } }
  return (
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
        {items.length === 0 && <li className="text-[11px] text-gray-300 py-1">등록된 항목 없음</li>}
      </ul>
      <div className="flex gap-1.5">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="입력 후 Enter"
          className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg" />
        <button disabled={!input.trim()} onClick={add}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"><Plus size={12} /></button>
      </div>
    </div>
  )
}

export default function ExpenseAccountSettings() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [withdraw, setWithdraw] = useState<string[]>([])
  const [deposit, setDeposit] = useState<string[]>([])
  const [cards, setCards] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    expenseAPI.accounts().then(r => { setWithdraw(r.withdraw); setDeposit(r.deposit); setCards(r.cards ?? []) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (!isAdmin) return null

  const save = async (w: string[], d: string[], c: string[]) => {
    setSaving(true)
    try {
      const r = await expenseAPI.saveAccounts({ withdraw_accounts: w, deposit_accounts: d, cards: c })
      setWithdraw(r.withdraw); setDeposit(r.deposit); setCards(r.cards ?? [])
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark size={15} className="text-emerald-600" />
        <h2 className="text-sm font-bold text-gray-800">지출결의 계좌·카드 관리 <span className="font-normal text-gray-400">— ADMIN 전용 · 신청 폼 드롭다운에 사용</span></h2>
        {(saving || loading) && <Loader2 size={13} className="animate-spin text-gray-300" />}
      </div>
      <div className="flex gap-4 flex-wrap">
        <AccountList title="출금 통장 (시설 계좌)" hint="계좌이체 때 돈이 나가는 우리 시설 통장"
          items={withdraw} onChange={items => save(items, deposit, cards)} />
        <AccountList title="법인카드" hint="카드 결제 때 고르는 카드 목록 — 예: 신한 법인카드 (1234)"
          items={cards} onChange={items => save(withdraw, deposit, items)} />
        <AccountList title="입금 통장 (거래처 계좌)" hint="직원이 신청하며 추가한 계좌도 여기서 정리"
          items={deposit} onChange={items => save(withdraw, items, cards)} />
      </div>
    </section>
  )
}

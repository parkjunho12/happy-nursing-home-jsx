import { useEffect, useState } from 'react'
import { Loader2, Save, Soup } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { mealTimeAPI, type MealTimes } from '@/api/mealClient'

/** 식사 시간 설정 — ADMIN 전용. 식수 정산(외출·외박 끼니 제외)의 기준 시간. */
const FIELDS: { key: keyof MealTimes; label: string; emoji: string; hint: string }[] = [
  { key: 'breakfast', label: '아침', emoji: '🌅', hint: '예: 07:30' },
  { key: 'snack_am', label: '아침 간식', emoji: '🥛', hint: '예: 10:00' },
  { key: 'lunch', label: '점심', emoji: '🍚', hint: '예: 12:00' },
  { key: 'snack_pm', label: '저녁 간식', emoji: '🍞', hint: '예: 15:00' },
  { key: 'dinner', label: '저녁', emoji: '🌙', hint: '예: 17:30' },
]

export default function MealTimeSettings() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [times, setTimes] = useState<MealTimes>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    mealTimeAPI.get().then(setTimes).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (!isAdmin) return null

  const save = async () => {
    setSaving(true)
    try { setTimes(await mealTimeAPI.save(times)); setDirty(false) }
    catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <Soup size={15} className="text-orange-500" />
        <h2 className="text-sm font-bold text-gray-800">식사 시간 설정 <span className="font-normal text-gray-400">— ADMIN 전용</span></h2>
        {loading && <Loader2 size={13} className="animate-spin text-gray-300" />}
        <button onClick={save} disabled={!dirty || saving}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${dirty ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'border border-gray-200 text-gray-300'}`}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 저장
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        식수 정산의 기준이 됩니다 — 어르신이 외출·외박으로 자리를 비운 시간대의 끼니를 빼고 계산해요.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {FIELDS.map(f => (
          <div key={f.key} className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5">
            <p className="text-[11px] font-bold text-gray-600 mb-1">{f.emoji} {f.label}</p>
            <input type="time" value={times[f.key] ?? ''}
              onChange={e => { setTimes(p => ({ ...p, [f.key]: e.target.value || null })); setDirty(true) }}
              className="w-full px-1.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white" />
            <p className="text-[9px] text-gray-300 mt-0.5">{f.hint}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

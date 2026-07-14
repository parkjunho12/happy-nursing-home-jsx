import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LtcResident } from '@/store/ltc'

const pad = (n: number) => String(n).padStart(2, '0')

/** 최근 N개월 입소·퇴소·월말 재원 수 추이 */
export default function ResidentTrendChart({ residents, months = 12 }: { residents: LtcResident[]; months?: number }) {
  const data = useMemo(() => {
    const now = new Date()
    const rows: { key: string; label: string; 입소: number; 퇴소: number; 재원: number; net: number }[] = []

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y = d.getFullYear(), m = d.getMonth() + 1
      const prefix = `${y}-${pad(m)}`
      const last = new Date(y, m, 0)
      const lastIso = `${y}-${pad(m)}-${pad(last.getDate())}`

      let adm = 0, dis = 0, census = 0
      residents.forEach(r => {
        if (r.admissionDate?.startsWith(prefix)) adm++
        if (r.dischargeDate?.startsWith(prefix)) dis++
        // 월말 재원: 입소 <= 월말 && (퇴소 없음(퇴소상태 아님) || 퇴소 > 월말)
        if (r.admissionDate && r.admissionDate <= lastIso) {
          if (r.dischargeDate) { if (r.dischargeDate > lastIso) census++ }
          else if (r.status !== 'discharged') census++
        }
      })
      rows.push({ key: prefix, label: `${m}월`, 입소: adm, 퇴소: dis, 재원: census, net: adm - dis })
    }
    return rows
  }, [residents, months])

  const cur = data[data.length - 1]
  const prev = data[data.length - 2]
  const diff = cur && prev ? cur.재원 - prev.재원 : 0
  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const trendCls = diff > 0 ? 'text-teal-600 bg-teal-50' : diff < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'

  const empty = data.every(d => d.재원 === 0 && d.입소 === 0 && d.퇴소 === 0)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="text-sm font-bold text-gray-800">입소자 추이 (최근 {months}개월)</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">막대 = 월별 입소·퇴소 · 선 = 월말 재원 인원</p>
        </div>
        {cur && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[11px] text-gray-400">이번 달 재원</p>
              <p className="text-xl font-extrabold text-gray-900 leading-tight">{cur.재원}<span className="text-xs font-bold text-gray-400">명</span></p>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trendCls}`}>
              <TrendIcon size={13} />
              {diff > 0 ? `+${diff}` : diff}
            </span>
          </div>
        )}
      </div>

      {empty ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400">표시할 입소 데이터가 없습니다</div>
      ) : (
        <div className="h-56 md:h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}
                formatter={(v: any, n: any) => [`${v}명`, n]}
                labelFormatter={(l) => `${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={7} />
              <Bar dataKey="입소" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="퇴소" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Line type="monotone" dataKey="재원" stroke="#FF6B35" strokeWidth={2.5} dot={{ r: 3, fill: '#FF6B35' }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Printer } from 'lucide-react'
import { apiClient } from '@/api/client'

/**
 * 월간 운영 리포트 — 입소·인력·서류·지출·사고를 한 장으로.
 * 매달 손으로 모으던 숫자를 자동 집계하고, 인쇄 버튼으로 PDF 저장한다.
 * (전역 인쇄 규칙이 사이드바·헤더를 걷어내므로 이 페이지 그대로 찍힌다)
 */
interface Report {
  month: string
  residents: { in_house: number; admissions: number; discharges: number
    by_floor: Record<string, number>; admission_names: string[]; discharge_names: string[] }
  staff: { employed: number; hires: number; resigns: number
    by_position: Record<string, number>; caregivers: number; ratio: number | null
    hire_names: string[]; resign_names: string[] }
  docs: { expiring_90d: { name: string; end: string; grade?: string | null }[] }
  expense: { total: number; by_category: Record<string, number>; count: number }
  incidents: { total: number; by_type: Record<string, number>; guardian_notified: number }
  activity: { annual_used: number; visits_approved: number }
}

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

export default function MonthlyReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true); setErr('')
    apiClient.get('/api/v1/admin/reports/monthly', { params: { month } })
      .then(r => setData(r.data?.data ?? null))
      .catch(e => setErr(e?.response?.data?.detail ?? '집계에 실패했습니다.'))
      .finally(() => setLoading(false))
  }, [month])
  useEffect(load, [load])

  const move = (d: number) => {
    const [y, m] = month.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const [y, m] = month.split('-').map(Number)

  const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 break-inside-avoid">
      <h2 className="text-sm font-bold text-gray-800 mb-2.5 border-b border-gray-100 pb-1.5">{title}</h2>
      {children}
    </section>
  )
  const Row = ({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) => (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-xs text-gray-500">{k}</span>
      <span className={`text-sm ${strong ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-700'}`}>{v}</span>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap mb-4" data-print="off">
        <BarChart3 size={20} className="text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">월간 운영 리포트</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => move(-1)} className="p-2 rounded-lg border border-gray-200 text-gray-500"><ChevronLeft size={15} /></button>
          <span className="text-sm font-bold text-gray-800 min-w-[7rem] text-center">{y}년 {m}월</span>
          <button onClick={() => move(1)} className="p-2 rounded-lg border border-gray-200 text-gray-500"><ChevronRight size={15} /></button>
          <button onClick={() => window.print()}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
            <Printer size={14} /> 인쇄 · PDF 저장
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : err ? (
        <p className="text-sm text-red-500 text-center py-16">{err}</p>
      ) : data && (
        <div className="space-y-3">
          {/* 인쇄용 머리말 */}
          <div className="hidden print:block text-center mb-2">
            <h1 className="text-lg font-extrabold">행복한요양원 월간 운영 리포트 — {y}년 {m}월</h1>
            <p className="text-[10px] text-gray-500">출력일 {new Date().toLocaleDateString('ko-KR')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2">
            <Sec title="입소 현황">
              <Row k="월말 재원" v={`${data.residents.in_house}명`} strong />
              <Row k="입소" v={`${data.residents.admissions}명${data.residents.admission_names.length ? ` (${data.residents.admission_names.join(', ')})` : ''}`} />
              <Row k="퇴소" v={`${data.residents.discharges}명${data.residents.discharge_names.length ? ` (${data.residents.discharge_names.join(', ')})` : ''}`} />
              <Row k="층별" v={Object.entries(data.residents.by_floor).map(([f, n]) => `${f} ${n}`).join(' · ') || '-'} />
            </Sec>

            <Sec title="인력 현황">
              <Row k="월말 재직" v={`${data.staff.employed}명`} strong />
              <Row k="입사 / 퇴사" v={`${data.staff.hires}명 / ${data.staff.resigns}명`} />
              {(data.staff.hire_names.length > 0 || data.staff.resign_names.length > 0) && (
                <p className="text-[11px] text-gray-400 py-0.5">
                  {data.staff.hire_names.length > 0 && `입사: ${data.staff.hire_names.join(', ')}`}
                  {data.staff.hire_names.length > 0 && data.staff.resign_names.length > 0 && ' · '}
                  {data.staff.resign_names.length > 0 && `퇴사: ${data.staff.resign_names.join(', ')}`}
                </p>
              )}
              <Row k="요양보호사 대비 재원 비율" v={data.staff.ratio != null ? `${data.staff.ratio} : 1` : '-'} />
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                {Object.entries(data.staff.by_position).map(([p, n]) => `${p} ${n}`).join(' · ')}
              </p>
            </Sec>

            <Sec title="사고 (보고서 기준)">
              <Row k="총 건수" v={`${data.incidents.total}건`} strong />
              <Row k="유형별" v={Object.entries(data.incidents.by_type).map(([t, n]) => `${t} ${n}`).join(' · ') || '없음'} />
              <Row k="보호자 안내" v={data.incidents.total ? `${data.incidents.guardian_notified}/${data.incidents.total}건` : '-'} />
              {data.incidents.total > data.incidents.guardian_notified && (
                <p className="text-[11px] font-bold text-red-500 mt-1">⚠ 보호자 미안내 {data.incidents.total - data.incidents.guardian_notified}건 — 사고 보고서에서 확인</p>
              )}
            </Sec>

            <Sec title="지출 (승인 기준)">
              <Row k="총액" v={won(data.expense.total)} strong />
              <Row k="건수" v={`${data.expense.count}건`} />
              {Object.entries(data.expense.by_category).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <Row key={c} k={c} v={won(v)} />
              ))}
            </Sec>
          </div>

          <Sec title="인정서 만료 임박 (다음 90일)">
            {data.docs.expiring_90d.length === 0 ? (
              <p className="text-xs text-gray-400">해당 없음</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {data.docs.expiring_90d.map((d2, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1 font-semibold text-gray-700">{d2.name}</td>
                      <td className="py-1 text-gray-500">{d2.grade ?? ''}</td>
                      <td className="py-1 text-right font-bold text-amber-600">{d2.end} 만료</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Sec>

          <Sec title="활동">
            <Row k="직원 연차 사용(승인)" v={`${data.activity.annual_used}일`} />
            <Row k="보호자 면회(확정)" v={`${data.activity.visits_approved}건`} />
          </Sec>
        </div>
      )}
    </div>
  )
}

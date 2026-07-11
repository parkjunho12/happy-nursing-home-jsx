import { Plus, X, RefreshCw } from 'lucide-react'
import DateField from '@/components/ui/DateField'
import {
  type Certification, type Benefit,
  endFromStart, renewalDue, daysUntil, certState,
} from '@/utils/cert'

/**
 * 장기요양인정서 편집기 — 입소 등록·서류현황 공용.
 * - 인정서 1건 = 등급 + 유효기간(시작~종료, 2/3/4년) + 급여목록(재가/시설, 각 적용일)
 * - 재가→시설 변경 = 시설급여 적용일 추가(종료일 공유), 재가·시설 동시 보유 가능
 * - 갱신: 종료 90일 전이 신청 기준
 */

const GRADES = ['1', '2', '3', '4', '5', '등급외']
const inp = 'px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/30'

interface Props {
  value: Certification[]
  onChange: (next: Certification[]) => void
}

export default function CertificationEditor({ value, onChange }: Props) {
  const certs = value ?? []

  const patch = (i: number, p: Partial<Certification>) =>
    onChange(certs.map((c, ci) => ci === i ? { ...c, ...p } : c))

  const setGrade = (i: number, g: string) => {
    const c = certs[i]
    if (g === '등급외') {
      patch(i, { grade: g, end: endFromStart(c.start, 1), benefits: [] })
    } else {
      const benefits = (c.benefits && c.benefits.length) ? c.benefits : [{ type: '시설', from: c.start || '' }]
      patch(i, { grade: g, benefits })
    }
  }
  const setStart = (i: number, v: string) => {
    const c = certs[i]
    if (c.grade === '등급외') { patch(i, { start: v, end: endFromStart(v, 1), benefits: [] }); return }
    const oldStart = c.start
    const end = c.end || endFromStart(v, 2)
    const benefits = (c.benefits || []).map((b, bi) => {
      // 첫 인정서: 유효기간 시작일을 바꾸면 급여 적용일도 함께 이동
      if (i === 0 && (bi === 0 || !b.from || b.from === oldStart)) return { ...b, from: v }
      // 그 외(갱신·변경): 비어있는 첫 급여만 채움
      if (i !== 0 && bi === 0 && !b.from) return { ...b, from: v }
      return b
    })
    patch(i, { start: v, end, benefits })
  }
  const applyPreset = (i: number, years: number) =>
    patch(i, { end: endFromStart(certs[i].start, years) })

  const setBenefit = (i: number, bi: number, p: Partial<Benefit>) =>
    patch(i, { benefits: (certs[i].benefits || []).map((b, x) => x === bi ? { ...b, ...p } : b) })
  const addBenefit = (i: number) =>
    patch(i, { benefits: [...(certs[i].benefits || []), { type: '재가', from: certs[i].start || '' }] })
  const rmBenefit = (i: number, bi: number) =>
    patch(i, { benefits: (certs[i].benefits || []).filter((_, x) => x !== bi) })

  const addCert = () => {
    const last = certs[certs.length - 1]
    const start = last?.end ? new Date(new Date(last.end).getTime() + 86400000).toISOString().slice(0, 10) : ''
    onChange([...certs, { grade: last?.grade || '3', cert_no: '', start, end: endFromStart(start, 2), benefits: [{ type: '시설', from: start }] }])
  }
  const rmCert = (i: number) => onChange(certs.filter((_, x) => x !== i))

  return (
    <div className="space-y-3">
      {certs.map((c, i) => {
        const st = certState(c)
        const due = renewalDue(c.end)
        const dDue = daysUntil(due)
        const isLatest = i === certs.length - 1
        return (
          <div key={i} className={`rounded-xl border p-3 ${isLatest ? 'border-primary-orange/40 bg-orange-50/30' : 'border-gray-200 bg-gray-50/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">
                인정서 {certs.length > 1 ? `#${i + 1}` : ''} {isLatest && certs.length > 1 && <span className="text-primary-orange">· 현재</span>}
              </span>
              {certs.length > 1 && <button type="button" onClick={() => rmCert(i)} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>}
            </div>

            {/* 등급 + 인정번호 */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">등급</span>
                <select value={c.grade ?? '3'} onChange={e => setGrade(i, e.target.value)} className={`${inp} w-24`}>
                  {GRADES.map(g => <option key={g} value={g}>{g === '등급외' ? '등급외' : `${g}등급`}</option>)}
                </select>
              </div>
              <input value={c.cert_no ?? ''} onChange={e => patch(i, { cert_no: e.target.value })}
                placeholder="인정번호(선택)" className={`${inp} flex-1 min-w-[8rem]`} />
            </div>

            {/* 유효기간 */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 w-10">유효기간</span>
              <DateField value={c.start} onChange={v => setStart(i, v)} className={inp} wrapperClassName="flex-1 min-w-[8rem]" placeholder="시작일" />
              <span className="text-gray-400">~</span>
              <DateField value={c.end} onChange={v => patch(i, { end: v })} className={inp} wrapperClassName="flex-1 min-w-[8rem]" placeholder="종료일" disabled={c.grade === '등급외'} />
            </div>
            <div className="flex items-center gap-1.5 mb-2 pl-11">
              <span className="text-[11px] text-gray-400">기간</span>
              {c.grade === '등급외' ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">1년 고정</span>
              ) : [1, 2, 3, 4].map(y => (
                <button key={y} type="button" onClick={() => applyPreset(i, y)}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 hover:border-primary-orange hover:text-primary-orange">{y}년</button>
              ))}
              {c.end && (
                <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  st.status === 'expired' ? 'bg-red-100 text-red-600'
                  : st.status === 'renew' ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'}`}>
                  {st.status === 'expired' ? '만료 지남'
                    : st.status === 'renew' ? `갱신대상 · 만료 D${st.daysToEnd! <= 0 ? '' : '-'}${Math.abs(st.daysToEnd!)}`
                    : `갱신기준일 ${due}${dDue !== null ? ` (D-${dDue})` : ''}`}
                </span>
              )}
            </div>

            {/* 급여 */}
            {c.grade === '등급외' ? (
              <p className="pl-11 text-[11px] text-gray-400">등급외 · 적용 급여 없음</p>
            ) : (
            <div className="pl-11 space-y-1.5">
              {(c.benefits || []).map((b, bi) => (
                <div key={bi} className="flex items-center gap-1.5">
                  <select value={b.type} onChange={e => setBenefit(i, bi, { type: e.target.value })} className={`${inp} w-24`}>
                    <option value="재가">재가급여</option>
                    <option value="시설">시설급여</option>
                  </select>
                  <span className="text-[11px] text-gray-400">적용</span>
                  <DateField value={b.from} onChange={v => setBenefit(i, bi, { from: v })} className={inp} wrapperClassName="flex-1 min-w-[7rem]" placeholder="적용일" />
                  {(c.benefits || []).length > 1 && <button type="button" onClick={() => rmBenefit(i, bi)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>}
                </div>
              ))}
              <button type="button" onClick={() => addBenefit(i)} className="text-[11px] font-semibold text-teal-600 hover:underline">+ 급여 추가 (재가↔시설 변경·동시)</button>
            </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addCert}
        className="flex items-center gap-1.5 text-xs font-bold text-primary-orange hover:underline">
        {certs.length === 0 ? <Plus className="w-4 h-4" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {certs.length === 0 ? '인정서 등록' : '갱신 인정서 추가'}
      </button>
      {certs.length === 0 && <p className="text-[11px] text-gray-400">아직 없음 — 인정서를 등록하세요.</p>}
    </div>
  )
}

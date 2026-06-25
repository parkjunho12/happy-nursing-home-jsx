'use client'

import { useState } from 'react'
import { resolveApiBase } from '@/lib/api-client'

const ACTIVITIES = ['말벗', '프로그램 보조', '행사 지원', '재능기부', '기타']
const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const TIMES = ['오전', '오후', '저녁', '협의 가능']

export default function VolunteerForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birth, setBirth] = useState('')
  const [activity, setActivity] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [time, setTime] = useState('')
  const [experience, setExperience] = useState('')
  const [memo, setMemo] = useState('')
  const [agree, setAgree] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (d: string) =>
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { setError('이름과 연락처를 입력해주세요.'); return }
    if (!agree) { setError('개인정보 수집에 동의해주세요.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`${resolveApiBase()}/api/v1/public/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          birth_or_age: birth.trim() || null,
          preferred_activity: activity || null,
          preferred_day: days.join(', ') || null,
          preferred_time: time || null,
          experience: experience.trim() || null,
          memo: memo.trim() || null,
          privacy_agreed: agree,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.detail || json?.error || '신청에 실패했습니다.')
      setDone(true)
    } catch (e: any) {
      setError(e?.message ?? '신청에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-orange-100 bg-orange-50 p-8 text-center">
        <div className="text-4xl mb-3">🌸</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">신청이 완료되었습니다</h3>
        <p className="text-gray-600 leading-relaxed">담당자가 확인 후 연락드리겠습니다.<br />소중한 마음에 감사드립니다.</p>
      </div>
    )
  }

  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5'
  const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 bg-gray-50 focus:bg-white transition-all'

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">⚠️ {error}</div>
      )}

      <div>
        <label className={labelCls}>이름 <span className="text-orange-500">*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="성함을 입력해주세요" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>연락처 <span className="text-orange-500">*</span></label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>생년월일 또는 나이</label>
        <input value={birth} onChange={e => setBirth(e.target.value)} placeholder="예) 1990-01-01 또는 35세" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>희망 활동</label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map(a => (
            <button type="button" key={a} onClick={() => setActivity(a)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${activity === a ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>희망 요일</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button type="button" key={d} onClick={() => toggleDay(d)}
              className={`w-11 h-11 rounded-full text-sm font-semibold border transition-colors ${days.includes(d) ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>희망 시간</label>
        <div className="flex flex-wrap gap-2">
          {TIMES.map(t => (
            <button type="button" key={t} onClick={() => setTime(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${time === t ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>봉사 경험 <span className="text-gray-400 font-normal">(선택)</span></label>
        <textarea value={experience} onChange={e => setExperience(e.target.value)} rows={2} placeholder="이전 봉사 경험이 있다면 간단히 적어주세요" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>간단한 메모 <span className="text-gray-400 font-normal">(선택)</span></label>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="전하고 싶은 말씀이 있다면 자유롭게 적어주세요" className={inputCls} />
      </div>

      <label className="flex items-start gap-2.5 rounded-xl bg-gray-50 px-4 py-3.5 cursor-pointer">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 accent-orange-500" />
        <span className="text-sm text-gray-600 leading-relaxed">
          개인정보 수집 및 이용에 동의합니다. <span className="text-orange-500">*</span><br />
          <span className="text-xs text-gray-400">수집 항목: 이름, 연락처 등 / 목적: 자원봉사 상담 및 안내 / 보관: 상담 완료 후 파기</span>
        </span>
      </label>

      <button onClick={submit} disabled={submitting}
        className="w-full bg-primary-orange hover:bg-primary-orange/90 active:scale-[0.99] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-60 text-base shadow-lg shadow-orange-200">
        {submitting ? '신청 중...' : '자원봉사 신청하기'}
      </button>
    </div>
  )
}

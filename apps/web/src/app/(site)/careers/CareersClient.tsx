'use client'

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Clock3, Wallet, BadgeCheck, Mail, ChevronRight, CheckCircle2 } from 'lucide-react'
import { resolveApiBase } from '@/lib/api-client'
import { SITE_INFO } from '@/lib/constants'

interface Post {
  id: string
  title: string
  category?: string | null
  employment_type?: string | null
  work_time?: string | null
  salary?: string | null
  description?: string | null
  status: string
  is_public: boolean
}

const RESUME_EMAIL = SITE_INFO.email

export default function CareersClient() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)

  const [postId, setPostId] = useState<string>('')
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [experience, setExperience] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [agree, setAgree] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${resolveApiBase()}/api/v1/public/recruitment/posts`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (alive && json?.success && Array.isArray(json.data)) setPosts(json.data)
      } catch { /* noop */ }
      finally { if (alive) setLoadingPosts(false) }
    })()
    return () => { alive = false }
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    posts.forEach(p => { if (p.category) set.add(p.category) })
    return Array.from(set)
  }, [posts])

  const applyTo = (p: Post) => {
    setPostId(p.id)
    setCategory(p.category || p.title)
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })
  }

  const mailtoResume = useMemo(() => {
    const subject = encodeURIComponent(`[채용지원 이력서] ${name || '성함'} - ${category || '지원분야'}`)
    const body = encodeURIComponent(
      `행복한요양원 녹양역점 채용 지원자입니다.\n\n- 이름: ${name}\n- 지원분야: ${category}\n- 연락처: ${phone}\n\n이력서를 첨부합니다.`,
    )
    return `mailto:${RESUME_EMAIL}?subject=${subject}&body=${body}`
  }, [name, category, phone])

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { setError('이름과 연락처를 입력해주세요.'); return }
    if (!category.trim()) { setError('지원 분야를 선택해주세요.'); return }
    if (!agree) { setError('개인정보 수집에 동의해주세요.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`${resolveApiBase()}/api/v1/public/recruitment/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruitment_post_id: postId || null,
          category: category.trim(),
          name: name.trim(),
          birth: birth.trim() || null,
          phone: phone.trim(),
          email: email.trim() || null,
          experience: experience.trim() || null,
          introduction: introduction.trim() || null,
          privacy_agreed: agree,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.detail || json?.error || '지원에 실패했습니다.')
      setDone(true)
      document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })
    } catch (e: any) {
      setError(e?.message ?? '지원에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally { setSubmitting(false) }
  }

  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5'
  const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 bg-gray-50 focus:bg-white transition-all'

  const open = posts.filter(p => p.status !== '마감')
  const closed = posts.filter(p => p.status === '마감')

  return (
    <>
      {/* ── 공고 목록 ── */}
      <section id="positions" className="py-14 md:py-20 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">채용 공고</h2>
            <p className="text-gray-600">현재 모집 중인 포지션입니다. 관심 있는 공고로 바로 지원해보세요.</p>
          </div>

          {loadingPosts ? (
            <div className="text-center text-gray-400 py-10">공고를 불러오는 중…</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 text-center text-gray-500">
              현재 등록된 공고가 없습니다. 채용 문의는 <a href={`tel:${SITE_INFO.phone}`} className="text-primary-orange font-semibold">{SITE_INFO.phone}</a> 로 연락주세요.
            </div>
          ) : (
            <div className="space-y-4">
              {[...open, ...closed].map(p => {
                const isClosed = p.status === '마감'
                return (
                  <div key={p.id} className={`rounded-2xl border bg-white p-5 sm:p-6 shadow-sm transition-shadow ${isClosed ? 'border-gray-100 opacity-70' : 'border-orange-100 hover:shadow-md'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${isClosed ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}`}>
                            <BadgeCheck className="w-3.5 h-3.5" />{isClosed ? '마감' : '모집중'}
                          </span>
                          {p.category && <span className="text-xs font-semibold text-orange-600">{p.category}</span>}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">{p.title}</h3>
                        {p.description && <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{p.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-500">
                          {p.employment_type && <span className="inline-flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-gray-400" />{p.employment_type}</span>}
                          {p.work_time && <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4 text-gray-400" />{p.work_time}</span>}
                          {p.salary && <span className="inline-flex items-center gap-1.5"><Wallet className="w-4 h-4 text-gray-400" />{p.salary}</span>}
                        </div>
                      </div>
                      {!isClosed && (
                        <button onClick={() => applyTo(p)} className="shrink-0 inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary-orange text-white text-sm font-bold hover:bg-primary-orange/90 transition-colors">
                          지원하기 <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── 지원 폼 ── */}
      <section id="apply" className="py-14 md:py-20 bg-[#faf7f3] scroll-mt-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">지원하기</h2>
            <p className="text-gray-600">약 3분이면 충분합니다. 이력서는 아래 안내된 이메일로 보내주세요.</p>
          </div>

          {done ? (
            <div className="rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
              <div className="text-4xl mb-3">🙏</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">지원해주셔서 감사합니다</h3>
              <p className="text-gray-600 leading-relaxed mb-5">담당자가 검토 후 연락드리겠습니다.</p>
              <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4 text-left">
                <p className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5"><Mail className="w-4 h-4 text-primary-orange" /> 이력서 보내기</p>
                <p className="text-sm text-gray-600 leading-relaxed">이력서(PDF·DOCX)를 <b className="text-gray-900">{RESUME_EMAIL}</b> 로 보내주시면 검토에 큰 도움이 됩니다.</p>
                <a href={mailtoResume} className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors">
                  <Mail className="w-4 h-4" /> 이메일로 이력서 보내기
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(184,110,40,0.12)] space-y-5">
              {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">⚠️ {error}</div>}

              {/* 이력서 안내 (상단 고정) */}
              <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4">
                <p className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5"><Mail className="w-4 h-4 text-primary-orange" /> 이력서는 이메일로 보내주세요</p>
                <p className="text-sm text-gray-600 leading-relaxed">아래 지원서를 제출하신 뒤, 이력서(PDF·DOCX)를 <b className="text-gray-900">{RESUME_EMAIL}</b> 로 보내주세요.</p>
              </div>

              <div>
                <label className={labelCls}>지원 분야 <span className="text-orange-500">*</span></label>
                {categories.length > 0 ? (
                  <select value={category} onChange={e => { setCategory(e.target.value); setPostId('') }} className={inputCls}>
                    <option value="">분야를 선택해주세요</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="기타">기타</option>
                  </select>
                ) : (
                  <input value={category} onChange={e => setCategory(e.target.value)} placeholder="예) 요양보호사" className={inputCls} />
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>이름 <span className="text-orange-500">*</span></label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="성함" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>생년월일</label>
                  <input value={birth} onChange={e => setBirth(e.target.value)} placeholder="예) 1990-01-01" className={inputCls} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>연락처 <span className="text-orange-500">*</span></label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>이메일</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>경력 <span className="text-gray-400 font-normal">(선택)</span></label>
                <textarea value={experience} onChange={e => setExperience(e.target.value)} rows={2} placeholder="관련 경력이 있다면 간단히 적어주세요" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>자기소개 <span className="text-gray-400 font-normal">(선택)</span></label>
                <textarea value={introduction} onChange={e => setIntroduction(e.target.value)} rows={3} placeholder="지원 동기나 강점을 자유롭게 적어주세요" className={inputCls} />
              </div>

              <label className="flex items-start gap-2.5 rounded-xl bg-gray-50 px-4 py-3.5 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 w-5 h-5 accent-orange-500" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  개인정보 수집 및 이용에 동의합니다. <span className="text-orange-500">*</span><br />
                  <span className="text-xs text-gray-400">수집 항목: 이름, 연락처, 이메일 등 / 목적: 채용 전형 및 안내 / 보관: 채용 종료 후 파기</span>
                </span>
              </label>

              <button onClick={submit} disabled={submitting}
                className="w-full bg-primary-orange hover:bg-primary-orange/90 active:scale-[0.99] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-60 text-base shadow-lg shadow-orange-200">
                {submitting ? '지원 중...' : '지원서 제출하기'}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> 제출 후 이력서를 {RESUME_EMAIL} 로 보내주세요
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

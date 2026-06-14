'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '@/lib/api-client'

async function familyLogin(phone: string, password: string) {
  const form = new FormData()
  form.append('phone', phone)
  form.append('password', password)
  const res = await fetch(`${API_BASE_URL}/api/v1/family/login`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('로그인 실패')
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? '로그인 실패')
  return json.data
}

export default function FamilyLoginPage() {
  const router = useRouter()
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // 이미 로그인된 경우 앨범으로
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('family_token')) {
      router.replace('/family/albums')
    }
  }, [])

  const handleLogin = async () => {
    if (!phone || !password) { setError('전화번호와 비밀번호를 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      const data = await familyLogin(phone, password)
      localStorage.setItem('family_token',     data.token)
      localStorage.setItem('family_guardian',  JSON.stringify(data.guardian))
      localStorage.setItem('family_residents', JSON.stringify(data.residents))
      router.push('/family/albums')
    } catch {
      setError('전화번호 또는 비밀번호가 올바르지 않습니다')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white flex flex-col">
      {/* 상단 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-6 ring-4 ring-orange-100">
            <span className="text-5xl">🌸</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">행복한요양원</h1>
          <p className="text-gray-500 mt-2.5 text-base leading-relaxed">
            소중한 가족의 일상을<br className="sm:hidden"/>
            <span className="hidden sm:inline"> </span>언제 어디서나 확인하세요
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-orange-100 w-full max-w-sm p-8 ring-1 ring-orange-100">
          <h2 className="font-bold text-gray-900 text-xl mb-1 text-center">보호자 로그인</h2>
          <p className="text-xs text-gray-400 text-center mb-7">가족 앨범을 보려면 로그인해 주세요</p>

          <div className="space-y-4">
            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">전화번호</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">📱</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="010-0000-0000"
                  className="w-full pl-11 pr-4 py-4 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 bg-gray-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">비밀번호</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full pl-11 pr-4 py-4 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 bg-gray-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5 text-sm text-red-600 text-center font-medium">
                ⚠️ {error}
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-60 text-base shadow-lg shadow-orange-200 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  로그인 중...
                </span>
              ) : '로그인 →'}
            </button>
          </div>

          {/* 안내 */}
          <div className="mt-7 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              계정이 없으신가요?
            </p>
            <a
              href="tel:031-856-8090"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-orange-600 font-bold hover:text-orange-700"
            >
              📞 031-856-8090 으로 문의해 주세요
            </a>
          </div>
        </div>

        {/* 특징 */}
        <div className="mt-8 flex gap-6 text-center">
          {[
            { icon: '🔒', label: '안전한 보안' },
            { icon: '📸', label: '사진·영상' },
            { icon: '📱', label: '모바일 최적화' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-lg">
                {item.icon}
              </div>
              <p className="text-xs text-gray-500 font-medium">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 */}
      <div className="text-center py-6">
        <a href="/" className="text-xs text-gray-400 hover:text-orange-500 transition-colors">
          ← 행복한요양원 홈페이지
        </a>
        <p className="text-xs text-gray-300 mt-2">© 행복한요양원</p>
      </div>
    </div>
  )
}

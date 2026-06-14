import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { familyAPI } from '@/api/albumClient'

export default function FamilyLoginPage() {
  const nav = useNavigate()
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const login = async () => {
    if (!phone || !password) { setError('전화번호와 비밀번호를 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      const data = await familyAPI.login(phone, password)
      localStorage.setItem('family_token',    data.token)
      localStorage.setItem('family_guardian', JSON.stringify(data.guardian))
      localStorage.setItem('family_residents', JSON.stringify(data.residents))
      nav('/family/albums')
    } catch {
      setError('전화번호 또는 비밀번호가 올바르지 않습니다')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col items-center justify-center px-5">
      {/* 로고 / 인트로 */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">🌸</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">행복한요양원</h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          소중한 가족의 일상을<br/>언제 어디서나 확인하세요
        </p>
      </div>

      {/* 로그인 카드 */}
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-7">
        <h2 className="font-bold text-gray-900 text-lg mb-6 text-center">보호자 로그인</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">전화번호</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key==='Enter' && login()}
              placeholder="010-0000-0000"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-all"/>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key==='Enter' && login()}
              placeholder="비밀번호를 입력하세요"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-all"/>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <button onClick={login} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-60 text-base shadow-lg shadow-orange-200 mt-2">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          계정이 없으신가요?<br/>
          <span className="text-orange-500 font-medium">요양원에 문의해 주세요 📞</span>
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-8">© 행복한요양원</p>
    </div>
  )
}

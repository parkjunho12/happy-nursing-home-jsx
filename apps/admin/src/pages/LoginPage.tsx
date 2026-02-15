import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const ids = useMemo(
    () => ({
      error: 'login-error',
      email: 'login-email',
      password: 'login-password',
    }),
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.message || '로그인에 실패했습니다')
    }
  }

  const hasError = Boolean(error)

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* 배경: 톤다운 + 라이트 포인트 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#fff7f2] via-white to-[#fff1e8]" />
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-orange/20 blur-3xl" />
      <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-primary-brown/15 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5">
            <span className="text-3xl">🏥</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            행복한요양원
          </h1>
          <p className="mt-1 text-sm text-gray-600">관리자 로그인</p>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
          <div className="p-7">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {hasError && (
                <div
                  id={ids.error}
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">로그인 실패</p>
                    <p className="mt-0.5 text-red-700/90">{error}</p>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor={ids.email}
                  className="block text-sm font-semibold text-gray-900"
                >
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id={ids.email}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@nursing-home.com"
                    autoComplete="email"
                    required
                    aria-invalid={hasError ? true : undefined}
                    aria-describedby={hasError ? ids.error : undefined}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pl-11 text-gray-900 placeholder:text-gray-400
                               shadow-sm outline-none transition
                               focus:border-primary-orange/60 focus:ring-4 focus:ring-primary-orange/15"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label
                  htmlFor={ids.password}
                  className="block text-sm font-semibold text-gray-900"
                >
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id={ids.password}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pl-11 text-gray-900 placeholder:text-gray-400
                               shadow-sm outline-none transition
                               focus:border-primary-orange/60 focus:ring-4 focus:ring-primary-orange/15"
                  />
                </div>
              </div>

              {/* 버튼 */}
              <button
                type="submit"
                disabled={isLoading}
                className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-orange px-4 py-3 font-semibold text-white
                           shadow-[0_12px_30px_-16px_rgba(255,107,53,0.9)]
                           transition hover:brightness-[1.02] hover:shadow-[0_16px_40px_-18px_rgba(255,107,53,0.95)]
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{isLoading ? '로그인 중...' : '로그인'}</span>
                {!isLoading && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            {/* 테스트 계정 */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900 mb-1">테스트 계정</p>
              <p className="text-sm text-slate-700">
                이메일: <span className="font-medium">admin@nursing-home.com</span>
                <br />
                비밀번호: <span className="font-medium">admin123</span>
              </p>
            </div>
          </div>

          {/* 카드 하단 얇은 라인 */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />

          <div className="px-7 py-4 text-center">
            <p className="text-xs text-gray-500">
              © 2024 행복한요양원. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

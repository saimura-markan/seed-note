import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    onLogin(data.user)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && email && password) handleLogin()
  }

  return (
    <div className="min-h-screen flex">
      {/* 左パネル：グリーン背景 */}
      <div className="hidden md:flex w-1/2 bg-emerald-900 flex-col items-center justify-center px-12 relative overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-emerald-950" />
        <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full bg-emerald-700/30" />
        <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 rounded-full bg-emerald-700/20" />

        <div className="relative z-10 text-center">
          <div className="text-7xl mb-6 select-none">🌱</div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Seed Note</h1>
          <div className="w-12 h-0.5 bg-emerald-400 mx-auto mb-8 rounded-full" />
          <p className="text-emerald-200 text-xl font-medium mb-3 leading-relaxed">
            クレームは、成長の種。
          </p>
          <p className="text-emerald-400 text-sm leading-relaxed">
            記録し、分析し、組織が育つ。
          </p>
        </div>
      </div>

      {/* 右パネル：白背景 */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-8">
        <div className="w-full max-w-sm">
          {/* モバイル時のロゴ */}
          <div className="md:hidden text-center mb-8">
            <span className="text-4xl">🌱</span>
            <h1 className="text-2xl font-bold text-emerald-800 mt-2">Seed Note</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">おかえりなさい</h2>
          <p className="text-sm text-gray-400 mb-8">アカウント情報を入力してください</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  ログイン中...
                </span>
              ) : 'ログイン'}
            </button>
          </div>

          <p className="text-xs text-gray-300 text-center mt-8">
            Seed Note — E-Li / OrderIn 共通DB
          </p>
        </div>
      </div>
    </div>
  )
}

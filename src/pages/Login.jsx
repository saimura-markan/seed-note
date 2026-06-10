import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

// ─── 認証ロジック（変更禁止） ─────────────────────────────────────────────────

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

  // ─── UI state のみ ──────────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  return (
    <>
      {/* 葉っぱアニメーション用スタイル */}
      <style>{`
        @keyframes leafFloat {
          0%   { transform: translateY(0)   rotate(0deg)   opacity: 0.15; }
          50%  { transform: translateY(-28px) rotate(12deg) opacity: 0.25; }
          100% { transform: translateY(0)   rotate(0deg)   opacity: 0.15; }
        }
        @keyframes leafDrift {
          0%   { transform: translateY(0)   rotate(-8deg)  opacity: 0.12; }
          50%  { transform: translateY(-20px) rotate(4deg) opacity: 0.22; }
          100% { transform: translateY(0)   rotate(-8deg)  opacity: 0.12; }
        }
        .leaf-1 { animation: leafFloat 7s ease-in-out infinite; }
        .leaf-2 { animation: leafDrift 9s ease-in-out infinite 1.5s; }
        .leaf-3 { animation: leafFloat 11s ease-in-out infinite 3s; }
        .leaf-4 { animation: leafDrift 8s ease-in-out infinite 0.8s; }
        .leaf-5 { animation: leafFloat 10s ease-in-out infinite 4s; }
      `}</style>

      <div className="min-h-screen flex flex-col md:flex-row">

        {/* ══════════════════════════════════════
            左エリア 65%
        ══════════════════════════════════════ */}
        <div className="hidden md:flex md:w-[65%] relative flex-col overflow-hidden"
          style={{ backgroundImage: 'url(/seed-note-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

          {/* 背景オーバーレイ（可読性確保） */}
          <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.15)' }} />

        </div>

        {/* ══════════════════════════════════════
            右エリア 35%
        ══════════════════════════════════════ */}
        <div className="w-full md:w-[35%] flex items-center justify-center bg-white px-8 py-12">
          <div className="w-full max-w-sm">

            {/* モバイル用ロゴ */}
            <div className="md:hidden text-center mb-8">
              <img src="/seed-note-logo.png" alt="Seed Note" className="h-10 w-auto mx-auto" />
            </div>

            {/* タイトル */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a4731' }}>ログイン</h2>
              <p className="text-sm text-gray-400">Seed Noteにログインしてください</p>
            </div>

            <div className="space-y-4">

              {/* メールアドレス */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">メールアドレス</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="email"
                    placeholder="メールアドレスを入力"
                    className="w-full h-11 pl-9 pr-4 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition"
                    style={{ '--tw-ring-color': '#4ade80' }}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.25)'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  />
                </div>
              </div>

              {/* パスワード */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">パスワード</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="current-password"
                    placeholder="パスワードを入力"
                    className="w-full h-11 pl-9 pr-10 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition"
                    onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.25)'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* ログインしたままにする + パスワード忘れ */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 accent-green-600"
                  />
                  <span className="text-xs text-gray-500">ログインしたままにする</span>
                </label>
                <button type="button" className="text-xs text-green-600 hover:underline">
                  パスワードをお忘れの方はこちら
                </button>
              </div>

              {/* エラー */}
              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              {/* ログインボタン */}
              <button
                onClick={handleLogin}
                disabled={loading || !email || !password}
                className="w-full h-12 rounded-xl text-white text-sm font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: loading || !email || !password ? '#86efac' : '#1a4731' }}
                onMouseEnter={e => { if (email && password && !loading) e.target.style.background = '#14532d' }}
                onMouseLeave={e => { if (email && password && !loading) e.target.style.background = '#1a4731' }}
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

              {/* 新規登録 */}
              <p className="text-xs text-center text-gray-400 pt-1">
                アカウントをお持ちでない方は{' '}
                <button type="button" className="text-green-600 font-semibold hover:underline">
                  新規登録はこちら
                </button>
              </p>
            </div>

            <p className="text-[11px] text-gray-300 text-center mt-10">
              © 2026 Seed Note. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </>
  )
}

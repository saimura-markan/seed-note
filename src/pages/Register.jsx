import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

const DEPARTMENTS = [
  '工事部産廃課/環境リサイクル部',
  '工事部解体課',
  '清掃部清掃２課',
  '清掃部清掃１課',
  '本部',
]

const inputCls = 'w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition'
const focusStyle = {
  onFocus: e => { e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.2)'; e.target.style.borderColor = '#86efac' },
  onBlur:  e => { e.target.style.boxShadow = ''; e.target.style.borderColor = '' },
}

export default function Register({ onLogin }) {
  const navigate = useNavigate()

  const [fullName,         setFullName]         = useState('')
  const [department,       setDepartment]       = useState('')
  const [email,            setEmail]            = useState('')
  const [password,         setPassword]         = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [showPassword,     setShowPassword]     = useState(false)
  const [showConfirm,      setShowConfirm]      = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState('')
  const [success,          setSuccess]          = useState(false)

  const canSubmit = fullName && department && email && password && confirmPassword && !loading

  const handleRegister = async () => {
    setError('')
    if (password !== confirmPassword) { setError('パスワードが一致しません'); return }
    if (password.length < 6)          { setError('パスワードは6文字以上で入力してください'); return }

    setLoading(true)
    const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }

    const userId = data?.user?.id
    if (userId) {
      await supabase.from('profiles').upsert({
        id:         userId,
        name:       fullName,
        department: department,
      })
    }

    setLoading(false)

    if (data?.session) {
      // 確認メール不要の場合：即ログイン
      onLogin?.(data.user)
    } else {
      // 確認メールが必要な場合
      setSuccess(true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canSubmit) handleRegister()
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🌱</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">確認メールを送信しました</h2>
          <p className="text-sm text-gray-500 mb-6">
            {email} に確認メールを送信しました。<br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors"
          >
            ログインページへ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/seed-note-logo.png" alt="Seed Note" className="h-20 w-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-7">
          <h2 className="text-xl font-bold text-gray-900 mb-1">新規アカウント登録</h2>
          <p className="text-xs text-gray-400 mb-6">必要事項を入力してアカウントを作成してください</p>

          <div className="space-y-4" onKeyDown={handleKeyDown}>

            {/* 部署 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">担当部署 <span className="text-red-500">*</span></label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 focus:outline-none transition"
                style={{ color: department ? '#111827' : '#d1d5db' }}
                {...focusStyle}
              >
                <option value="">部署を選択してください</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* 名前 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">お名前 <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="山田 太郎"
                  autoComplete="name"
                  className={inputCls + ' pl-9'}
                  {...focusStyle}
                />
              </div>
            </div>

            {/* メール */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">メールアドレス <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.jp"
                  autoComplete="email"
                  className={inputCls + ' pl-9'}
                  {...focusStyle}
                />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">パスワード <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6文字以上"
                  autoComplete="new-password"
                  className={inputCls + ' pl-9 pr-10'}
                  {...focusStyle}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* パスワード確認 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">パスワード（確認） <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="もう一度入力"
                  autoComplete="new-password"
                  className={inputCls + ' pl-9 pr-10'}
                  {...focusStyle}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleRegister}
              disabled={!canSubmit}
              className="w-full h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  登録中...
                </span>
              ) : 'アカウントを作成する'}
            </button>

          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-gray-400">または</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-11 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors"
          >
            ← ログインはこちら
          </button>
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-6">
          © 2026 Seed Note. All rights reserved.
        </p>
      </div>
    </div>
  )
}

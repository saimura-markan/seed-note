import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    // Supabase が detectSessionInUrl:true で自動コード交換後に PASSWORD_RECOVERY を発火する
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionLoading(false)
      }
    })

    // イベントを逃した場合のフォールバック: すでにセッションがあればそのまま表示
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async () => {
    const errs = {}
    if (pw.length < 8) errs.pw = 'パスワードは8文字以上で入力してください'
    if (pw !== pwConfirm) errs.pwConfirm = 'パスワードが一致しません'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSubmitting(false)
    if (error) {
      setErrors({ pw: 'パスワードの更新に失敗しました。もう一度お試しください。' })
      return
    }
    history.replaceState(null, '', window.location.pathname)
    setDone(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-100 p-8">

        {done ? (
          <div className="text-center space-y-4">
            <p className="text-4xl">✅</p>
            <h2 className="text-xl font-bold text-gray-800">パスワードを変更しました</h2>
            <p className="text-sm text-gray-500">新しいパスワードでログインしてください</p>
            <button
              onClick={async () => { await supabase.auth.signOut(); onDone() }}
              className="w-full h-11 rounded-xl bg-[#1a4731] text-white text-sm font-bold hover:bg-[#14532d] transition-colors"
            >
              ログイン画面へ
            </button>
          </div>

        ) : sessionLoading ? (
          <div className="text-center py-8 space-y-3">
            <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-400">リンクを確認中...</p>
          </div>

        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a4731' }}>新しいパスワードを設定</h2>
              <p className="text-sm text-gray-400">8文字以上の新しいパスワードを入力してください</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">新しいパスワード</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setErrors(er => ({ ...er, pw: '' })) }}
                  placeholder="新しいパスワード（8文字以上）"
                  className="w-full h-11 pl-9 pr-10 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition"
                  onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.2)'; e.target.style.borderColor = '#86efac' }}
                  onBlur={e => { e.target.style.boxShadow = ''; e.target.style.borderColor = '' }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.pw && <p className="text-red-500 text-xs mt-1">{errors.pw}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">パスワード（確認）</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  type={showPwConfirm ? 'text' : 'password'}
                  value={pwConfirm}
                  onChange={e => { setPwConfirm(e.target.value); setErrors(er => ({ ...er, pwConfirm: '' })) }}
                  placeholder="パスワードをもう一度入力"
                  className="w-full h-11 pl-9 pr-10 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition"
                  onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.2)'; e.target.style.borderColor = '#86efac' }}
                  onBlur={e => { e.target.style.boxShadow = ''; e.target.style.borderColor = '' }}
                />
                <button type="button" onClick={() => setShowPwConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPwConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.pwConfirm && <p className="text-red-500 text-xs mt-1">{errors.pwConfirm}</p>}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[#1a4731] hover:bg-[#14532d] text-white text-sm font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? '更新中...' : 'パスワードを変更する'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

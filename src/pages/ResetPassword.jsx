import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')
    const code = params.get('code')

    if (token_hash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
        if (error) {
          setSessionError('リンクの有効期限が切れています。もう一度パスワードリセットをお試しください。')
        } else {
          window.history.replaceState(null, '', '/reset-password')
        }
        setSessionLoading(false)
      })
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setSessionError('リンクの有効期限が切れています。もう一度パスワードリセットをお試しください。')
        } else {
          window.history.replaceState(null, '', '/reset-password')
        }
        setSessionLoading(false)
      })
    } else {
      setSessionError('無効なリンクです。パスワードリセットメールを再度お送りください。')
      setSessionLoading(false)
    }
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
    await supabase.auth.signOut()
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
              onClick={() => navigate('/login')}
              className="w-full h-11 rounded-xl bg-[#1a4731] text-white text-sm font-bold hover:bg-[#14532d] transition-colors"
            >
              ログイン画面へ
            </button>
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

            {sessionError && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                ⚠️ {sessionError}
              </p>
            )}

            {sessionError ? (
              <button onClick={() => navigate('/login')}
                className="w-full h-11 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                ← ログインに戻る
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={sessionLoading || submitting}
                className="w-full h-12 rounded-xl bg-[#1a4731] hover:bg-[#14532d] text-white text-sm font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? '更新中...' : sessionLoading ? '準備中...' : 'パスワードを変更する'}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

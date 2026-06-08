import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, User, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const inputCls = 'w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

export default function MyPage() {
  const navigate = useNavigate()
  const { user } = useOutletContext()

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ユーザー'
  const email = user?.email || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('新しいパスワードが一致しません'); return }
    if (newPassword.length < 6) { setError('パスワードは6文字以上で入力してください'); return }
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMessage('パスワードを変更しました')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] px-6 py-6">
      <div className="max-w-lg mx-auto pb-10">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft size={15} /> 戻る
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-1">マイページ</h2>
        <p className="text-xs text-gray-400 mb-6">アカウント情報の確認・変更</p>

        {/* アカウント情報 */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm mb-5 space-y-1">
          <p className="text-sm font-bold text-gray-800 mb-3">アカウント情報</p>
          <div className="flex items-center gap-3 py-2.5">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <User size={18} className="text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">ユーザー名</p>
              <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-2.5 border-t border-stone-100">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <Mail size={18} className="text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">メールアドレス</p>
              <p className="text-sm font-semibold text-gray-900">{email}</p>
            </div>
          </div>
        </div>

        {/* パスワード変更 */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-4">パスワード変更</p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className={labelCls}>新しいパスワード</label>
              <input type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="6文字以上" autoComplete="new-password"
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>新しいパスワード（確認）</label>
              <input type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力してください" autoComplete="new-password"
                className={inputCls} />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}
            {message && (
              <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">{message}</p>
            )}

            <button type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '変更中...' : 'パスワードを変更する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

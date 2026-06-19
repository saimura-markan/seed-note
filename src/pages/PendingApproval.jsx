import { supabase } from '../lib/supabase'

export default function PendingApproval({ onLogout }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout?.()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4">
      <div className="bg-white rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">
          🌱
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">承認待ち</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          アカウントは登録されました。<br />
          管理者がロールを設定するまでお待ちください。
        </p>
        <button
          onClick={handleLogout}
          className="w-full h-11 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}

import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ArrowUpRight } from 'lucide-react'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ユーザー'

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <header className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-700 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm">
            🌱
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none mb-1">Seed Note</p>
            <h1 className="text-[17px] font-bold text-gray-900 leading-none">クレーム管理ダッシュボード</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/mypage')}
            className="text-right hover:opacity-70 transition-opacity"
          >
            <p className="text-sm font-semibold text-gray-900 leading-none mb-0.5">{displayName}</p>
            <p className="text-xs text-gray-400 leading-none">品質管理部</p>
          </button>
          <button
            onClick={handleLogout}
            title="ログアウト"
            className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors group"
          >
            <LogOut size={17} className="text-stone-500 group-hover:text-red-500 transition-colors" />
          </button>
          <button
            onClick={() => navigate('/complaints/new')}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <ArrowUpRight size={15} />
            新規受付
          </button>
        </div>
      </header>

      <main>
        <Outlet context={{ user }} />
      </main>
    </div>
  )
}

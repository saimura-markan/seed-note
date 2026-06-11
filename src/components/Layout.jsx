import { Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut } from 'lucide-react'

export default function Layout({ user, onLogout }) {
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
          <p className="text-sm font-bold text-gray-900">Seed Note</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 leading-none mb-0.5">{displayName}</p>
            <p className="text-xs text-gray-400 leading-none">品質管理部</p>
          </div>
          <button
            onClick={handleLogout}
            title="ログアウト"
            className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors group"
          >
            <LogOut size={17} className="text-stone-500 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </header>

      <main>
        <Outlet context={{ user }} />
      </main>
    </div>
  )
}

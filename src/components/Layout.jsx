import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getRole } from '../lib/utils'
import { LogOut } from 'lucide-react'

const ROLE_LABELS = {
  admin:     '管理者',
  director:  '事業責任者',
  executive: '役員',
  manager:   '主任',
  judgment:  '審査担当',
  staff:     'スタッフ',
  user:      'スタッフ',
}

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const [profileName, setProfileName] = useState('')

  const role      = getRole(user)
  const roleLabel = ROLE_LABELS[role] || role

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.name) setProfileName(data.name) })
  }, [user?.id])

  const displayName = profileName
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'ユーザー'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

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
          <button
            onClick={() => navigate('/mypage')}
            className="text-right hover:opacity-70 transition-opacity"
          >
            <p className="text-sm font-semibold text-gray-900 leading-none mb-0.5">{displayName}</p>
            <p className="text-xs text-gray-400 leading-none">{roleLabel}</p>
          </button>
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

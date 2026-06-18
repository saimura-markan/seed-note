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
  const hasRole   = !!(user?.app_metadata?.seed_note_role)

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

  if (!hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🌱</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-gray-500 mb-6">管理者による権限付与をお待ちください。</p>
          <button
            onClick={handleLogout}
            className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={15} />
            ログアウト
          </button>
        </div>
      </div>
    )
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
        <Outlet context={{ user, profileName }} />
      </main>
    </div>
  )
}

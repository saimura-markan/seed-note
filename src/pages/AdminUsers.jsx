import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, name_kana, department, created_at, seed_note_role')
      .eq('seed_note_role', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProfiles(data ?? [])
        setLoading(false)
      })
  }, [])

  const projectId = import.meta.env.VITE_SUPABASE_URL
    ?.replace('https://', '')
    .replace('.supabase.co', '')
  const supabaseUsersUrl = projectId
    ? `https://supabase.com/dashboard/project/${projectId}/auth/users`
    : 'https://supabase.com/dashboard'

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> ダッシュボードに戻る
      </button>

      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-800 mb-0.5">登録ユーザー管理</h1>
            <p className="text-xs text-gray-400">ロールの設定は Supabase 管理画面で行ってください</p>
          </div>
          <a
            href={supabaseUsersUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
          >
            <ExternalLink size={13} />
            Supabase でロールを設定
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-3" />
          読み込み中...
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-6 py-12 text-center text-gray-400">
          <p className="text-3xl mb-3">👤</p>
          <p className="text-sm">登録ユーザーはいません</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">承認待ちユーザー一覧</span>
            <span className="text-xs font-bold text-gray-700">{profiles.length} 件</span>
          </div>
          <div className="divide-y divide-stone-100">
            {profiles.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{p.name || '（名前未設定）'}</p>
                  {p.name_kana && (
                    <p className="text-xs text-gray-400">{p.name_kana}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{p.department || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{fmtDateTime(p.created_at)}</p>
                  <a
                    href={supabaseUsersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-1"
                  >
                    <ExternalLink size={11} />
                    ロールを設定
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

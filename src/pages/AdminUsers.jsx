import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ROLES = [
  { value: 'staff',     label: 'スタッフ',       color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'manager',   label: 'マネージャー',   color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'director',  label: 'ディレクター',   color: 'bg-purple-50 text-purple-700 border-purple-300' },
  { value: 'executive', label: 'エグゼクティブ', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'admin',     label: '管理者',         color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
]

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function RoleModal({ user, onClose, onSaved }) {
  const [selectedRole, setSelectedRole] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    if (!selectedRole) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({ seed_note_role: selectedRole })
      .eq('id', user.id)
    if (err) {
      setError('保存に失敗しました。もう一度お試しください。')
      setSaving(false)
      return
    }
    onSaved(user.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <p className="text-xs text-gray-400 mb-0.5">ロールを設定</p>
          <p className="text-sm font-bold text-gray-800">{user.name || '（名前未設定）'}</p>
          {user.department && (
            <p className="text-xs text-gray-500 mt-0.5">{user.department}</p>
          )}
        </div>

        <div className="px-5 py-4 space-y-2">
          {ROLES.map(role => (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                selectedRole === role.value
                  ? role.color + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-white border-stone-200 text-gray-600 hover:border-stone-300'
              }`}
            >
              <span>{role.label}</span>
              <span className="text-xs font-mono opacity-60">{role.value}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="px-5 pb-2 text-xs text-red-500">{error}</p>
        )}

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-gray-500 hover:bg-stone-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedRole || saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中…' : '確定する'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalUser, setModalUser] = useState(null)

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

  function handleSaved(userId) {
    setProfiles(prev => prev.filter(p => p.id !== userId))
    setModalUser(null)
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> ダッシュボードに戻る
      </button>

      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <h1 className="text-base font-bold text-gray-800 mb-0.5">登録ユーザー管理</h1>
        <p className="text-xs text-gray-400">承認待ちユーザーのロールを設定してください</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-3" />
          読み込み中...
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-6 py-12 text-center text-gray-400">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm">承認待ちユーザーはいません</p>
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
                  <p className="text-xs text-gray-400 mb-1.5">{fmtDateTime(p.created_at)}</p>
                  <button
                    onClick={() => setModalUser(p)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    ロールを設定
                    <ChevronDown size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalUser && (
        <RoleModal
          user={modalUser}
          onClose={() => setModalUser(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

export default function AdminClients() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [newName,   setNewName]   = useState('')
  const [adding,    setAdding]    = useState(false)
  const [error,     setError]     = useState('')

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('client_companies')
      .select('id, name, created_at')
      .order('name')
    setCompanies(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchCompanies() }, [])

  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (companies.some(c => c.name === trimmed)) {
      setError('同じ名前の会社がすでに存在します')
      return
    }
    setAdding(true)
    setError('')
    const { error: err } = await supabase.from('client_companies').insert({ name: trimmed })
    if (err) { setError('追加に失敗しました: ' + err.message); setAdding(false); return }
    setNewName('')
    await fetchCompanies()
    setAdding(false)
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`「${name}」を削除しますか？`)) return
    await supabase.from('client_companies').delete().eq('id', id)
    setCompanies(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> 戻る
      </button>

      <h1 className="text-lg font-bold text-gray-900 mb-1">元請会社マスタ</h1>
      <p className="text-xs text-gray-400 mb-6">クレーム受付画面のサジェスト候補として使用されます</p>

      {/* 新規追加フォーム */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <p className="text-sm font-bold text-gray-700 mb-3">新規追加</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => { setNewName(e.target.value); setError('') }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (e.metaKey || e.altKey) handleAdd()
                else e.preventDefault()
              }
            }}
            placeholder="会社名を入力"
            className="flex-1 h-10 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-40">
            <Plus size={14} />
            {adding ? '追加中...' : '追加'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">会社一覧</span>
          {!loading && (
            <span className="text-xs text-gray-400">{companies.length} 件</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-2" />
            読み込み中...
          </div>
        ) : companies.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">会社が登録されていません</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {companies.map(c => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">登録日: {fmtDate(c.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors">
                  <Trash2 size={13} />
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

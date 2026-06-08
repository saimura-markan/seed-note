import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        ダッシュボードに戻る
      </button>

      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="text-4xl mb-4">🌱</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">クレーム詳細</h2>
        <p className="text-sm text-gray-400 mb-1">ID: {id}</p>
        <p className="text-sm text-gray-500 mt-4">詳細画面は準備中です。</p>
      </div>
    </div>
  )
}

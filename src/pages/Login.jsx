import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff, BookOpen, BarChart2, GraduationCap, TrendingUp } from 'lucide-react'

const FEATURES = [
  { icon: BookOpen,      label: '記録する', desc: 'クレームを即時記録' },
  { icon: BarChart2,     label: '分析する', desc: '原因を深掘り分析' },
  { icon: GraduationCap, label: '学習する', desc: '組織知識を蓄積' },
  { icon: TrendingUp,    label: '成長する', desc: '継続的に改善' },
]

// 浮遊する葉っぱ1枚
function Leaf({ cls, style }) {
  return (
    <svg className={cls} style={style} viewBox="0 0 40 52" fill="none">
      <path d="M20 48 Q20 28 4 10 Q12 6 20 12 Q28 6 36 10 Q20 28 20 48Z" fill="#4ade80" fillOpacity=".5" />
      <line x1="20" y1="48" x2="20" y2="14" stroke="#166534" strokeWidth="1" strokeOpacity=".4" />
    </svg>
  )
}

export default function Login({ onLogin }) {
  // ─── 認証ロジック（変更禁止） ────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    onLogin(data.user)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && email && password) handleLogin()
  }

  // ─── UI state のみ ────────────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  return (
    <>
      <style>{`
        @keyframes floatA {
          0%,100% { transform: translateY(0px) rotate(0deg); opacity:.18; }
          33%      { transform: translateY(-22px) rotate(14deg); opacity:.28; }
          66%      { transform: translateY(-10px) rotate(-8deg); opacity:.22; }
        }
        @keyframes floatB {
          0%,100% { transform: translateY(0px) rotate(0deg); opacity:.14; }
          40%      { transform: translateY(-30px) rotate(-18deg); opacity:.24; }
          70%      { transform: translateY(-14px) rotate(10deg); opacity:.18; }
        }
        @keyframes floatC {
          0%,100% { transform: translateY(0px) rotate(0deg); opacity:.20; }
          50%      { transform: translateY(-18px) rotate(22deg); opacity:.30; }
        }
        .lf-a { animation: floatA var(--dur,8s) ease-in-out infinite var(--delay,0s); }
        .lf-b { animation: floatB var(--dur,10s) ease-in-out infinite var(--delay,0s); }
        .lf-c { animation: floatC var(--dur,7s) ease-in-out infinite var(--delay,0s); }
      `}</style>

      <div className="min-h-screen flex flex-col md:flex-row">

        {/* ══════════════════════════════════════════════════════
            左パネル 65% — グラデーション＋落ち葉アニメーション
        ══════════════════════════════════════════════════════ */}
        <div className="hidden md:flex md:w-[65%] relative flex-col overflow-hidden bg-gradient-to-br from-white via-green-50 to-green-100">

          {/* 浮遊する葉っぱ */}
          <Leaf cls="lf-a absolute w-12 h-16" style={{ top:'6%',    left:'7%',   '--dur':'9s',  '--delay':'0s'   }} />
          <Leaf cls="lf-b absolute w-9 h-12"  style={{ top:'15%',   right:'10%', '--dur':'11s', '--delay':'1.5s' }} />
          <Leaf cls="lf-c absolute w-8 h-11"  style={{ top:'48%',   left:'4%',   '--dur':'8s',  '--delay':'3s'   }} />
          <Leaf cls="lf-a absolute w-14 h-18" style={{ bottom:'22%',right:'8%',  '--dur':'12s', '--delay':'0.8s' }} />
          <Leaf cls="lf-b absolute w-7 h-10"  style={{ top:'35%',   left:'48%',  '--dur':'7s',  '--delay':'4s'   }} />
          <Leaf cls="lf-c absolute w-10 h-14" style={{ bottom:'10%',left:'18%',  '--dur':'10s', '--delay':'2s'   }} />

          <div className="relative z-10 flex flex-col h-full px-14 py-12">

            {/* ── ロゴ ── */}
            <div className="mb-12">
              <img src="/seed-note-logo.png" alt="Seed Note" className="h-32 w-auto" />
            </div>

            {/* ── コンテンツ中央 ── */}
            <div className="flex-1 flex flex-col justify-center">

              {/* バッジ */}
              <div className="inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full border border-green-200 bg-white/60 w-fit shadow-sm">
                <BarChart2 size={12} className="text-green-500" />
                <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#166534' }}>
                  組織学習のプラットフォーム
                </span>
              </div>

              {/* キャッチコピー */}
              <h1 className="font-bold leading-snug mb-3" style={{ fontSize: '3.2rem', color: '#1a4731' }}>
                クレームは、<br />
                <span className="font-extrabold" style={{ color: '#16a34a' }}>成長の種。</span>
              </h1>
              <p className="text-base font-medium mb-10" style={{ color: '#4b7a5e' }}>
                記録し、分析し、組織を育てる。
              </p>

              {/* 機能カード 4枚 */}
              <div className="grid grid-cols-2 gap-3 mb-10">
                {FEATURES.map(({ icon: Icon, label, desc }) => (
                  <div key={label}
                    className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-green-100">
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 bg-green-100">
                      <Icon size={16} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#1a4731' }}>{label}</p>
                      <p className="text-xs mt-0.5 text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 下部：芽SVG＋テキスト ── */}
            <div className="flex items-end gap-5">
              <svg width="60" height="70" viewBox="0 0 60 70" fill="none" className="flex-shrink-0">
                {/* 茎 */}
                <line x1="30" y1="68" x2="30" y2="36" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"/>
                {/* 左葉 */}
                <ellipse cx="18" cy="32" rx="14" ry="8" transform="rotate(-22 18 32)" fill="#4ade80" fillOpacity=".85"/>
                {/* 右葉 */}
                <ellipse cx="42" cy="32" rx="14" ry="8" transform="rotate(22 42 32)" fill="#22c55e" fillOpacity=".9"/>
                {/* 葉脈（左） */}
                <line x1="18" y1="32" x2="30" y2="36" stroke="white" strokeWidth="1" strokeOpacity=".5" strokeLinecap="round"/>
                {/* 葉脈（右） */}
                <line x1="42" y1="32" x2="30" y2="36" stroke="white" strokeWidth="1" strokeOpacity=".5" strokeLinecap="round"/>
                {/* 土 */}
                <ellipse cx="30" cy="66" rx="16" ry="3.5" fill="#a3c9a8" fillOpacity=".45"/>
              </svg>
              <p className="text-sm leading-relaxed pb-1" style={{ color: '#4b7a5e' }}>
                小さな気づきが、<br />未来の大きな成長につながる。
              </p>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            右パネル 35% — ログインフォーム
        ══════════════════════════════════════════════════════ */}
        <div className="w-full md:w-[35%] flex items-start justify-center bg-white px-8 pt-16 pb-12 border-l border-gray-100">
          <div className="w-full max-w-sm">

            {/* モバイル用ロゴ */}
            <div className="md:hidden flex items-center justify-center gap-2 mb-8">
              <img src="/seed-note-logo.png" alt="Seed Note" className="h-9 w-auto" />
              <p className="text-base font-bold" style={{ color: '#1a4731' }}>Seed Note</p>
            </div>

            {/* タイトル */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a4731' }}>ログイン</h2>
              <p className="text-sm text-gray-400">Seed Noteにログインしてください</p>
            </div>

            <div className="space-y-4">

              {/* メールアドレス */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">メールアドレス</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="email"
                    placeholder="メールアドレスを入力"
                    className="w-full h-11 pl-9 pr-4 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition"
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.2)'; e.target.style.borderColor = '#86efac' }}
                    onBlur={e => { e.target.style.boxShadow = ''; e.target.style.borderColor = '' }}
                  />
                </div>
              </div>

              {/* パスワード */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">パスワード</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="current-password"
                    placeholder="パスワードを入力"
                    className="w-full h-11 pl-9 pr-10 rounded-xl border border-stone-200 bg-stone-50 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none transition"
                    onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.2)'; e.target.style.borderColor = '#86efac' }}
                    onBlur={e => { e.target.style.boxShadow = ''; e.target.style.borderColor = '' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* ログインしたままにする ＋ パスワード忘れ */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 accent-green-600" />
                  <span className="text-xs text-gray-500">ログインしたままにする</span>
                </label>
                <button type="button" className="text-xs hover:underline" style={{ color: '#16a34a' }}>
                  パスワードをお忘れの方はこちら
                </button>
              </div>

              {/* エラー */}
              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              {/* ログインボタン */}
              <button
                onClick={handleLogin}
                disabled={loading || !email || !password}
                className="w-full h-12 rounded-xl text-white text-sm font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#1a4731' }}
                onMouseEnter={e => { if (email && password && !loading) e.target.style.background = '#14532d' }}
                onMouseLeave={e => { e.target.style.background = '#1a4731' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    ログイン中...
                  </span>
                ) : 'ログイン'}
              </button>

              {/* または区切り線 */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-gray-400">または</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>

              {/* 新規登録 */}
              <p className="text-xs text-center text-gray-400">
                アカウントをお持ちでない方は{' '}
                <button type="button" className="font-semibold hover:underline" style={{ color: '#16a34a' }}>
                  新規登録はこちら
                </button>
              </p>

            </div>

            <p className="text-[11px] text-gray-300 text-center mt-10">
              © 2026 Seed Note. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </>
  )
}

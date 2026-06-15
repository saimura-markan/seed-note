import { useState, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getRole } from '@/lib/utils'

const DEPARTMENTS = [
  '工事部産廃課/環境リサイクル部',
  '工事部解体課',
  '清掃部清掃２課',
  '清掃部清掃１課',
  '本部',
]

const inputCls = 'w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

export default function MyPage() {
  const navigate = useNavigate()
  const { user } = useOutletContext()

  const role  = getRole(user)
  const email = user?.email || ''

  const [lastNameJa,   setLastNameJa]   = useState('')
  const [firstNameJa,  setFirstNameJa]  = useState('')
  const [lastNameKana, setLastNameKana] = useState('')
  const [firstNameKana,setFirstNameKana]= useState('')
  const [phone,        setPhone]        = useState('')
  const [department,   setDepartment]   = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [saveErr, setSaveErr] = useState(null)

  const [showPwForm,      setShowPwForm]      = useState(false)
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg,     setPwMsg]     = useState(null)
  const [pwErr,     setPwErr]     = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name, name_kana, phone, department').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          const [ln = '', fn = ''] = (data.name      || '').split(' ')
          const [lk = '', fk = ''] = (data.name_kana || '').split(' ')
          setLastNameJa(ln); setFirstNameJa(fn)
          setLastNameKana(lk); setFirstNameKana(fk)
          setPhone(data.phone || '')
          setDepartment(data.department || '')
        }
        setProfileLoading(false)
      })
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setSaveMsg(null); setSaveErr(null)
    const name      = [lastNameJa,   firstNameJa  ].filter(Boolean).join(' ')
    const name_kana = [lastNameKana, firstNameKana].filter(Boolean).join(' ')
    const { error } = await supabase.from('profiles').upsert({
      id: user.id, name, name_kana, phone, department,
    })
    setSaving(false)
    if (error) setSaveErr(error.message)
    else setSaveMsg('変更を保存しました')
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPwErr('パスワードが一致しません'); return }
    if (newPassword.length < 6)          { setPwErr('6文字以上で入力してください'); return }
    setPwLoading(true); setPwErr(null); setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) { setPwErr(error.message) }
    else { setPwMsg('パスワードを変更しました'); setNewPassword(''); setConfirmPassword('') }
  }

  const closePwForm = () => {
    setShowPwForm(false); setPwErr(null); setPwMsg(null)
    setNewPassword(''); setConfirmPassword('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] px-6 py-6">
      <div className="max-w-lg mx-auto pb-10">

        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft size={15} /> 戻る
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-1">マイページ</h2>
        <p className="text-xs text-gray-400 mb-5">アカウント情報の確認・変更</p>

        {/* ロール */}
        {(() => {
          const ROLE_LABELS = {
            admin: '管理者', director: '事業責任者', executive: '役員',
            manager: '主任', judgment: '審査担当', user: 'スタッフ',
          }
          const roleLabel = ROLE_LABELS[role] || role
          return (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-gray-600">{email}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                {roleLabel}
              </span>
            </div>
          )
        })()}

        {/* 個人情報 */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm mb-5">
          <p className="text-sm font-bold text-gray-800 mb-4">個人情報</p>
          {profileLoading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={labelCls}>担当者名</label>
                <div className="grid grid-cols-2 gap-3">
                  <input value={lastNameJa}  onChange={e => setLastNameJa(e.target.value)}
                    placeholder="姓" className={inputCls} />
                  <input value={firstNameJa} onChange={e => setFirstNameJa(e.target.value)}
                    placeholder="名" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>ふりがな</label>
                <div className="grid grid-cols-2 gap-3">
                  <input value={lastNameKana}  onChange={e => setLastNameKana(e.target.value)}
                    placeholder="せい" className={inputCls} />
                  <input value={firstNameKana} onChange={e => setFirstNameKana(e.target.value)}
                    placeholder="めい" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>担当部署</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className={inputCls + ' bg-white'}
                >
                  <option value="">選択してください</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>携帯電話番号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="090-0000-0000" className={inputCls + ' max-w-xs'} />
              </div>

              {saveErr && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{saveErr}</p>}
              {saveMsg && <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">{saveMsg}</p>}

              <button type="submit" disabled={saving}
                className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? '保存中...' : '変更を保存する'}
              </button>
            </form>
          )}
        </div>

        {/* セキュリティ */}
        <div className="bg-white rounded-[16px] p-5 shadow-sm mb-5">
          <p className="text-sm font-bold text-gray-800 mb-4">セキュリティ</p>
          {!showPwForm ? (
            <button type="button" onClick={() => setShowPwForm(true)}
              className="w-full h-11 rounded-xl border-2 border-emerald-700 text-emerald-700 hover:bg-emerald-50 text-sm font-bold transition-colors">
              パスワードを変更する
            </button>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className={labelCls}>新しいパスワード</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="6文字以上" autoComplete="new-password" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>新しいパスワード（確認）</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="もう一度入力" autoComplete="new-password" className={inputCls} />
              </div>

              {pwErr && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{pwErr}</p>}
              {pwMsg && <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">{pwMsg}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={closePwForm}
                  className="flex-1 h-11 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={pwLoading || !newPassword || !confirmPassword}
                  className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {pwLoading ? '変更中...' : '変更する'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ログアウト */}
        <button type="button" onClick={handleLogout}
          className="w-full h-11 rounded-xl border border-stone-200 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
          <LogOut size={16} /> ログアウト
        </button>

      </div>
    </div>
  )
}

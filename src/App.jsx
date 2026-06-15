import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getRole } from './lib/utils'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ComplaintNew from './pages/ComplaintNew'
import ComplaintOverview from './pages/ComplaintOverview'
import ComplaintDetail from './pages/ComplaintDetail'
import CorrectionSubmit from './pages/CorrectionSubmit'
import DeepAnalysisForm from './pages/DeepAnalysisForm'
import Approval from './pages/Approval'
import MyPage from './pages/MyPage'

function RoleGuard({ user, allow, deny, children }) {
  const role = getRole(user)
  const blocked = deny ? deny.includes(role) : allow ? !allow.includes(role) : false
  if (blocked) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={setUser} />}
        />
        <Route
          path="/*"
          element={
            user ? (
              <Layout user={user} onLogout={() => setUser(null)} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="complaints/new" element={<ComplaintNew />} />
          <Route path="complaints/:id" element={<ComplaintOverview />} />
          <Route path="complaints/:id/detail" element={
            <RoleGuard user={user} allow={['admin', 'judgment']}><ComplaintDetail /></RoleGuard>
          } />
          <Route path="complaints/:id/correction" element={
            <RoleGuard user={user} allow={['admin', 'judgment']}><CorrectionSubmit /></RoleGuard>
          } />
          <Route path="complaints/:id/deep-analysis" element={
            <RoleGuard user={user} allow={['manager', 'director']}><DeepAnalysisForm /></RoleGuard>
          } />
          <Route path="complaints/:id/approval" element={
            <RoleGuard user={user} allow={['judgment', 'executive', 'admin']}><Approval /></RoleGuard>
          } />
          <Route path="mypage" element={<MyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

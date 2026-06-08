import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ComplaintNew from './pages/ComplaintNew'
import ComplaintDetail from './pages/ComplaintDetail'
import CorrectionSubmit from './pages/CorrectionSubmit'
import DeepAnalysis from './pages/DeepAnalysis'
import Approval from './pages/Approval'

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
      <div className="min-h-screen flex items-center justify-center bg-[#f0ebe3]">
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
          <Route path="complaints/:id" element={<ComplaintDetail />} />
          <Route path="complaints/:id/correction" element={<CorrectionSubmit />} />
          <Route path="complaints/:id/analysis" element={<DeepAnalysis />} />
          <Route path="complaints/:id/approval" element={<Approval />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

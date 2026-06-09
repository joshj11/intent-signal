import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Accounts from './pages/Accounts.jsx'
import AccountDetail from './pages/AccountDetail.jsx'
import SignalFeed from './pages/SignalFeed.jsx'
import Settings from './pages/Settings.jsx'
import Summary from './pages/Summary.jsx'

function ProtectedRoutes() {
  const { session } = useAuth()

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <Route element={<Layout />}>
      <Route index element={<Navigate to="/accounts" replace />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/accounts/:id" element={<AccountDetail />} />
      <Route path="/signals" element={<SignalFeed />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/settings" element={<Settings />} />
    </Route>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginGate />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </AuthProvider>
  )
}

function LoginGate() {
  const { session } = useAuth()
  if (session) return <Navigate to="/accounts" replace />
  return <Login />
}

function AppRoutes() {
  const { session } = useAuth()

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/accounts" replace />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="accounts/:id" element={<AccountDetail />} />
        <Route path="signals" element={<SignalFeed />} />
        <Route path="summary" element={<Summary />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

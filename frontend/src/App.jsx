import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Accounts from './pages/Accounts.jsx'
import AccountDetail from './pages/AccountDetail.jsx'
import SignalFeed from './pages/SignalFeed.jsx'
import Settings from './pages/Settings.jsx'
import Summary from './pages/Summary.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/accounts" replace />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/signals" element={<SignalFeed />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

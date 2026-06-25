import { useState, useEffect } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { api } from '../lib/api.js'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/accounts', label: 'Accounts' },
  { to: '/signals', label: 'Signal Feed', badge: true },
  { to: '/investor-prospects', label: 'Investor prospects' },
  { to: '/summary', label: 'How it works' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { user } = useAuth()
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    api.signals.pendingCount()
      .then(({ count }) => setPendingCount(count ?? 0))
      .catch(() => {})
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-8">
          <Link to="/" className="font-semibold text-gray-900 tracking-tight hover:text-gray-700 shrink-0">Signal</Link>
          <nav className="flex gap-1 flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {item.label}
                {item.badge && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">{user?.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-500 hover:text-gray-900 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

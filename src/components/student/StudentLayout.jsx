import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import NotificationBell from '../shared/NotificationBell'
import {
  RiDashboardLine, RiCalendarLine, RiMoneyDollarCircleLine,
  RiMenuLine, RiLogoutBoxLine, RiSunLine, RiMoonLine
} from 'react-icons/ri'

const navItems = [
  { to: '/student/dashboard', icon: RiDashboardLine, label: 'My Classes' },
  { to: '/student/book', icon: RiCalendarLine, label: 'Book a Class' },
  { to: '/student/fees', icon: RiMoneyDollarCircleLine, label: 'Fees' },
]

export default function StudentLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const pageLabel = "Deva's Classes"

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 z-30
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="px-6 py-5 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Student</p>
          <h1 className="text-base font-semibold text-gray-800 mt-0.5">Musings with Deva</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${isActive ? 'bg-amber-50 text-amber-600 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-700 truncate">{user?.name || 'Student'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={toggle}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors w-full"
          >
            {dark ? <RiSunLine size={18} /> : <RiMoonLine size={18} />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors w-full"
          >
            <RiLogoutBoxLine size={18} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500">
            <RiMenuLine size={22} />
          </button>
          <span className="text-sm font-semibold text-gray-800">{pageLabel}</span>
          <NotificationBell />
        </header>

        <div className="hidden lg:flex justify-end px-6 py-3 bg-white border-b border-gray-100">
          <NotificationBell />
        </div>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

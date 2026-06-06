import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiBellLine } from 'react-icons/ri'
import { getUserNotifications, markNotificationRead } from '../../firebase/db'
import { useAuth } from '../../context/AuthContext'

// Where each notification type should take the user, per role
function destinationFor(type, role) {
  const base = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student'
  if (role === 'student') {
    if (type === 'payment_confirmed') return '/student/fees'
    return '/student/dashboard' // class confirmed/rejected/cancelled/rescheduled
  }
  // staff: bookings & reschedule requests → dashboard (has the confirm section)
  return `${base}/dashboard`
}

export default function NotificationBell() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  async function fetch() {
    if (!user?.id) return
    const data = await getUserNotifications(user.id)
    setNotifications(data)
  }

  useEffect(() => {
    if (!user?.id) return
    fetch()
    // Auto-refresh every 30s so new notifications appear without a page reload
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unread = notifications.filter(n => !n.isRead).length

  async function handleRead(n) {
    if (!n.isRead) {
      await markNotificationRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
    }
    setOpen(false)
    navigate(destinationFor(n.type, role))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-gray-400 hover:text-gray-700 transition-colors"
      >
        <RiBellLine size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 max-h-96 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-800">Notifications</p>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleRead(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-amber-50' : ''}`}
              >
                <p className="text-sm text-gray-700">{n.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {n.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

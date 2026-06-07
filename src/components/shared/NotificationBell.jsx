import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiBellLine, RiCheckDoubleLine, RiDeleteBinLine } from 'react-icons/ri'
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../../firebase/db'
import { useAuth } from '../../context/AuthContext'

// Where each notification type should take the user, per role
function destinationFor(type, role) {
  const base = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student'
  if (role === 'student') {
    if (type === 'payment_confirmed' || type === 'payment_rejected') return '/student/fees'
    return '/student/dashboard' // class confirmed/rejected/cancelled/rescheduled
  }
  // staff: overlaps & reschedule requests need action → dashboard (confirm section)
  if (type === 'overlap_booking' || type === 'reschedule_request') return `${base}/dashboard`
  // a plain new booking is just informational → show it on the schedule
  if (type === 'class_booked') return `${base}/schedule`
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

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(x => ({ ...x, isRead: true })))
    await markAllNotificationsRead(user.id)
  }

  async function handleClearAll() {
    setNotifications([])
    await clearAllNotifications(user.id)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => { if (!o) fetch(); return !o }) }}
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
          <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">Notifications</p>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button onClick={handleMarkAllRead} title="Mark all read"
                    className="text-gray-400 hover:text-amber-600 transition-colors">
                    <RiCheckDoubleLine size={16} />
                  </button>
                )}
                <button onClick={handleClearAll} title="Clear all"
                  className="text-gray-400 hover:text-red-500 transition-colors">
                  <RiDeleteBinLine size={16} />
                </button>
              </div>
            )}
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

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Calendar, CheckCheck, Bell, MessageSquare, XCircle, Star, CreditCard, Clock, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabase'

const redirectMap = {
  new_offer:         '/dashboard?tab=offers',
  offer_counter:     '/handyman/jobs?tab=negotiations',
  task_accepted:     '/handyman/jobs?tab=negotiations',
  cancellation:      '/handyman/jobs?tab=negotiations',
  service_completed: '/dashboard?tab=tasks',
  new_review:        '/handyman/reviews',
  booking_confirmed: '/dashboard?tab=bookings',
  feedback_request:  '/dashboard?tab=tasks',
}

const iconMap = {
  booking_confirmed: { icon: CheckCheck, color: 'text-green-500', bg: 'bg-green-100' },
  booking_reminder: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-100' },
  booking_rescheduled: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  service_completed: { icon: CheckCheck, color: 'text-green-500', bg: 'bg-green-100' },
  new_message: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-100' },
  cancellation: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
  feedback_request: { icon: Star, color: 'text-red-500', bg: 'bg-red-100' },
  payment_processed: { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-100' },
  new_offer:     { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  offer_counter: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100' },
  task_accepted: { icon: CheckCheck, color: 'text-green-500', bg: 'bg-green-100' },
  new_task: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-100' },
}

const formatDateLabel = (dateStr) => {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Azi'
  if (date.toDateString() === yesterday.toDateString()) return 'Ieri'
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([])
  const panelRef = useRef(null)
  const navigate = useNavigate()

  const unreadCount = notifications.filter(n => !n.is_read).length

  // Fetch notificari + realtime
  useEffect(() => {
    let channel

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) setNotifications(data)

      channel = supabase
        .channel('notifications-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          setNotifications(prev => [payload.new, ...prev])
        })
        .subscribe()
    }

    load()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  // Închide la click în afara panelului
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const markAsRead = async (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
  }

  const clearAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setNotifications([])
    await supabase.from('notifications').delete().eq('user_id', user.id)
  }

  const formatTime = (createdAt) => {
    const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000)
    if (diff < 60) return 'Tocmai acum'
    if (diff < 3600) return `Acum ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Acum ${Math.floor(diff / 3600)} h`
    return `Acum ${Math.floor(diff / 86400)} zile`
  }

  // Grupează pe zile
  const grouped = notifications.reduce((acc, notif) => {
    const label = formatDateLabel(notif.created_at)
    if (!acc[label]) acc[label] = []
    acc[label].push(notif)
    return acc
  }, {})

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Notificări</h2>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500">{unreadCount} notificări necitite</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                Marchează toate citite
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length > 0 ? (
            Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* Date separator */}
                <div className="px-6 py-2 bg-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span className="font-medium">{dateLabel}</span>
                  </div>
                </div>

                {/* Items */}
                {items.map((notif) => {
                  const config = iconMap[notif.type] || iconMap.new_message
                  const IconComponent = config.icon

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id)
                        const rawPath = notif.data?.redirect || redirectMap[notif.type]
                        if (rawPath) {
                          onClose()
                          const [path, query] = rawPath.split('?')
                          const tab = query?.split('tab=')?.[1]
                          navigate(path, { state: { tab } })
                        }
                      }}
                      className={`flex items-start gap-3 px-6 py-4 border-b border-gray-50 cursor-pointer transition-all hover:bg-gray-50
                        ${!notif.is_read ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''}
                      `}
                    >
                      <div className={`w-10 h-10 ${config.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.is_read ? 'font-bold text-gray-800' : 'font-medium text-gray-700'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{formatTime(notif.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Bell className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nicio notificare</p>
              <p className="text-xs text-gray-400 mt-1">Vei primi notificări despre activitatea ta</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-3">
            <button
              onClick={clearAll}
              className="w-full text-center text-sm text-gray-500 font-medium hover:text-red-500 transition"
            >
              Șterge toate
            </button>
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
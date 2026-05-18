'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Bell, X, CheckCheck, ArrowRight } from 'lucide-react'

// Icône selon le type de notification
function notifIcon(type) {
  const map = {
    ticket_ready:       '🎫',
    stock_low:          '📦',
    qr_paid:            '💰',
    invoice_overdue:    '🧾',
    appointment_soon:   '📅',
  }
  return map[type] ?? '🔔'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 0)  return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  if (mins > 0)  return `il y a ${mins}min`
  return 'à l\'instant'
}

/**
 * Cloche de notifications avec badge non-lus et dropdown des 5 dernières.
 * @param {{ shopId: string|null, onRead?: () => void }} props
 */
export default function NotificationBell({ shopId, onRead }) {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [open,         setOpen]         = useState(false)
  const [notifications,setNotifications]= useState([])
  const [unreadCount,  setUnreadCount]  = useState(0)
  const dropdownRef = useRef(null)

  // ---------------------------------------------------------------------------
  // Chargement des notifications
  // ---------------------------------------------------------------------------
  const loadNotifications = async () => {
    if (!shopId) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, read, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(5)

    setNotifications(data ?? [])
    setUnreadCount((data ?? []).filter(n => !n.read).length)
  }

  useEffect(() => {
    loadNotifications()
  }, [shopId])

  // ---------------------------------------------------------------------------
  // Realtime — écoute les nouvelles notifications en temps réel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!shopId) return

    const channel = supabase
      .channel(`notif:${shopId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `shop_id=eq.${shopId}`,
      }, (payload) => {
        // Toast visuel simple (title tag)
        document.title = `🔔 ${payload.new.title} — TickeeFlow`
        setTimeout(() => {
          document.title = 'TickeeFlow'
        }, 4000)
        loadNotifications()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [shopId])

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ---------------------------------------------------------------------------
  // Marquer comme lu
  // ---------------------------------------------------------------------------
  const markAllRead = async () => {
    if (!shopId) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('shop_id', shopId)
      .eq('read', false)
    await loadNotifications()
    onRead?.()
  }

  const markOneRead = async (notif) => {
    if (!notif.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notif.id)
    }
    setOpen(false)
    if (notif.link) router.push(notif.link)
    await loadNotifications()
    onRead?.()
  }

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bouton cloche */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5
                   transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white
                           text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#1A1A27] border border-white/15
                        rounded-xl shadow-2xl z-50 overflow-hidden">

          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300
                             transition-colors"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste des notifications */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-600">
                Aucune notification
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => markOneRead(notif)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left
                    hover:bg-white/5 transition-colors border-b border-white/5 last:border-0
                    ${!notif.read ? 'bg-amber-500/5' : ''}`}
                >
                  {/* Point non-lu */}
                  <div className="flex-shrink-0 mt-0.5 relative">
                    <span className="text-base">{notifIcon(notif.type)}</span>
                    {!notif.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate
                      ${notif.read ? 'text-gray-400' : 'text-white'}`}>
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-[10px] text-gray-600 truncate mt-0.5">{notif.message}</p>
                    )}
                    <p className="text-[10px] text-gray-700 mt-0.5">{timeAgo(notif.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Pied de dropdown */}
          <div className="border-t border-white/10 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); router.push('/admin/notifications') }}
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300
                         transition-colors"
            >
              Voir toutes les notifications
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

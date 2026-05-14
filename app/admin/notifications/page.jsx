'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Icône selon le type
// ---------------------------------------------------------------------------
function notifIcon(type) {
  const map = {
    ticket_ready:     '🎫',
    stock_low:        '📦',
    qr_paid:          '💰',
    invoice_overdue:  '🧾',
    appointment_soon: '📅',
  }
  return map[type] ?? '🔔'
}

// ---------------------------------------------------------------------------
// Formatage de la date en groupe (Aujourd'hui / Hier / date)
// ---------------------------------------------------------------------------
function dayLabel(dateStr) {
  const d     = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today))     return "Aujourd'hui"
  if (sameDay(d, yesterday)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function timeStr(dateStr) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Page liste complète des notifications, groupées par jour.
 */
export default function NotificationsPage() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [notifications, setNotifications] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [shopId,        setShopId]        = useState(null)
  const [marking,       setMarking]       = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      await loadNotifs(shop.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadNotifs = async (sid) => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, read, created_at')
      .eq('shop_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)
    setNotifications(data ?? [])
  }

  // ---------------------------------------------------------------------------
  // Marquer tout comme lu
  // ---------------------------------------------------------------------------
  const markAllRead = async () => {
    if (!shopId) return
    setMarking(true)
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('shop_id', shopId)
      .eq('read', false)
    await loadNotifs(shopId)
    setMarking(false)
  }

  // ---------------------------------------------------------------------------
  // Clic sur une notification — marque comme lue et navigue
  // ---------------------------------------------------------------------------
  const handleClick = async (notif) => {
    if (!notif.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }
    if (notif.link) router.push(notif.link)
  }

  // ---------------------------------------------------------------------------
  // Groupement par jour
  // ---------------------------------------------------------------------------
  const grouped = []
  const seenDays = {}

  notifications.forEach(n => {
    const label = dayLabel(n.created_at)
    if (!seenDays[label]) {
      seenDays[label] = true
      grouped.push({ dayLabel: label, items: [] })
    }
    grouped[grouped.length - 1].items.push(n)
  })

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-gray-500 text-sm mt-0.5">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                       text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20
                       transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* État vide */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center
                        bg-[#111118] border border-white/10 rounded-xl">
          <Bell className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">Aucune notification</p>
          <p className="text-xs text-gray-700 mt-1">Les alertes importantes apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.dayLabel}>
              {/* Séparateur de jour */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest
                                  whitespace-nowrap">
                  {group.dayLabel}
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Notifications du jour */}
              <div className="space-y-1">
                {group.items.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full flex items-start gap-4 px-5 py-4 rounded-xl text-left
                      transition-colors border
                      ${notif.read
                        ? 'bg-[#111118] border-white/5 hover:bg-white/5'
                        : 'bg-amber-500/5 border-amber-500/15 hover:bg-amber-500/10'}`}
                  >
                    {/* Icône type + indicateur non-lu */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <span className="text-xl">{notifIcon(notif.type)}</span>
                      {!notif.read && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500
                                          rounded-full border-2 border-[#0F0F1A]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-sm font-medium truncate
                          ${notif.read ? 'text-gray-400' : 'text-white'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-gray-700 flex-shrink-0">
                          {timeStr(notif.created_at)}
                        </span>
                      </div>
                      {notif.message && (
                        <p className="text-xs text-gray-600 truncate mt-0.5">{notif.message}</p>
                      )}
                      {notif.link && (
                        <p className="text-[10px] text-amber-600 mt-1">Cliquer pour accéder →</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

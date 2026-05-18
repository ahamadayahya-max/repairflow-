'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Wrench, LogOut, Loader2, Menu, X, Zap,
  LayoutGrid, Bell, Ticket, CalendarDays, Users, Leaf,
  FileText, Receipt, BarChart3, Package, ShoppingCart,
  HardHat, Settings, ClipboardCheck,
} from 'lucide-react'
import GlobalSearch from '@/components/admin/GlobalSearch'
import NotificationBell from '@/components/admin/NotificationBell'
import QuickCreate from '@/components/admin/QuickCreate'
import Breadcrumb from '@/components/admin/Breadcrumb'
import { ThemeToggleCompact } from '@/components/ThemeToggle'

// ---------------------------------------------------------------------------
// Structure de navigation groupée
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
  {
    label: 'PRINCIPAL',
    items: [
      { href: '/admin/overview',      label: "Vue d'ensemble", icon: LayoutGrid,    badge: null },
      { href: '/admin/notifications', label: 'Notifications',  icon: Bell,          badge: 'notif_unread' },
    ],
  },
  {
    label: 'ATELIER',
    items: [
      { href: '/admin/tickets',    label: 'Tickets',   icon: Ticket,       badge: 'tickets_ready' },
      { href: '/admin/agenda',     label: 'Agenda',    icon: CalendarDays, badge: 'agenda_today' },
      { href: '/admin/clients',    label: 'Clients',   icon: Users,        badge: null },
      { href: '/admin/qualirepar', label: 'QualiRépar',icon: Leaf,         badge: 'qr_eligible' },
    ],
  },
  {
    label: 'FINANCES',
    items: [
      { href: '/admin/devis',        label: 'Devis',       icon: FileText, badge: 'devis_sent' },
      { href: '/admin/factures',     label: 'Factures',    icon: Receipt,  badge: 'invoices_overdue' },
      { href: '/admin/comptabilite', label: 'Comptabilité',icon: BarChart3,badge: null },
    ],
  },
  {
    label: 'STOCK',
    items: [
      { href: '/admin/parts',     label: 'Stock & Pièces', icon: Package,      badge: 'parts_out_of_stock' },
      { href: '/admin/commandes', label: 'Commandes',      icon: ShoppingCart, badge: null },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { href: '/admin/techniciens',          label: 'Techniciens',  icon: HardHat,      badge: null },
      { href: '/admin/settings',             label: 'Paramètres',   icon: Settings,     badge: null },
      { href: '/admin/qualirepar/conformite',label: 'Conformité QR',icon: ClipboardCheck,badge: null },
    ],
  },
]

// Couleur du badge selon le type
function badgeColor(key) {
  if (key === 'agenda_today')  return 'bg-blue-500 text-white'
  if (key === 'qr_eligible')   return 'bg-amber-500 text-gray-900'
  if (key === 'devis_sent')    return 'bg-gray-500 text-white'
  return 'bg-red-500 text-white'
}

/**
 * Layout protégé de l'espace administration.
 * Sidebar groupée 240px + topbar avec recherche globale, création rapide, notifications.
 */
export default function AdminLayout({ children }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = getSupabaseClient()

  const [user,        setUser]        = useState(null)
  const [shop,        setShop]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Badges { tickets_ready: 2, notif_unread: 5, ... }
  const [badges,      setBadges]      = useState({})
  const intervalRef = useRef(null)

  // ---------------------------------------------------------------------------
  // Chargement des badges en parallèle
  // ---------------------------------------------------------------------------
  const loadBadges = useCallback(async (shopId) => {
    if (!shopId) return
    try {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

      const [
        { count: tickets_ready },
        { count: notif_unread },
        { count: agenda_today },
        { count: qr_eligible },
        { count: devis_sent },
        { count: invoices_overdue },
        { count: parts_out_of_stock },
      ] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).eq('status', 'ready'),
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).eq('read', false),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).gte('start_at', startOfDay).lte('start_at', endOfDay),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).eq('qr_eligible', true).eq('qr_status', 'eligible'),
        supabase.from('quotes').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).eq('status', 'sent'),
        supabase.from('invoices').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).eq('status', 'overdue'),
        supabase.from('parts_inventory').select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId).lte('qty_stock', 0),
      ])

      setBadges({
        tickets_ready:     tickets_ready   ?? 0,
        notif_unread:      notif_unread    ?? 0,
        agenda_today:      agenda_today    ?? 0,
        qr_eligible:       qr_eligible     ?? 0,
        devis_sent:        devis_sent      ?? 0,
        invoices_overdue:  invoices_overdue ?? 0,
        parts_out_of_stock:parts_out_of_stock ?? 0,
      })
    } catch (_) {
      // Silencieux pour éviter de bloquer l'UI si une table n'existe pas encore
    }
  }, [supabase])

  // ---------------------------------------------------------------------------
  // Vérification session + onboarding
  // ---------------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUser(session.user)

      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name, onboarding_completed, subscription_status, trial_ends_at, plan')
        .eq('owner_id', session.user.id)
        .maybeSingle()

      if (!shopData || !shopData.onboarding_completed) {
        router.replace('/bienvenue')
        return
      }

      setShop(shopData)
      setLoading(false)

      // Premier chargement des badges
      await loadBadges(shopData.id)

      // Rafraîchissement toutes les 60 secondes
      intervalRef.current = setInterval(() => loadBadges(shopData.id), 60_000)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })

    return () => {
      subscription.unsubscribe()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Jours d'essai restants
  const trialDaysLeft = shop?.trial_ends_at
    ? Math.max(0, Math.ceil(
        (new Date(shop.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : 0
  const isTrial = shop?.subscription_status === 'trial'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex">

      {/* Overlay mobile — fermeture au tap extérieur */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar 240px ── */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-60 bg-[#111118] border-r border-white/10
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>

        {/* Logo texte TickeeFlow — temporaire en attendant le vrai logo PNG */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-xl font-bold tracking-tight leading-none">
            <span className="text-amber-400">Tickee</span>
            <span className="text-white">Flow</span>
          </div>
          <div className="text-[10px] text-gray-600 mt-1">I-Mobile Service · Toulouse</div>
        </div>

        {/* Navigation groupée */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-gray-600 tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, badge: badgeKey }) => {
                  const active = pathname === href
                    || (href !== '/admin' && href !== '/admin/overview' && pathname.startsWith(href))
                  const count = badgeKey ? (badges[badgeKey] ?? 0) : 0
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-colors
                        ${active
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{label}</span>
                      {count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none
                          ${badgeColor(badgeKey)}`}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bandeau essai gratuit */}
        {isTrial && (
          <div className="mx-3 mb-3 p-3 bg-amber-500/8 border border-amber-500/15 rounded-xl">
            <div className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Essai gratuit
            </div>
            <div className="text-xs text-amber-500/80 mb-2">
              {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mb-2.5">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((14 - trialDaysLeft) / 14) * 100)}%` }}
              />
            </div>
            <Link
              href="/admin/settings"
              onClick={() => setSidebarOpen(false)}
              className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-white
                         text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Choisir un plan →
            </Link>
          </div>
        )}

        {/* Pied de sidebar */}
        <div className="px-3 py-4 border-t border-white/10 space-y-3">
          {/* Toggle thème clair / sombre */}
          <ThemeToggleCompact />

          {/* Infos atelier + déconnexion */}
          <div className="px-1">
            {shop?.name && (
              <p className="text-xs font-semibold text-gray-300 truncate mb-0.5">{shop.name}</p>
            )}
            <p className="text-xs text-gray-500 truncate mb-2">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* ── Zone principale ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar — visible desktop ET mobile */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#111118] sticky top-0 z-10">

          {/* Hamburger mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo mobile uniquement */}
          <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm">TickeeFlow</span>
          </div>

          {/* Breadcrumb desktop */}
          <div className="hidden lg:flex flex-1 min-w-0">
            <Breadcrumb />
          </div>

          {/* Espace flexible sur mobile */}
          <div className="flex-1 lg:hidden" />

          {/* Actions topbar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <GlobalSearch />
            <QuickCreate />
            <NotificationBell
              shopId={shop?.id}
              onRead={() => loadBadges(shop?.id)}
            />
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

    </div>
  )
}

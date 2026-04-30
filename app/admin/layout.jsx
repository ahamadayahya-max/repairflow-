'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Wrench, LayoutDashboard, Ticket, LogOut, Loader2, Menu, X,
  Users, Package, Settings, LayoutGrid, FileText, Receipt, BarChart3, CalendarDays,
  Zap, Leaf,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Navigation latérale
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { href: '/admin/overview',      label: 'Vue d\'ensemble',  icon: LayoutGrid     },
  { href: '/admin',               label: 'Tableau de bord',  icon: LayoutDashboard },
  { href: '/admin/tickets',       label: 'Tickets',           icon: Ticket         },
  { href: '/admin/clients',       label: 'Clients',           icon: Users          },
  { href: '/admin/parts',         label: 'Pièces & Stock',    icon: Package        },
  { href: '/admin/agenda',        label: 'Agenda',            icon: CalendarDays   },
  { href: '/admin/devis',         label: 'Devis',             icon: FileText       },
  { href: '/admin/factures',      label: 'Factures',          icon: Receipt        },
  { href: '/admin/comptabilite',  label: 'Comptabilité',      icon: BarChart3      },
  { href: '/admin/qualirepar',    label: 'QualiRépar',        icon: Leaf           },
  { href: '/admin/settings',      label: 'Paramètres',        icon: Settings       },
]

/**
 * Layout protégé de l'espace administration.
 * Vérifie la session Supabase, redirige vers /login si non connecté,
 * et vers /bienvenue si l'onboarding n'est pas complété.
 * Affiche un bandeau d'essai dans la sidebar si subscription_status = 'trial'.
 */
export default function AdminLayout({ children }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = getSupabaseClient()

  const [user,        setUser]        = useState(null)
  const [shop,        setShop]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Raccourci Ctrl+P → focus sur le champ de recherche de pièces (#part-search-input)
  const handleGlobalKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      const el = document.getElementById('part-search-input')
      if (el) {
        e.preventDefault()
        el.focus()
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // Vérification de session + onboarding au montage
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }

      setUser(session.user)

      // Charge les infos shop (onboarding + trial)
      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name, onboarding_completed, subscription_status, trial_ends_at, plan')
        .eq('owner_id', session.user.id)
        .maybeSingle()

      // Si onboarding non complété → redirige vers /bienvenue
      if (!shopData || !shopData.onboarding_completed) {
        router.replace('/bienvenue')
        return
      }

      setShop(shopData)
      setLoading(false)
    })

    // Écoute les changements d'auth (déconnexion depuis un autre onglet, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Calcul des jours restants d'essai
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

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-60 bg-[#111118] border-r border-white/10
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-white font-bold text-base">RepairFlow</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin' && href !== '/admin/overview' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ── Bandeau essai gratuit ── */}
        {isTrial && (
          <div className="mx-3 mb-3 p-3 bg-amber-500/8 border border-amber-500/15 rounded-xl">
            <div className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Essai gratuit
            </div>
            <div className="text-xs text-amber-500/80 mb-2">
              {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
            </div>
            {/* Barre de progression de l'essai (s'écoule de gauche à droite) */}
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

        {/* Pied de sidebar — utilisateur connecté */}
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-gray-500 truncate mb-2">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#111118]">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm">RepairFlow</span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

    </div>
  )
}

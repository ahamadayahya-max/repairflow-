'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Clock, Wrench, CheckCircle2, Truck, TrendingUp,
  Ticket, Package, AlertTriangle, ArrowRight, Loader2,
  Plus, Leaf,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ---------------------------------------------------------------------------
// Composant KPI Card
// ---------------------------------------------------------------------------

/**
 * Carte d'indicateur clé de performance.
 * @param {{ label: string, value: number|string, icon: React.ElementType, color: string, bg: string, sub?: string }} props
 */
function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant mini barre de graphique
// ---------------------------------------------------------------------------

/**
 * Graphique à barres CSS pour le volume hebdomadaire.
 * @param {{ data: { label: string, count: number }[] }} props
 */
function WeeklyChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] text-gray-500">{d.count > 0 ? d.count : ''}</span>
          <div
            className="w-full rounded-t-md bg-amber-500/30 hover:bg-amber-500/50 transition-all"
            style={{ height: `${Math.max((d.count / max) * 80, d.count > 0 ? 6 : 2)}px` }}
            title={`${d.count} ticket(s)`}
          />
          <span className="text-[10px] text-gray-600">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badge statut
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  pending:   { label: 'En attente',    color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  in_repair: { label: 'En réparation', color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
  ready:     { label: 'Prêt',          color: 'text-green-400',  bg: 'bg-green-400/10'  },
  delivered: { label: 'Livré',         color: 'text-gray-400',   bg: 'bg-gray-400/10'   },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const supabase = getSupabaseClient()

  const [loading,        setLoading]        = useState(true)
  const [shopId,         setShopId]         = useState(null)
  const [shopData,       setShopData]       = useState(null)
  const [kpis,           setKpis]           = useState({ pending: 0, in_repair: 0, ready: 0, delivered_month: 0 })
  const [recentTickets,  setRecentTickets]  = useState([])
  const [weeklyData,     setWeeklyData]     = useState([])
  const [lowStock,       setLowStock]       = useState([])
  const [qrScore,        setQrScore]        = useState(null)

  useEffect(() => {
    async function load() {
      // Récupère l'utilisateur et son shop
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops')
        .select('id, trial_ends_at, subscription_status, onboarding_completed_at')
        .eq('owner_id', user.id)
        .single()

      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      setShopData(shop)

      // ── KPIs statuts ────────────────────────────────────────────────────
      const { data: allTickets } = await supabase
        .from('tickets')
        .select('id, status, created_at')
        .eq('shop_id', shop.id)

      const now       = new Date()
      const firstDay  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const pending        = allTickets?.filter(t => t.status === 'pending').length   ?? 0
      const in_repair      = allTickets?.filter(t => t.status === 'in_repair').length ?? 0
      const ready          = allTickets?.filter(t => t.status === 'ready').length     ?? 0
      const delivered_month = allTickets?.filter(t =>
        t.status === 'delivered' && t.created_at >= firstDay
      ).length ?? 0

      setKpis({ pending, in_repair, ready, delivered_month })

      // ── Tickets récents ─────────────────────────────────────────────────
      const { data: recent } = await supabase
        .from('tickets')
        .select(`
          id, status, device_type, device_brand, device_model, created_at,
          clients!tickets_client_id_fkey(full_name)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(8)

      setRecentTickets(recent ?? [])

      // ── Volume des 7 derniers jours ─────────────────────────────────────
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d     = new Date()
        d.setDate(d.getDate() - i)
        const label = d.toLocaleDateString('fr-FR', { weekday: 'short' })
        const iso   = d.toISOString().slice(0, 10)
        const count = allTickets?.filter(t => t.created_at?.slice(0, 10) === iso).length ?? 0
        days.push({ label, count })
      }
      setWeeklyData(days)

      // ── Stock bas (pièces < 3) ──────────────────────────────────────────
      const { data: partsData } = await supabase
        .from('parts_inventory')
        .select('id, part_name, sku, qty_stock')
        .eq('shop_id', shop.id)
        .lt('qty_stock', 3)
        .order('qty_stock')
        .limit(5)

      // Normalise pour le rendu
      setLowStock((partsData ?? []).map(p => ({
        id:        p.id,
        name:      p.part_name,
        reference: p.sku,
        stock:     p.qty_stock,
      })))

      // ── Score QualiRépar ────────────────────────────────────────────────
      const { data: qrData } = await supabase.rpc('get_qualirepar_compliance_score')
      setQrScore(qrData)

      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  const totalActifs = kpis.pending + kpis.in_repair + kpis.ready

  // Détecte si l'utilisateur vient de terminer l'onboarding (< 24h)
  const isNewUser = shopData?.onboarding_completed_at
    && (Date.now() - new Date(shopData.onboarding_completed_at).getTime()) < 24 * 60 * 60 * 1000

  const trialDaysLeft = shopData?.trial_ends_at
    ? Math.max(0, Math.ceil(
        (new Date(shopData.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : 0

  return (
    <div className="space-y-6">

      {/* ── Bannière bienvenue (premier jour après onboarding) ── */}
      {isNewUser && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4
                        flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="font-semibold text-amber-300 text-sm">Bienvenue sur RepairFlow !</div>
              <div className="text-xs text-amber-500/80 mt-0.5">
                Essai gratuit : {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/admin/tickets/new"
              className="bg-amber-500 hover:bg-amber-400 text-white font-semibold
                         px-4 py-2 rounded-lg text-sm transition-colors"
            >
              + Créer un ticket
            </Link>
            <Link
              href="/admin/settings"
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300
                         px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Paramètres
            </Link>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/admin/tickets/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau ticket
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="En attente"
          value={kpis.pending}
          icon={Clock}
          color="text-yellow-400"
          bg="bg-yellow-400/10"
          sub="À prendre en charge"
        />
        <KpiCard
          label="En réparation"
          value={kpis.in_repair}
          icon={Wrench}
          color="text-blue-400"
          bg="bg-blue-400/10"
          sub="En cours de traitement"
        />
        <KpiCard
          label="Prêts"
          value={kpis.ready}
          icon={CheckCircle2}
          color="text-green-400"
          bg="bg-green-400/10"
          sub="À restituer au client"
        />
        <KpiCard
          label="Livrés ce mois"
          value={kpis.delivered_month}
          icon={Truck}
          color="text-amber-400"
          bg="bg-amber-400/10"
          sub={`${totalActifs} ticket(s) actifs`}
        />
      </div>

      {/* Graphique + Alertes stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Volume hebdomadaire */}
        <div className="lg:col-span-2 bg-[#111118] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Tickets créés — 7 derniers jours
            </h2>
          </div>
          <WeeklyChart data={weeklyData} />
        </div>

        {/* Alertes stock */}
        <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-amber-400" />
            Alertes stock
          </h2>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-400 mb-1" />
              <p className="text-xs text-gray-500">Tous les stocks sont OK</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.map(part => (
                <div key={part.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-xs text-gray-200 font-medium">{part.name}</p>
                    <p className="text-[10px] text-gray-600">Réf. {part.reference ?? '—'}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${part.stock === 0
                      ? 'bg-red-400/10 text-red-400'
                      : 'bg-orange-400/10 text-orange-400'
                    }`}>
                    {part.stock === 0 ? 'Rupture' : `${part.stock} restant${part.stock > 1 ? 's' : ''}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Widget QualiRépar ── */}
      <Link
        href="/admin/qualirepar/conformite"
        className="block bg-[#111118] border border-white/10 hover:border-green-500/30
                   rounded-xl p-5 transition-colors group"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Info gauche */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Leaf className="w-4.5 h-4.5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">QualiRépar — Conformité label</p>
              <p className="text-xs text-gray-500 mt-0.5">Score de conformité aux critères qualité</p>
            </div>
          </div>
          {/* Score + badge */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-400">
                {qrScore?.score_global ?? 0}
                <span className="text-sm text-gray-600 font-normal">/100</span>
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold
              ${qrScore?.eligible_label
                ? 'bg-green-500/15 text-green-400'
                : 'bg-amber-500/15 text-amber-400'}`}>
              {qrScore?.eligible_label ? '✅ Éligible' : '⚠️ En cours'}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-amber-400 transition-colors" />
          </div>
        </div>
      </Link>

      {/* Tickets récents */}
      <div className="bg-[#111118] rounded-xl border border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-400" />
            Tickets récents
          </h2>
          <Link
            href="/admin/tickets"
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Voir tout <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Ticket className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-500">Aucun ticket pour le moment</p>
            <Link href="/admin/tickets/new" className="mt-3 text-xs text-amber-400 hover:text-amber-300">
              Créer le premier ticket →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentTickets.map(ticket => {
              const label = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type
              return (
                <Link
                  key={ticket.id}
                  href={`/admin/tickets/${ticket.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 font-medium truncate">{label}</p>
                      <p className="text-xs text-gray-500 truncate">{ticket.clients?.full_name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <StatusBadge status={ticket.status} />
                    <span className="text-xs text-gray-600 hidden sm:block">{formatDate(ticket.created_at)}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

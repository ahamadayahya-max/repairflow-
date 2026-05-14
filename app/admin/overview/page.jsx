'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Ticket, Wrench, CheckCircle2, PackageCheck, TrendingUp,
  AlertTriangle, Receipt, Clock, ArrowRight, RefreshCw,
  Loader2, Package, Users, BarChart3,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function dayLabel(date) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' })
}

// ---------------------------------------------------------------------------
// Composant KPI
// ---------------------------------------------------------------------------
/**
 * Carte KPI avec icône, valeur et sous-titre.
 * @param {{ label: string, value: string|number, icon: React.FC, color: string, bg: string, sub?: string, href?: string }} props
 */
function KpiCard({ label, value, icon: Icon, color, bg, sub, href }) {
  const inner = (
    <div className={`bg-[#111118] border border-white/10 rounded-xl p-4 transition-colors
                     ${href ? 'hover:border-white/20 cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: 18, height: 18 }} />
        </div>
        {href && <ArrowRight className="w-3.5 h-3.5 text-gray-700 mt-1" />}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-700 mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ---------------------------------------------------------------------------
// Mini graphique barres SVG — 7 derniers jours
// ---------------------------------------------------------------------------
/**
 * Graphique en barres des tickets créés sur les 7 derniers jours.
 * @param {{ data: Array<{ date: string, count: number }> }} props
 */
function WeeklyChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 100
  const H = 60
  const barW = W / data.length - 2
  const ACCENT = '#F59E0B'
  const DIM    = 'rgba(255,255,255,0.05)'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 64 }}>
      {data.map((d, i) => {
        const barH = (d.count / max) * (H - 14)
        const x    = i * (W / data.length) + 1
        const y    = H - barH - 10
        return (
          <g key={i}>
            {/* Barre de fond */}
            <rect x={x} y={4} width={barW} height={H - 14} rx="2" fill={DIM} />
            {/* Barre réelle */}
            {d.count > 0 && (
              <rect x={x} y={y} width={barW} height={barH} rx="2" fill={ACCENT} opacity={0.8} />
            )}
            {/* Valeur au-dessus */}
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 2} textAnchor="middle"
                fontSize="4" fill={ACCENT} fontWeight="bold">
                {d.count}
              </text>
            )}
            {/* Jour en bas */}
            <text x={x + barW / 2} y={H - 1} textAnchor="middle"
              fontSize="4.5" fill="rgba(255,255,255,0.35)">
              {dayLabel(d.date).slice(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Badge statut ticket
// ---------------------------------------------------------------------------
const STATUS_CFG = {
  pending:   { label: 'En attente',    color: 'text-gray-400',   bg: 'bg-gray-400/10'  },
  in_repair: { label: 'En réparation', color: 'text-blue-400',   bg: 'bg-blue-400/10'  },
  ready:     { label: 'Prêt',          color: 'text-green-400',  bg: 'bg-green-400/10' },
  delivered: { label: 'Livré',         color: 'text-purple-400', bg: 'bg-purple-400/10'},
}
function StatusDot({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.color.replace('text-', 'bg-')}`} />
  )
}

// ---------------------------------------------------------------------------
// Page principale Dashboard
// ---------------------------------------------------------------------------
/**
 * Tableau de bord opérationnel — KPIs, graphique hebdomadaire, alertes stock, activité récente.
 */
export default function OverviewPage() {
  const supabase = getSupabaseClient()

  const [shopId,        setShopId]        = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [lastRefresh,   setLastRefresh]   = useState(null)

  // — Données
  const [ticketStats,   setTicketStats]   = useState({ pending: 0, in_repair: 0, ready: 0, delivered_month: 0, total: 0 })
  const [invoiceStats,  setInvoiceStats]  = useState({ ca_month: 0, sent: 0, overdue: 0 })
  const [weeklyData,    setWeeklyData]    = useState([])
  const [stockAlerts,   setStockAlerts]   = useState([])
  const [recentTickets, setRecentTickets] = useState([])
  const [clientCount,   setClientCount]   = useState(0)

  // ---------------------------------------------------------------------------
  // Chargement des données
  // ---------------------------------------------------------------------------
  const loadAll = useCallback(async (sid) => {
    if (!sid) return

    const now       = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Génère les 7 derniers jours
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      d.setHours(0, 0, 0, 0)
      return d.toISOString().split('T')[0]
    })

    await Promise.all([
      // — Tickets par statut
      (async () => {
        const { data } = await supabase
          .from('tickets')
          .select('status, created_at')
          .eq('shop_id', sid)

        const all = data ?? []
        const pending          = all.filter(t => t.status === 'pending').length
        const in_repair        = all.filter(t => t.status === 'in_repair').length
        const ready            = all.filter(t => t.status === 'ready').length
        const delivered_month  = all.filter(t =>
          t.status === 'delivered' && t.created_at >= startMonth
        ).length

        setTicketStats({ pending, in_repair, ready, delivered_month, total: all.length })

        // Graphique hebdomadaire
        const weekly = days.map(date => ({
          date,
          count: all.filter(t => t.created_at?.startsWith(date)).length,
        }))
        setWeeklyData(weekly)
      })(),

      // — Factures
      (async () => {
        const { data } = await supabase
          .from('invoices')
          .select('status, total_net, paid_at, due_at')
          .eq('shop_id', sid)

        const all = data ?? []
        const ca_month = all
          .filter(i => i.status === 'paid' && i.paid_at >= startMonth)
          .reduce((s, i) => s + parseFloat(i.total_net || 0), 0)
        const sent   = all.filter(i => i.status === 'sent').length
        const overdue = all.filter(i =>
          i.status === 'sent' && i.due_at && new Date(i.due_at) < now
        ).length

        setInvoiceStats({ ca_month, sent, overdue })
      })(),

      // — Alertes stock
      (async () => {
        const { data } = await supabase
          .from('parts_inventory')
          .select('id, name, qty_stock, min_stock, unit')
          .eq('shop_id', sid)
          .filter('qty_stock', 'lte', 'min_stock')
          .order('qty_stock', { ascending: true })
          .limit(5)

        // Filtre côté client car lte sur colonne calculée peut ne pas marcher
        const raw = data ?? []
        setStockAlerts(raw.filter(p => p.qty_stock <= p.min_stock))
      })(),

      // — Tickets récents
      (async () => {
        const { data } = await supabase
          .from('tickets')
          .select('id, tracking_token, device_type, device_brand, device_model, status, created_at, clients(full_name)')
          .eq('shop_id', sid)
          .order('created_at', { ascending: false })
          .limit(6)

        setRecentTickets(data ?? [])
      })(),

      // — Nombre de clients
      (async () => {
        const { count } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', sid)
        setClientCount(count ?? 0)
      })(),
    ])

    setLastRefresh(new Date())
  }, [supabase])

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      await loadAll(shop.id)
      setLoading(false)
    }
    init()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAll(shopId)
    setRefreshing(false)
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  // Tickets en cours (pending + in_repair + ready)
  const ticketsOpen = ticketStats.pending + ticketStats.in_repair + ticketStats.ready

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Tableau de bord
          </h1>
          {lastRefresh && (
            <p className="text-gray-600 text-xs mt-0.5">
              Actualisé à {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10
                     border border-white/10 rounded-lg text-gray-400 text-xs transition-colors
                     disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* ── KPI principaux ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Tickets ouverts"
          value={ticketsOpen}
          icon={Ticket}
          color="text-blue-400"
          bg="bg-blue-400/10"
          sub={`${ticketStats.total} au total`}
          href="/admin/tickets"
        />
        <KpiCard
          label="En réparation"
          value={ticketStats.in_repair}
          icon={Wrench}
          color="text-amber-400"
          bg="bg-amber-400/10"
          sub={`${ticketStats.pending} en attente`}
          href="/admin/tickets"
        />
        <KpiCard
          label="Prêts à livrer"
          value={ticketStats.ready}
          icon={CheckCircle2}
          color="text-green-400"
          bg="bg-green-400/10"
          sub={`${ticketStats.delivered_month} livrés ce mois`}
          href="/admin/tickets"
        />
        <KpiCard
          label="CA du mois"
          value={eur(invoiceStats.ca_month)}
          icon={TrendingUp}
          color="text-amber-400"
          bg="bg-amber-400/10"
          sub={`${invoiceStats.sent} facture${invoiceStats.sent > 1 ? 's' : ''} à encaisser`}
          href="/admin/factures"
        />
      </div>

      {/* ── Ligne secondaire KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Clients"
          value={clientCount}
          icon={Users}
          color="text-purple-400"
          bg="bg-purple-400/10"
          href="/admin/clients"
        />
        <KpiCard
          label="Factures envoyées"
          value={invoiceStats.sent}
          icon={Receipt}
          color="text-blue-400"
          bg="bg-blue-400/10"
          href="/admin/factures"
        />
        <KpiCard
          label="Factures en retard"
          value={invoiceStats.overdue}
          icon={Clock}
          color={invoiceStats.overdue > 0 ? 'text-red-400' : 'text-gray-500'}
          bg={invoiceStats.overdue > 0 ? 'bg-red-400/10' : 'bg-white/5'}
          href="/admin/factures"
        />
        <KpiCard
          label="Ruptures de stock"
          value={stockAlerts.length}
          icon={Package}
          color={stockAlerts.length > 0 ? 'text-orange-400' : 'text-gray-500'}
          bg={stockAlerts.length > 0 ? 'bg-orange-400/10' : 'bg-white/5'}
          href="/admin/parts"
        />
      </div>

      {/* ── Graphique + Alertes stock ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Activité hebdomadaire */}
        <div className="lg:col-span-2 bg-[#111118] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold text-sm">Activité — 7 derniers jours</h2>
              <p className="text-gray-600 text-xs mt-0.5">Tickets créés par jour</p>
            </div>
            <span className="text-xs text-gray-600">
              Total : {weeklyData.reduce((s, d) => s + d.count, 0)}
            </span>
          </div>
          {weeklyData.length > 0
            ? <WeeklyChart data={weeklyData} />
            : <div className="h-16 flex items-center justify-center text-gray-700 text-sm">
                Aucune donnée
              </div>
          }
        </div>

        {/* Alertes stock */}
        <div className="bg-[#111118] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="text-white font-semibold text-sm">Alertes stock</h2>
            </div>
            <Link href="/admin/parts"
              className="text-xs text-gray-500 hover:text-white transition-colors">
              Voir tout →
            </Link>
          </div>

          {stockAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center">
              <PackageCheck className="w-6 h-6 text-green-400 mb-2" />
              <p className="text-xs text-gray-500">Stock OK — aucune alerte</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stockAlerts.map(part => (
                <div key={part.id}
                  className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-gray-300 text-xs font-medium truncate">{part.name}</p>
                    <p className="text-gray-600 text-[10px]">Min : {part.min_stock} {part.unit || 'u.'}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold
                    ${part.qty_stock <= 0
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-orange-500/15 text-orange-400'
                    }`}>
                    {part.qty_stock <= 0 ? 'Rupture' : `${part.qty_stock} restant${part.qty_stock > 1 ? 's' : ''}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tickets récents ── */}
      <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm">Tickets récents</h2>
          <Link href="/admin/tickets"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
            Voir tous <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Ticket className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-500">Aucun ticket pour l'instant</p>
            <Link href="/admin/tickets"
              className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white
                         text-xs font-semibold rounded-lg transition-colors">
              Créer un ticket
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentTickets.map(ticket => {
              const cfg = STATUS_CFG[ticket.status] ?? STATUS_CFG.pending
              const device = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ')
                || ticket.device_type || '—'
              return (
                <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors">
                  {/* Numéro */}
                  <span className="font-mono text-xs text-amber-400 flex-shrink-0 w-28 truncate">
                    {ticket.tracking_token}
                  </span>
                  {/* Client + appareil */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-sm font-medium truncate">
                      {ticket.clients?.full_name || '—'}
                    </p>
                    <p className="text-gray-600 text-xs truncate">{device}</p>
                  </div>
                  {/* Statut */}
                  <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full
                                   text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                    <StatusDot status={ticket.status} />
                    {cfg.label}
                  </span>
                  {/* Date */}
                  <span className="flex-shrink-0 text-xs text-gray-600 hidden sm:block">
                    {fmtDate(ticket.created_at)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

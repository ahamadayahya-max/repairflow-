'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic_ from 'next/dynamic'
import { motion } from 'framer-motion'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Ticket, Wrench, CheckCircle2, TrendingUp,
  AlertTriangle, Receipt, Clock, ArrowRight,
  Loader2, Package, Users, RefreshCw, Zap,
} from 'lucide-react'
import HoloCard from '@/components/ui/HoloCard'
import ParticleField from '@/components/ui/ParticleField'

// Graphique chargé côté client uniquement
const ImmersiveChart = dynamic_(() => import('@/components/ui/ImmersiveChart'), { ssr: false })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ---------------------------------------------------------------------------
// Composant barre de statut tickets
// ---------------------------------------------------------------------------
/**
 * Barre de répartition des statuts de tickets.
 * @param {{ pending: number, in_repair: number, ready: number, delivered: number }} props
 */
function StatusBar({ pending, in_repair, ready, delivered }) {
  const total = pending + in_repair + ready + delivered || 1
  const segments = [
    { label: 'En attente',    value: pending,   color: '#f59e0b' },
    { label: 'En réparation', value: in_repair,  color: '#3b82f6' },
    { label: 'Prêts',         value: ready,      color: '#10b981' },
    { label: 'Livrés',        value: delivered,  color: '#6b7280' },
  ]

  return (
    <div className="space-y-3">
      {/* Barre colorée */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ width: 0 }}
            animate={{ width: `${(s.value / total) * 100}%` }}
            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: s.color, minWidth: s.value > 0 ? 4 : 0, boxShadow: `0 0 6px ${s.color}50` }}
          />
        ))}
      </div>
      {/* Légende */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
            <span className="text-[10px] font-bold text-gray-400">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Vue d'ensemble — commande center
// ---------------------------------------------------------------------------
export default function OverviewPage() {
  const supabase = getSupabaseClient()

  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [kpis,       setKpis]       = useState({
    pending: 0, in_repair: 0, ready: 0, delivered_month: 0,
    clients: 0, ca_month: 0, overdue: 0, stock_alerts: 0,
  })
  const [chartData,     setChartData]     = useState([])
  const [recentTickets, setRecentTickets] = useState([])
  const [stockAlerts,   setStockAlerts]   = useState([])
  const [lastUpdated,   setLastUpdated]   = useState(null)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) return

      const sid = shop.id
      const now = new Date()
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // Toutes les requêtes en parallèle
      const [
        { data: allTickets },
        { count: clientCount },
        { data: caData },
        { count: overdueCount },
        { data: lowStock },
        { data: recent },
      ] = await Promise.all([
        supabase.from('tickets').select('id, status, created_at').eq('shop_id', sid),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('shop_id', sid),
        supabase.from('invoices')
          .select('total_net')
          .eq('shop_id', sid)
          .in('status', ['paid', 'sent'])
          .gte('created_at', startMonth),
        supabase.from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', sid).eq('status', 'overdue'),
        supabase.from('parts_inventory')
          .select('id, part_name, qty_stock, alert_threshold')
          .eq('shop_id', sid)
          .lte('qty_stock', 0)
          .limit(5),
        supabase.from('tickets')
          .select(`id, status, device_type, device_brand, device_model,
                   received_at, clients!tickets_client_id_fkey(full_name)`)
          .eq('shop_id', sid)
          .order('received_at', { ascending: false })
          .limit(5),
      ])

      const tickets      = allTickets ?? []
      const pending      = tickets.filter(t => t.status === 'pending').length
      const in_repair    = tickets.filter(t => t.status === 'in_repair').length
      const ready        = tickets.filter(t => t.status === 'ready').length
      const deliv_month  = tickets.filter(t =>
        t.status === 'delivered' && t.created_at >= startMonth
      ).length
      const ca_month = (caData ?? []).reduce((s, r) => s + parseFloat(r.total_net ?? 0), 0)

      setKpis({
        pending, in_repair, ready,
        delivered_month: deliv_month,
        clients: clientCount ?? 0,
        ca_month,
        overdue: overdueCount ?? 0,
        stock_alerts: (lowStock ?? []).length,
      })
      setStockAlerts(lowStock ?? [])
      setRecentTickets(recent ?? [])

      // Graphique 14 derniers jours
      const days = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const iso = d.toISOString().slice(0, 10)
        const lbl = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        days.push({
          name: lbl,
          tickets: tickets.filter(t => t.created_at?.slice(0, 10) === iso).length,
        })
      }
      setChartData(days)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border border-amber-400/20 animate-ping absolute inset-0" />
          <div className="w-16 h-16 rounded-full border border-amber-400/40 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  const delivered_total = kpis.delivered_month

  return (
    <div className="space-y-6 relative">

      {/* ── En-tête ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-white font-bold text-2xl tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Vue d'ensemble
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Synthèse opérationnelle ·{' '}
            {lastUpdated && (
              <span className="text-gray-600">
                màj {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10
                     text-sm text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all
                     disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </motion.div>

      {/* ── Barre de statut des tickets ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-2xl border p-5"
        style={{
          background: 'rgba(17,17,24,0.85)',
          borderColor: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-400" />
            Répartition des tickets
          </h2>
          <span className="text-xs text-gray-500">
            {kpis.pending + kpis.in_repair + kpis.ready + kpis.delivered_month} au total
          </span>
        </div>
        <StatusBar
          pending={kpis.pending}
          in_repair={kpis.in_repair}
          ready={kpis.ready}
          delivered={kpis.delivered_month}
        />
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HoloCard
          title="En attente"
          value={kpis.pending}
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          gradient="linear-gradient(90deg, #f59e0b, #fbbf24)"
          glowColor="#f59e0b"
          delay={0}
        />
        <HoloCard
          title="En réparation"
          value={kpis.in_repair}
          icon={<Wrench className="w-5 h-5 text-blue-400" />}
          gradient="linear-gradient(90deg, #3b82f6, #60a5fa)"
          glowColor="#3b82f6"
          delay={0.07}
        />
        <HoloCard
          title="Prêts"
          value={kpis.ready}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          gradient="linear-gradient(90deg, #10b981, #34d399)"
          glowColor="#10b981"
          delay={0.14}
        />
        <HoloCard
          title="Clients"
          value={kpis.clients}
          icon={<Users className="w-5 h-5 text-violet-400" />}
          gradient="linear-gradient(90deg, #8b5cf6, #a78bfa)"
          glowColor="#8b5cf6"
          delay={0.21}
        />
        <HoloCard
          title="CA ce mois"
          value={Math.round(kpis.ca_month)}
          suffix=" €"
          icon={<TrendingUp className="w-5 h-5 text-rose-400" />}
          gradient="linear-gradient(90deg, #f43f5e, #fb7185)"
          glowColor="#f43f5e"
          delay={0.28}
        />
        <HoloCard
          title="Livrés ce mois"
          value={delivered_total}
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
          gradient="linear-gradient(90deg, #22c55e, #4ade80)"
          glowColor="#22c55e"
          delay={0.35}
        />
        <HoloCard
          title="Factures en retard"
          value={kpis.overdue}
          icon={<Receipt className="w-5 h-5 text-red-400" />}
          gradient="linear-gradient(90deg, #ef4444, #f87171)"
          glowColor="#ef4444"
          trend={kpis.overdue > 0 ? { value: -kpis.overdue * 10, label: 'impact' } : undefined}
          delay={0.42}
        />
        <HoloCard
          title="Ruptures stock"
          value={kpis.stock_alerts}
          icon={<Package className="w-5 h-5 text-orange-400" />}
          gradient="linear-gradient(90deg, #f97316, #fb923c)"
          glowColor="#f97316"
          trend={kpis.stock_alerts > 0 ? { value: -kpis.stock_alerts * 10, label: 'critique' } : undefined}
          delay={0.49}
        />
      </div>

      {/* ── Zone basse — graphique + listes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Graphique 14 jours */}
        <div className="lg:col-span-2">
          <ImmersiveChart
            data={chartData}
            dataKey="tickets"
            color="#f59e0b"
            title="Tickets créés — 14 derniers jours"
            subtitle="Tendance de l'activité atelier"
          />
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">

          {/* Tickets récents */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden rounded-2xl border"
            style={{
              background: 'rgba(17,17,24,0.85)',
              borderColor: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 relative z-10">
              <h3 className="text-sm font-semibold text-white">Tickets récents</h3>
              <Link href="/admin/tickets"
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                Voir tout <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="relative z-10">
              {recentTickets.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-gray-600">Aucun ticket</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentTickets.map((t, i) => {
                    const STATUS = {
                      pending:   { color: '#f59e0b', label: 'Attente' },
                      in_repair: { color: '#3b82f6', label: 'Réparation' },
                      ready:     { color: '#10b981', label: 'Prêt' },
                      delivered: { color: '#6b7280', label: 'Livré' },
                    }
                    const cfg = STATUS[t.status] ?? STATUS.pending
                    const device = [t.device_brand, t.device_model].filter(Boolean).join(' ') || t.device_type
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + i * 0.05 }}
                      >
                        <Link href={`/admin/tickets/${t.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors group">
                          <div
                            className="w-1.5 h-8 rounded-full flex-shrink-0"
                            style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}50` }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-200 font-medium truncate">
                              {t.clients?.full_name ?? '—'}
                            </p>
                            <p className="text-[10px] text-gray-600 truncate">{device}</p>
                          </div>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: cfg.color, background: cfg.color + '18' }}
                          >
                            {cfg.label}
                          </span>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Alertes stock */}
          {stockAlerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-2xl border"
              style={{
                background: 'rgba(17,17,24,0.85)',
                borderColor: 'rgba(249,115,22,0.2)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none opacity-10 blur-2xl"
                style={{ background: '#f97316', transform: 'translate(30%,-30%)' }}
              />
              <div className="px-5 py-4 border-b border-white/8 relative z-10 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Ruptures stock
                </h3>
                <Link href="/admin/parts"
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                  Gérer →
                </Link>
              </div>
              <div className="relative z-10 divide-y divide-white/5">
                {stockAlerts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.05 }}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Package className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <p className="text-xs text-gray-300 flex-1 truncate">{p.part_name}</p>
                    <span className="text-[10px] font-bold text-red-400 bg-red-400/10
                                     border border-red-400/20 px-1.5 py-0.5 rounded-full">
                      Rupture
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

    </div>
  )
}

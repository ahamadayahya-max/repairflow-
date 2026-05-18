'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic_ from 'next/dynamic'
import { motion } from 'framer-motion'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Clock, Wrench, CheckCircle2, TrendingUp, Plus,
  Ticket, Package, AlertTriangle, ArrowRight, Loader2,
  Leaf, Receipt, CalendarDays, Euro, Zap, Bell,
} from 'lucide-react'
import HoloCard from '@/components/ui/HoloCard'
import FuturisticTicketRow from '@/components/ui/FuturisticTicketRow'
import ParticleField from '@/components/ui/ParticleField'

// Graphique immersif chargé côté client uniquement (SSR incompatible avec recharts)
const ImmersiveChart = dynamic_(() => import('@/components/ui/ImmersiveChart'), { ssr: false })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatEur(n) {
  if (n == null) return '—'
  return parseFloat(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const INV_STATUS = {
  draft:     { label: 'Brouillon', color: '#6b7280' },
  sent:      { label: 'Envoyée',   color: '#3b82f6' },
  paid:      { label: 'Payée',     color: '#10b981' },
  overdue:   { label: 'En retard', color: '#ef4444' },
  cancelled: { label: 'Annulée',   color: '#4b5563' },
}

// ---------------------------------------------------------------------------
// Page dashboard premium
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const supabase = getSupabaseClient()

  const [loading,       setLoading]       = useState(true)
  const [kpis,          setKpis]          = useState({ pending: 0, in_repair: 0, ready: 0, ca_mois: 0, qr_eligible: 0 })
  const [recentTickets, setRecentTickets] = useState([])
  const [agendaToday,   setAgendaToday]   = useState([])
  const [alerts,        setAlerts]        = useState({ overdue: [], lowStock: [], readyNotif: 0 })
  const [chartData,     setChartData]     = useState([])
  const [lastInvoices,  setLastInvoices]  = useState([])
  const [isNewUser,     setIsNewUser]     = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [isTrial,       setIsTrial]       = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shopData } = await supabase
        .from('shops')
        .select('id, subscription_status, trial_ends_at, onboarding_completed_at')
        .eq('owner_id', user.id)
        .single()

      if (!shopData) { setLoading(false); return }

      const sid = shopData.id
      const now  = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const endOfDay     = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      // ── Toutes les requêtes en parallèle ────────────────────────────────
      const [
        { data: allTickets },
        { data: caData },
        { data: recentRaw },
        { data: agenda },
        { data: overdue },
        { data: lowStock },
        { data: lastInv },
        { count: qrCount },
      ] = await Promise.all([
        supabase.from('tickets')
          .select('id, status, created_at')
          .eq('shop_id', sid),
        supabase.from('invoices')
          .select('total_net')
          .eq('shop_id', sid)
          .in('status', ['paid', 'sent'])
          .gte('created_at', firstOfMonth),
        supabase.from('tickets')
          .select(`id, status, device_type, device_brand, device_model,
                   received_at, clients!tickets_client_id_fkey(full_name)`)
          .eq('shop_id', sid)
          .not('status', 'in', '(delivered)')
          .order('received_at', { ascending: false })
          .limit(7),
        supabase.from('appointments')
          .select('id, title, start_at, client_name')
          .eq('shop_id', sid)
          .gte('start_at', startOfDay)
          .lte('start_at', endOfDay)
          .order('start_at'),
        supabase.from('invoices')
          .select('id, invoice_number, total_net')
          .eq('shop_id', sid)
          .eq('status', 'overdue')
          .limit(3),
        supabase.from('parts_inventory')
          .select('id, part_name, qty_stock')
          .eq('shop_id', sid)
          .lte('qty_stock', 0)
          .limit(3),
        supabase.from('invoices')
          .select('id, invoice_number, status, total_net, created_at')
          .eq('shop_id', sid)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', sid)
          .eq('qr_eligible', true)
          .eq('qr_status', 'eligible'),
      ])

      const tickets   = allTickets ?? []
      const pending   = tickets.filter(t => t.status === 'pending').length
      const in_repair = tickets.filter(t => t.status === 'in_repair').length
      const ready     = tickets.filter(t => t.status === 'ready').length
      const ca_mois   = (caData ?? []).reduce((s, r) => s + parseFloat(r.total_net ?? 0), 0)

      setKpis({ pending, in_repair, ready, ca_mois, qr_eligible: qrCount ?? 0 })
      setRecentTickets(recentRaw ?? [])
      setAgendaToday(agenda ?? [])
      setAlerts({ overdue: overdue ?? [], lowStock: lowStock ?? [], readyNotif: ready })
      setLastInvoices(lastInv ?? [])

      // Graphique des 7 derniers jours
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d   = new Date()
        d.setDate(d.getDate() - i)
        const iso = d.toISOString().slice(0, 10)
        const lbl = d.toLocaleDateString('fr-FR', { weekday: 'short' })
        days.push({ name: lbl, tickets: tickets.filter(t => t.created_at?.slice(0, 10) === iso).length })
      }
      setChartData(days)

      // Essai et nouveau user
      if (shopData.onboarding_completed_at) {
        const diff = Date.now() - new Date(shopData.onboarding_completed_at).getTime()
        setIsNewUser(diff < 24 * 60 * 60 * 1000)
      }
      if (shopData.trial_ends_at) {
        setTrialDaysLeft(Math.max(0, Math.ceil(
          (new Date(shopData.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )))
        setIsTrial(shopData.subscription_status === 'trial')
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-amber-400/20 animate-ping absolute inset-0" />
          <div className="w-16 h-16 rounded-full border-2 border-amber-400/40 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  const hasAlerts = alerts.overdue.length > 0 || alerts.lowStock.length > 0

  return (
    <div className="space-y-6 relative">

      {/* ── Bannière essai gratuit ── */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-amber-500/20 p-4
                     flex items-center justify-between gap-4 flex-wrap"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(17,17,24,0.9))' }}
        >
          <div
            className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none opacity-15 blur-3xl"
            style={{ background: '#f59e0b', transform: 'translate(30%,-30%)' }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-300 font-semibold text-sm">
                {isNewUser ? 'Bienvenue sur TickeeFlow !' : 'Essai gratuit en cours'}
              </p>
              <p className="text-amber-500/70 text-xs mt-0.5">
                {trialDaysLeft} jour{trialDaysLeft !== 1 ? 's' : ''} restant{trialDaysLeft !== 1 ? 's' : ''} · Passez à un plan payant pour continuer sans interruption
              </p>
            </div>
          </div>
          <div className="flex gap-2 relative z-10 flex-wrap">
            <Link href="/admin/tickets/new"
              className="bg-amber-500 hover:bg-amber-400 text-white font-semibold
                         px-4 py-2 rounded-xl text-sm transition-colors">
              + Créer un ticket
            </Link>
            <Link href="/admin/settings"
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300
                         px-4 py-2 rounded-xl text-sm transition-colors">
              Choisir un plan →
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── En-tête ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-white font-bold text-2xl tracking-tight">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          href="/admin/tickets/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
                     text-white transition-all duration-200 hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 20px rgba(245,158,11,0.3)' }}
        >
          <Plus className="w-4 h-4" />
          Nouveau ticket
        </Link>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          title="Prêts à rendre"
          value={kpis.ready}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          gradient="linear-gradient(90deg, #10b981, #34d399)"
          glowColor="#10b981"
          trend={kpis.ready > 0 ? { value: 0, label: 'à notifier' } : undefined}
          delay={0.14}
        />
        <HoloCard
          title="CA ce mois"
          value={Math.round(kpis.ca_mois)}
          suffix=" €"
          icon={<Euro className="w-5 h-5 text-violet-400" />}
          gradient="linear-gradient(90deg, #8b5cf6, #a78bfa)"
          glowColor="#8b5cf6"
          delay={0.21}
        />
        <HoloCard
          title="QualiRépar"
          value={kpis.qr_eligible}
          icon={<Leaf className="w-5 h-5 text-green-400" />}
          gradient="linear-gradient(90deg, #22c55e, #4ade80)"
          glowColor="#22c55e"
          trend={kpis.qr_eligible > 0 ? { value: 0, label: 'à soumettre' } : undefined}
          delay={0.28}
        />
      </div>

      {/* ── Zone principale — 3 colonnes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colonne 1 — Tickets actifs récents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2 relative overflow-hidden rounded-2xl border"
          style={{
            background: 'rgba(17,17,24,0.85)',
            borderColor: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Halo de fond */}
          <div
            className="absolute top-0 left-0 w-64 h-64 rounded-full pointer-events-none opacity-5 blur-3xl"
            style={{ background: '#f59e0b', transform: 'translate(-30%,-30%)' }}
          />

          {/* En-tête */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 relative z-10">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center">
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
              </div>
              Tickets actifs
              {recentTickets.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                  {recentTickets.length}
                </span>
              )}
            </h2>
            <Link href="/admin/tickets"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Liste */}
          <div className="p-3 relative z-10">
            {recentTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <Ticket className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500">Aucun ticket actif</p>
                <Link href="/admin/tickets/new"
                  className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  Créer le premier <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              recentTickets.map((t, i) => (
                <FuturisticTicketRow key={t.id} ticket={t} index={i} />
              ))
            )}
          </div>
        </motion.div>

        {/* Colonne 2 — Agenda + Alertes */}
        <div className="space-y-4">

          {/* Agenda du jour */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl border"
            style={{
              background: 'rgba(17,17,24,0.85)',
              borderColor: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none opacity-8 blur-3xl"
              style={{ background: '#3b82f6', transform: 'translate(30%,-30%)' }}
            />
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 relative z-10">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-400/15 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                </div>
                Agenda du jour
              </h2>
              <Link href="/admin/agenda"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                + RDV
              </Link>
            </div>
            <div className="relative z-10">
              {agendaToday.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <CalendarDays className="w-7 h-7 text-gray-700 mb-2" />
                  <p className="text-xs text-gray-600">Aucun rendez-vous aujourd'hui</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {agendaToday.map((appt, i) => (
                    <motion.div
                      key={appt.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className="px-5 py-3 flex items-center gap-3"
                    >
                      <div
                        className="text-xs font-mono font-bold px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ background: '#3b82f615', color: '#60a5fa', border: '1px solid #3b82f625' }}
                      >
                        {formatTime(appt.start_at)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-200 font-medium truncate">{appt.title}</p>
                        {appt.client_name && (
                          <p className="text-[10px] text-gray-600 truncate">{appt.client_name}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Alertes */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="relative overflow-hidden rounded-2xl border"
            style={{
              background: 'rgba(17,17,24,0.85)',
              borderColor: hasAlerts || alerts.readyNotif > 0
                ? 'rgba(239,68,68,0.2)'
                : 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {(hasAlerts || alerts.readyNotif > 0) && (
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none opacity-8 blur-3xl"
                style={{ background: '#ef4444', transform: 'translate(30%,-30%)' }}
              />
            )}
            <div className="px-5 py-4 border-b border-white/8 relative z-10 flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                hasAlerts || alerts.readyNotif > 0 ? 'bg-red-400/15' : 'bg-green-400/15'
              }`}>
                {hasAlerts || alerts.readyNotif > 0
                  ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  : <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                }
              </div>
              <h2 className="text-sm font-semibold text-white">Alertes</h2>
              {(hasAlerts || alerts.readyNotif > 0) && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  {alerts.overdue.length + alerts.lowStock.length + (alerts.readyNotif > 0 ? 1 : 0)}
                </span>
              )}
            </div>
            <div className="relative z-10">
              {!hasAlerts && alerts.readyNotif === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-7 h-7 text-green-400 mb-2" />
                  <p className="text-xs text-gray-500">Tout est en ordre</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {alerts.overdue.map(inv => (
                    <Link key={inv.id} href={`/admin/factures/${inv.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                      <Receipt className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-red-400 font-medium">Facture en retard</p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {inv.invoice_number} · {formatEur(inv.total_net)}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {alerts.lowStock.map(part => (
                    <Link key={part.id} href="/admin/parts"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                      <Package className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-orange-400 font-medium">Rupture de stock</p>
                        <p className="text-[10px] text-gray-500 truncate">{part.part_name}</p>
                      </div>
                    </Link>
                  ))}
                  {alerts.readyNotif > 0 && (
                    <Link href="/admin/tickets?status=ready"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                      <Bell className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-green-400 font-medium">
                          {alerts.readyNotif} ticket{alerts.readyNotif > 1 ? 's' : ''} prêt{alerts.readyNotif > 1 ? 's' : ''}
                        </p>
                        <p className="text-[10px] text-gray-500">Client{alerts.readyNotif > 1 ? 's' : ''} à notifier</p>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Zone basse — graphique + factures ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Graphique immersif */}
        <ImmersiveChart
          data={chartData}
          dataKey="tickets"
          color="#f59e0b"
          title="Tickets créés — 7 derniers jours"
          subtitle="Évolution quotidienne de l'activité"
        />

        {/* Dernières factures */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="relative overflow-hidden rounded-2xl border"
          style={{
            background: 'rgba(17,17,24,0.85)',
            borderColor: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none opacity-6 blur-3xl"
            style={{ background: '#8b5cf6', transform: 'translate(-30%, 30%)' }}
          />
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 relative z-10">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-400/15 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-violet-400" />
              </div>
              Dernières factures
            </h2>
            <Link href="/admin/factures"
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="relative z-10">
            {lastInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Receipt className="w-7 h-7 text-gray-700 mb-2" />
                <p className="text-xs text-gray-600">Aucune facture</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {lastInvoices.map((inv, i) => {
                  const st = INV_STATUS[inv.status] ?? { label: inv.status, color: '#6b7280' }
                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                    >
                      <Link href={`/admin/factures/${inv.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors group">
                        {/* Pastille couleur statut */}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: st.color, boxShadow: `0 0 6px ${st.color}60` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-bold" style={{ color: st.color }}>
                            {inv.invoice_number}
                          </p>
                          <p className="text-[10px] text-gray-600">{formatDate(inv.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: st.color, background: st.color + '18', border: `1px solid ${st.color}30` }}
                          >
                            {st.label}
                          </span>
                          <span className="text-sm text-white font-semibold">
                            {formatEur(inv.total_net)}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

    </div>
  )
}

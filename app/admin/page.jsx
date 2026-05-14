'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic_ from 'next/dynamic'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Clock, Wrench, CheckCircle2, TrendingUp, Plus,
  Ticket, Package, AlertTriangle, ArrowRight, Loader2,
  Leaf, Receipt, CalendarDays, EuroSign,
} from 'lucide-react'

// Recharts chargé côté client uniquement pour éviter les erreurs SSR
const BarChart  = dynamic_(() => import('recharts').then(m => m.BarChart),  { ssr: false })
const Bar       = dynamic_(() => import('recharts').then(m => m.Bar),       { ssr: false })
const XAxis     = dynamic_(() => import('recharts').then(m => m.XAxis),     { ssr: false })
const YAxis     = dynamic_(() => import('recharts').then(m => m.YAxis),     { ssr: false })
const Tooltip   = dynamic_(() => import('recharts').then(m => m.Tooltip),   { ssr: false })
const ResponsiveContainer = dynamic_(
  () => import('recharts').then(m => m.ResponsiveContainer),
  { ssr: false }
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function formatEur(n) {
  if (n == null) return '—'
  return parseFloat(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

// ---------------------------------------------------------------------------
// Composants locaux
// ---------------------------------------------------------------------------

/**
 * Carte KPI colorée.
 * @param {{ label: string, value: string|number, icon: React.ElementType, color: string, bg: string, sub?: string, alert?: boolean, href?: string }} props
 */
function KpiCard({ label, value, icon: Icon, color, bg, sub, alert, href }) {
  const content = (
    <div className={`bg-[#111118] rounded-xl border p-5 transition-colors
      ${alert ? 'border-red-500/30 hover:border-red-500/50' : 'border-white/10 hover:border-white/20'}
      ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      {alert && value > 0 && (
        <div className="mt-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

const STATUS_CONFIG = {
  pending:   { label: 'En attente',    color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  in_repair: { label: 'En réparation', color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
  ready:     { label: 'Prêt',          color: 'text-green-400',  bg: 'bg-green-400/10'  },
  delivered: { label: 'Livré',         color: 'text-gray-400',   bg: 'bg-gray-400/10'   },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page dashboard
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const supabase = getSupabaseClient()

  const [loading,       setLoading]       = useState(true)
  const [shop,          setShop]          = useState(null)
  const [kpis,          setKpis]          = useState({ pending: 0, in_repair: 0, ready: 0, ca_mois: 0, qr_eligible: 0 })
  const [recentTickets, setRecentTickets] = useState([])
  const [agendaToday,   setAgendaToday]   = useState([])
  const [alerts,        setAlerts]        = useState({ overdue: [], lowStock: [], readyNotif: 0 })
  const [chartData,     setChartData]     = useState([])
  const [lastInvoices,  setLastInvoices]  = useState([])
  const [isNewUser,     setIsNewUser]     = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)

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
      setShop(shopData)

      const sid = shopData.id
      const now = new Date()
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
        // Tickets pour KPIs et graphique
        supabase.from('tickets')
          .select('id, status, created_at, qr_eligible, qr_status')
          .eq('shop_id', sid),
        // CA ce mois — somme depuis les invoices
        supabase.from('invoices')
          .select('total_net')
          .eq('shop_id', sid)
          .in('status', ['paid', 'sent'])
          .gte('created_at', firstOfMonth),
        // 6 tickets actifs récents
        supabase.from('tickets')
          .select('id, status, device_type, device_brand, device_model, created_at, qr_eligible, clients!tickets_client_id_fkey(full_name)')
          .eq('shop_id', sid)
          .not('status', 'in', '(delivered,cancelled)')
          .order('created_at', { ascending: false })
          .limit(6),
        // Agenda du jour
        supabase.from('appointments')
          .select('id, title, start_at, end_at, client_name')
          .eq('shop_id', sid)
          .gte('start_at', startOfDay)
          .lte('start_at', endOfDay)
          .order('start_at'),
        // Factures en retard
        supabase.from('invoices')
          .select('id, invoice_number, total_net')
          .eq('shop_id', sid)
          .eq('status', 'overdue')
          .limit(3),
        // Stock en rupture
        supabase.from('parts_inventory')
          .select('id, part_name, qty_stock')
          .eq('shop_id', sid)
          .lte('qty_stock', 0)
          .limit(3),
        // 5 dernières factures
        supabase.from('invoices')
          .select('id, invoice_number, status, total_net, created_at')
          .eq('shop_id', sid)
          .order('created_at', { ascending: false })
          .limit(5),
        // Bonus QualiRépar à soumettre
        supabase.from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', sid)
          .eq('qr_eligible', true)
          .eq('qr_status', 'eligible'),
      ])

      // ── KPIs ────────────────────────────────────────────────────────────
      const tickets = allTickets ?? []
      const pending   = tickets.filter(t => t.status === 'pending').length
      const in_repair = tickets.filter(t => t.status === 'in_repair').length
      const ready     = tickets.filter(t => t.status === 'ready').length

      const ca_mois = (caData ?? []).reduce((s, r) =>
        s + parseFloat(r.total_net ?? 0), 0)

      setKpis({ pending, in_repair, ready, ca_mois, qr_eligible: qrCount ?? 0 })
      setRecentTickets(recentRaw ?? [])
      setAgendaToday(agenda ?? [])
      setAlerts({
        overdue:     overdue ?? [],
        lowStock:    lowStock ?? [],
        readyNotif:  ready,
      })
      setLastInvoices(lastInv ?? [])

      // ── Graphique CA 7 derniers jours ────────────────────────────────────
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d   = new Date()
        d.setDate(d.getDate() - i)
        const iso = d.toISOString().slice(0, 10)
        const lbl = d.toLocaleDateString('fr-FR', { weekday: 'short' })
        const count = tickets.filter(t => t.created_at?.slice(0, 10) === iso).length
        days.push({ label: lbl, tickets: count })
      }
      setChartData(days)

      // ── Détecte le nouvel utilisateur ────────────────────────────────────
      if (shopData.onboarding_completed_at) {
        const diff = Date.now() - new Date(shopData.onboarding_completed_at).getTime()
        setIsNewUser(diff < 24 * 60 * 60 * 1000)
      }

      if (shopData.trial_ends_at) {
        setTrialDaysLeft(Math.max(0, Math.ceil(
          (new Date(shopData.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )))
      }

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

  const hasAlerts = alerts.overdue.length > 0 || alerts.lowStock.length > 0

  return (
    <div className="space-y-6">

      {/* ── Bannière bienvenue ── */}
      {isNewUser && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4
                        flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="font-semibold text-amber-300 text-sm">Bienvenue sur RepairFlow !</div>
              <div className="text-xs text-amber-500/80 mt-0.5">
                Essai gratuit · {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/tickets/new"
              className="bg-amber-500 hover:bg-amber-400 text-white font-semibold
                         px-4 py-2 rounded-lg text-sm transition-colors">
              + Créer un ticket
            </Link>
            <Link href="/admin/settings"
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300
                         px-4 py-2 rounded-lg text-sm transition-colors">
              Paramètres
            </Link>
          </div>
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/admin/tickets/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Nouveau ticket
        </Link>
      </div>

      {/* ── Zone haute — KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="En attente"    value={kpis.pending}    icon={Clock}        color="text-yellow-400" bg="bg-yellow-400/10" sub="À prendre en charge" />
        <KpiCard label="En réparation" value={kpis.in_repair}  icon={Wrench}       color="text-blue-400"   bg="bg-blue-400/10"   sub="En cours" />
        <KpiCard label="Prêts"         value={kpis.ready}      icon={CheckCircle2} color="text-green-400"  bg="bg-green-400/10"  sub="À restituer" alert={kpis.ready > 0} href="/admin/tickets?status=ready" />
        <KpiCard label="CA ce mois"    value={formatEur(kpis.ca_mois)} icon={TrendingUp} color="text-amber-400" bg="bg-amber-400/10" sub="Factures payées + envoyées" />
        <KpiCard
          label="Bonus QR à soumettre"
          value={kpis.qr_eligible}
          icon={Leaf}
          color="text-green-400"
          bg="bg-green-400/10"
          sub="Dossiers éligibles"
          href="/admin/qualirepar"
          alert={kpis.qr_eligible > 0}
        />
      </div>

      {/* ── Zone milieu — 3 colonnes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colonne 1 — Tickets actifs récents */}
        <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-400" />
              Tickets actifs
            </h2>
            <Link href="/admin/tickets"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Ticket className="w-7 h-7 text-gray-700 mb-2" />
              <p className="text-xs text-gray-600">Aucun ticket actif</p>
              <Link href="/admin/tickets/new" className="mt-2 text-xs text-amber-400 hover:text-amber-300">
                Créer →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentTickets.map(t => {
                const label = [t.device_brand, t.device_model].filter(Boolean).join(' ') || t.device_type
                return (
                  <Link key={t.id} href={`/admin/tickets/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">{label}</p>
                      <p className="text-[10px] text-gray-600 truncate">{t.clients?.full_name ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <StatusBadge status={t.status} />
                      {t.qr_eligible && (
                        <span title="QualiRépar éligible"
                          className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5
                                     rounded-full font-semibold">
                          QR
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Colonne 2 — Agenda du jour */}
        <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-amber-400" />
              Agenda du jour
            </h2>
            <Link href="/admin/agenda"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              + RDV <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {agendaToday.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CalendarDays className="w-7 h-7 text-gray-700 mb-2" />
              <p className="text-xs text-gray-600">Aucun rendez-vous aujourd'hui</p>
              <Link href="/admin/agenda" className="mt-2 text-xs text-amber-400 hover:text-amber-300">
                Planifier →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {agendaToday.map(appt => (
                <div key={appt.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 flex-shrink-0">
                      {new Date(appt.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p className="text-xs text-gray-200 font-medium truncate">{appt.title}</p>
                  </div>
                  {appt.client_name && (
                    <p className="text-[10px] text-gray-600 mt-0.5 pl-10 truncate">{appt.client_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colonne 3 — Alertes */}
        <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Alertes
            </h2>
          </div>
          {!hasAlerts && alerts.readyNotif === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="w-7 h-7 text-green-400 mb-2" />
              <p className="text-xs text-gray-600">Tout est en ordre</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {/* Factures overdue */}
              {alerts.overdue.map(inv => (
                <Link key={inv.id} href={`/admin/factures/${inv.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                  <span className="text-base flex-shrink-0">🧾</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-400 font-medium">Facture en retard</p>
                    <p className="text-[10px] text-gray-600 truncate">
                      {inv.invoice_number} · {formatEur(inv.total_net)}
                    </p>
                  </div>
                </Link>
              ))}
              {/* Stock rupture */}
              {alerts.lowStock.map(part => (
                <Link key={part.id} href="/admin/parts"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                  <span className="text-base flex-shrink-0">📦</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-orange-400 font-medium">Rupture de stock</p>
                    <p className="text-[10px] text-gray-600 truncate">{part.part_name}</p>
                  </div>
                </Link>
              ))}
              {/* Tickets prêts non notifiés */}
              {alerts.readyNotif > 0 && (
                <Link href="/admin/tickets?status=ready"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                  <span className="text-base flex-shrink-0">✅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-400 font-medium">
                      {alerts.readyNotif} ticket{alerts.readyNotif > 1 ? 's' : ''} prêt{alerts.readyNotif > 1 ? 's' : ''}
                    </p>
                    <p className="text-[10px] text-gray-600">Client{alerts.readyNotif > 1 ? 's' : ''} à notifier</p>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Zone basse — 2 colonnes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Graphique barres CA 7 derniers jours */}
        <div className="bg-[#111118] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Tickets créés — 7 derniers jours
          </h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a27', border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="tickets" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5 dernières factures */}
        <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              Dernières factures
            </h2>
            <Link href="/admin/factures"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {lastInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="w-7 h-7 text-gray-700 mb-2" />
              <p className="text-xs text-gray-600">Aucune facture</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {lastInvoices.map(inv => {
                const invStatus = {
                  draft:   { label: 'Brouillon', color: 'text-gray-400'    },
                  sent:    { label: 'Envoyée',   color: 'text-blue-400'    },
                  paid:    { label: 'Payée',     color: 'text-green-400'   },
                  overdue: { label: 'En retard', color: 'text-red-400'     },
                  cancelled:{ label:'Annulée',   color: 'text-gray-600'    },
                }[inv.status] ?? { label: inv.status, color: 'text-gray-400' }
                return (
                  <Link key={inv.id} href={`/admin/factures/${inv.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-amber-400">{inv.invoice_number}</p>
                      <p className="text-[10px] text-gray-600">{formatDate(inv.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold ${invStatus.color}`}>{invStatus.label}</span>
                      <span className="text-xs text-gray-300 font-semibold">{formatEur(inv.total_net)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

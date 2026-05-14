'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Receipt, Plus, Search, Download, Loader2,
  CheckCircle2, XCircle, Clock, Send, AlertTriangle, ChevronRight,
} from 'lucide-react'
import NewInvoiceModal from '@/components/admin/invoices/NewInvoiceModal'

// ---------------------------------------------------------------------------
// Config statuts
// ---------------------------------------------------------------------------
const STATUS_CFG = {
  draft:     { label: 'Brouillon', color: 'text-gray-400',  bg: 'bg-gray-400/10',  icon: Clock        },
  sent:      { label: 'Envoyée',   color: 'text-blue-400',  bg: 'bg-blue-400/10',  icon: Send         },
  paid:      { label: 'Payée',     color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle2 },
  cancelled: { label: 'Annulée',   color: 'text-red-400',   bg: 'bg-red-400/10',   icon: XCircle      },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                      text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  )
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function KpiCard({ label, value, icon, color, sub }) {
  return (
    <div className="bg-[#111118] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------
/**
 * Liste des factures avec KPIs, filtres et création rapide.
 */
export default function FacturesPage() {
  const supabase = getSupabaseClient()

  const [shopId,    setShopId]    = useState(null)
  const [invoices,  setInvoices]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      await loadInvoices(shop.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadInvoices = async (sid) => {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_email, status, subtotal_ht, tva_amount, total_ttc, qualirepar_bonus, total_net, issued_at, due_at, paid_at')
      .eq('shop_id', sid)
      .order('created_at', { ascending: false })
    setInvoices(data ?? [])
  }

  // Statistiques calculées côté client
  const stats = {
    ca_month: invoices
      .filter(i => i.status === 'paid' && i.paid_at &&
        new Date(i.paid_at).getMonth() === new Date().getMonth() &&
        new Date(i.paid_at).getFullYear() === new Date().getFullYear())
      .reduce((s, i) => s + parseFloat(i.total_net || 0), 0),
    total_sent: invoices.filter(i => i.status === 'sent').length,
    total_paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i =>
      i.status === 'sent' && i.due_at && new Date(i.due_at) < new Date()
    ).length,
  }

  const filtered = invoices.filter(inv => {
    const matchStatus = filter === 'all' || inv.status === filter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.client_name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showModal && shopId && (
        <NewInvoiceModal
          shopId={shopId}
          onClose={() => setShowModal(false)}
          onCreated={() => loadInvoices(shopId)}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Facturation
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{invoices.length} facture{invoices.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nouvelle facture
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="CA ce mois"   value={eur(stats.ca_month)}  icon="💰" color="text-amber-400" sub="Factures payées" />
        <KpiCard label="À encaisser"  value={stats.total_sent}     icon="📤" color="text-blue-400"  sub="Envoyées" />
        <KpiCard label="Payées"       value={stats.total_paid}     icon="✅" color="text-green-400" sub="Total" />
        <KpiCard label="En retard"    value={stats.overdue}        icon="⚠️"
                 color={stats.overdue > 0 ? 'text-red-400' : 'text-gray-500'} sub="Échéance dépassée" />
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg
                       text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', ...Object.keys(STATUS_CFG)].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filter === s ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {s === 'all' ? 'Toutes' : STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[280px] text-center
                        bg-[#111118] border border-white/10 rounded-xl">
          <Receipt className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">Aucune facture</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white
                       text-sm font-semibold rounded-lg transition-colors">
            + Nouvelle facture
          </button>
        </div>
      ) : (
        <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['N° Facture','Client','Statut','HT','TTC','Net à payer','Émise le','Échéance',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-600
                                           uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(inv => {
                  const isOverdue = inv.status === 'sent' && inv.due_at && new Date(inv.due_at) < new Date()
                  return (
                    <tr key={inv.id} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-amber-400 whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-200 font-medium">{inv.client_name}</p>
                        {inv.client_email && <p className="text-gray-600 text-xs">{inv.client_email}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                        {isOverdue && <span className="ml-1 text-[10px] text-red-400 font-bold">RETARD</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs tabular-nums whitespace-nowrap">
                        {eur(inv.subtotal_ht)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs tabular-nums whitespace-nowrap">
                        {eur(inv.total_ttc)}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums whitespace-nowrap">
                        <span className="text-white">{eur(inv.total_net)}</span>
                        {parseFloat(inv.qualirepar_bonus || 0) > 0 && (
                          <span className="ml-1 text-[10px] text-green-400">🔁 -{eur(inv.qualirepar_bonus)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.issued_at)}</td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${isOverdue ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
                        {fmtDate(inv.due_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/factures/${inv.id}`}
                          className="flex items-center justify-center w-7 h-7 rounded-lg
                                     text-gray-700 group-hover:text-amber-400 hover:bg-white/5 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

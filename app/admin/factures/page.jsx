'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import PaymentModal from '@/components/admin/PaymentModal'
import {
  Receipt, Plus, Search, Download, Loader2, RefreshCw,
  Eye, CreditCard, CheckCircle2, XCircle, TrendingUp, Clock, AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  draft:     { label: 'Brouillon',   color: 'text-gray-400',   bg: 'bg-gray-400/10'   },
  sent:      { label: 'Envoyée',     color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
  paid:      { label: 'Payée',       color: 'text-green-400',  bg: 'bg-green-400/10'  },
  partial:   { label: 'Partiel',     color: 'text-amber-400',  bg: 'bg-amber-400/10'  },
  overdue:   { label: 'En retard',   color: 'text-red-400',    bg: 'bg-red-400/10'    },
  cancelled: { label: 'Annulée',     color: 'text-gray-600',   bg: 'bg-gray-600/10'   },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
      </div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function FacturesPage() {
  const supabase = getSupabaseClient()

  const [shopId,    setShopId]    = useState(null)
  const [invoices,  setInvoices]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [statusF,   setStatusF]   = useState('all')
  const [flash,     setFlash]     = useState(null)
  const [payTarget, setPayTarget] = useState(null)  // facture pour PaymentModal
  const [stats,     setStats]     = useState({ totalTTC: 0, paid: 0, pending: 0, overdue: 0 })

  // ---------------------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------------------

  const load = useCallback(async (sid) => {
    const id = sid ?? shopId
    if (!id) return
    setLoading(true)

    const { data } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, status, issue_date, due_date,
        total_ht, total_ttc, total_net, amount_paid, qr_deduction,
        payment_method, payment_date, shop_id,
        clients!invoices_client_id_fkey(full_name, phone)
      `)
      .eq('shop_id', id)
      .order('created_at', { ascending: false })

    const list = data || []
    setInvoices(list)

    // Stats locales
    const totalTTC = list.reduce((s, i) => s + Number(i.total_ttc || 0), 0)
    const paid     = list.reduce((s, i) => s + Number(i.amount_paid || 0), 0)
    const pending  = list.filter(i => ['sent','partial','draft'].includes(i.status))
      .reduce((s, i) => s + Math.max(0, Number(i.total_net || 0) - Number(i.amount_paid || 0)), 0)
    const overdue  = list.filter(i => i.status === 'overdue').length

    setStats({ totalTTC, paid, pending, overdue })
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      load(shop.id)
    }
    init()
  }, [])

  // ---------------------------------------------------------------------------
  // Flash
  // ---------------------------------------------------------------------------

  function showFlash(type, msg) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 3000)
  }

  // ---------------------------------------------------------------------------
  // Filtrage
  // ---------------------------------------------------------------------------

  const filtered = invoices.filter(inv => {
    if (statusF !== 'all' && inv.status !== statusF) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        inv.invoice_number?.toLowerCase().includes(s) ||
        inv.clients?.full_name?.toLowerCase().includes(s)
      )
    }
    return true
  })

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleMarkPaid(inv) {
    const { error } = await supabase.from('invoices').update({
      status:         'paid',
      amount_paid:    inv.total_net ?? inv.total_ttc,
      payment_date:   new Date().toISOString(),
    }).eq('id', inv.id)
    if (error) showFlash('error', error.message)
    else { showFlash('success', 'Facture marquée payée'); load() }
  }

  async function handleCancel(inv) {
    if (!window.confirm(`Annuler la facture ${inv.invoice_number} ?`)) return
    const { error } = await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', inv.id)
    if (error) showFlash('error', error.message)
    else { showFlash('success', 'Facture annulée'); load() }
  }

  async function handleDownloadPDF(inv) {
    try {
      const { data: lines } = await supabase
        .from('invoice_lines').select('*').eq('invoice_id', inv.id).order('sort_order')
      const { data: clientData } = inv.client_id
        ? await supabase.from('clients').select('*').eq('id', inv.client_id).single()
        : { data: null }
      const { data: shopData } = await supabase
        .from('shops').select('name, address, phone, email').eq('id', shopId).single()

      const [{ default: InvoicePDF }, { pdf }, { createElement }] = await Promise.all([
        import('@/components/admin/pdf/InvoicePDF'),
        import('@react-pdf/renderer'),
        import('react'),
      ])
      const blob = await pdf(createElement(InvoicePDF, {
        invoice: inv, lines: lines || [], shop: shopData || {}, client: clientData || {},
      })).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `facture-${inv.invoice_number}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showFlash('error', 'Erreur PDF : ' + err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${flash.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {flash.msg}
        </div>
      )}

      {/* PaymentModal */}
      {payTarget && (
        <PaymentModal
          invoice={payTarget}
          isOpen={true}
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); load() }}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Factures
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} facture{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/factures/nouvelle"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total facturé" value={eur(stats.totalTTC)}
          icon={TrendingUp} color="text-white" bg="bg-white/5" />
        <KpiCard label="Encaissé" value={eur(stats.paid)}
          icon={CheckCircle2} color="text-green-400" bg="bg-green-400/10" />
        <KpiCard label="En attente" value={eur(stats.pending)}
          icon={Clock} color="text-amber-400" bg="bg-amber-400/10" />
        <KpiCard label="En retard" value={`${stats.overdue} facture${stats.overdue > 1 ? 's' : ''}`}
          icon={AlertTriangle} color="text-red-400" bg="bg-red-400/10" />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-[#111118] border border-white/10 rounded-xl pl-9 pr-3 py-2
                       text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/40" />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="bg-[#111118] border border-white/10 rounded-xl px-3 py-2 text-sm
                     text-gray-200 focus:outline-none focus:border-amber-500/40">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white
                     bg-white/5 border border-white/10 rounded-xl transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-500">
              {invoices.length === 0 ? 'Aucune facture pour le moment' : 'Aucun résultat'}
            </p>
            {invoices.length === 0 && (
              <Link href="/admin/factures/nouvelle" className="mt-3 text-xs text-amber-400 hover:text-amber-300">
                Créer la première facture →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Numéro', 'Client', 'Émise', 'Échéance', 'Total TTC', 'Payé', 'Reste dû', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(inv => {
                  const resteDu = Math.max(0, Number(inv.total_net || 0) - Number(inv.amount_paid || 0))
                  return (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-3">
                        <Link href={`/admin/factures/${inv.id}`}
                          className="font-mono text-amber-400 hover:text-amber-300 text-xs font-medium">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-gray-200">{inv.clients?.full_name || '—'}</p>
                        <p className="text-xs text-gray-600">{inv.clients?.phone || ''}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs">{fmtDate(inv.issue_date)}</td>
                      <td className="px-3 py-3 text-xs">
                        <span className={inv.status === 'overdue' ? 'text-red-400' : 'text-gray-400'}>
                          {fmtDate(inv.due_date)}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-gray-200 font-medium text-xs">
                        {eur(inv.total_ttc)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-green-400 text-xs">
                        {eur(inv.amount_paid)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-xs">
                        <span className={resteDu > 0 ? 'text-amber-400' : 'text-gray-600'}>
                          {eur(resteDu)}
                        </span>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/admin/factures/${inv.id}`}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Voir">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button onClick={() => setPayTarget(inv)}
                              className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors" title="Paiement">
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDownloadPDF(inv)}
                            className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="PDF">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {inv.status === 'sent' && (
                            <button onClick={() => handleMarkPaid(inv)}
                              className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors" title="Marquer payée">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.status === 'draft' && (
                            <button onClick={() => handleCancel(inv)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Annuler">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

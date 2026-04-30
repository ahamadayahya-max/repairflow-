'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  BarChart3, Download, Loader2, TrendingUp, CreditCard,
  Clock, AlertTriangle, FileSpreadsheet,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

function KpiCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

function downloadCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(';')
  const rows    = data.map(r =>
    Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
  ).join('\n')
  const blob = new Blob(['﻿' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function ComptabilitePage() {
  const supabase = getSupabaseClient()
  const now      = new Date()

  const [shopId,    setShopId]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [stats,     setStats]     = useState(null)
  const [month,     setMonth]     = useState(now.getMonth() + 1)
  const [year,      setYear]      = useState(now.getFullYear())
  const [exporting, setExporting] = useState(false)
  const [flash,     setFlash]     = useState(null)

  // ---------------------------------------------------------------------------
  // Chargement RPC stats
  // ---------------------------------------------------------------------------

  async function loadStats(sid, m, y) {
    const id = sid ?? shopId
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_accounting_stats', {
      p_month: m, p_year: y,
    })
    if (!error) setStats(data)
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      loadStats(shop.id, month, year)
    }
    init()
  }, [])

  function showFlash(type, msg) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 3000)
  }

  // ---------------------------------------------------------------------------
  // Export CSV factures
  // ---------------------------------------------------------------------------

  async function exportFactures() {
    if (!shopId) return
    setExporting(true)
    try {
      const { data } = await supabase
        .from('invoices')
        .select(`
          invoice_number, issue_date, due_date, status,
          total_ht, total_ttc, total_net, amount_paid, qr_deduction,
          payment_method, payment_date,
          clients!invoices_client_id_fkey(full_name)
        `)
        .eq('shop_id', shopId)
        .eq('issue_date', `${year}-${String(month).padStart(2, '0')}`)
        .not('status', 'eq', 'cancelled')
        .order('issue_date')

      if (!data?.length) { showFlash('error', 'Aucune facture sur cette période'); return }

      downloadCSV(data.map(i => ({
        Numéro:           i.invoice_number,
        Date:             i.issue_date,
        Client:           i.clients?.full_name || '',
        'HT (€)':         Number(i.total_ht || 0).toFixed(2),
        'TVA (€)':        Number((i.total_ttc || 0) - (i.total_ht || 0)).toFixed(2),
        'TTC (€)':        Number(i.total_ttc || 0).toFixed(2),
        'QualiRépar (€)': Number(i.qr_deduction || 0).toFixed(2),
        'Net (€)':        Number(i.total_net || 0).toFixed(2),
        'Payé (€)':       Number(i.amount_paid || 0).toFixed(2),
        'Reste (€)':      Math.max(0, Number(i.total_net || 0) - Number(i.amount_paid || 0)).toFixed(2),
        Statut:           i.status,
        Paiement:         i.payment_method || '',
        'Date paiement':  i.payment_date ? new Date(i.payment_date).toLocaleDateString('fr-FR') : '',
      })), `factures-${year}-${String(month).padStart(2, '0')}.csv`)

      showFlash('success', 'Export téléchargé')
    } catch (err) {
      showFlash('error', err.message)
    } finally {
      setExporting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Export CSV encaissements
  // ---------------------------------------------------------------------------

  async function exportEncaissements() {
    if (!shopId) return
    setExporting(true)
    try {
      const { data } = await supabase
        .from('payments')
        .select(`
          paid_at, amount, method, reference, notes,
          invoices!payments_invoice_id_fkey(invoice_number, clients!invoices_client_id_fkey(full_name))
        `)
        .eq('shop_id', shopId)
        .gte('paid_at', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('paid_at',  `${year}-${String(month < 12 ? month + 1 : 1).padStart(2, '0')}-01`)
        .order('paid_at')

      if (!data?.length) { showFlash('error', 'Aucun encaissement sur cette période'); return }

      downloadCSV(data.map(p => ({
        Date:       new Date(p.paid_at).toLocaleDateString('fr-FR'),
        Facture:    p.invoices?.invoice_number || '',
        Client:     p.invoices?.clients?.full_name || '',
        'Montant (€)': Number(p.amount).toFixed(2),
        Mode:       p.method,
        Référence:  p.reference || '',
      })), `encaissements-${year}-${String(month).padStart(2, '0')}.csv`)

      showFlash('success', 'Export téléchargé')
    } catch (err) {
      showFlash('error', err.message)
    } finally {
      setExporting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-5">
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${flash.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {flash.msg}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Comptabilité
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Statistiques et exports comptables</p>
        </div>

        {/* Sélecteur mois / année */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => { const m = Number(e.target.value); setMonth(m); loadStats(shopId, m, year) }}
            className="bg-[#111118] border border-white/10 rounded-xl px-3 py-2 text-sm
                       text-gray-200 focus:outline-none focus:border-amber-500/40"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => { const y = Number(e.target.value); setYear(y); loadStats(shopId, month, y) }}
            className="bg-[#111118] border border-white/10 rounded-xl px-3 py-2 text-sm
                       text-gray-200 focus:outline-none focus:border-amber-500/40"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="CA HT" value={eur(stats.ca_ht)}
              icon={TrendingUp} color="text-white" bg="bg-white/5" />
            <KpiCard label="TVA collectée" value={eur(stats.tva_collectee)}
              icon={FileSpreadsheet} color="text-blue-400" bg="bg-blue-400/10" />
            <KpiCard label="Encaissé" value={eur(stats.total_encaisse)}
              icon={CreditCard} color="text-green-400" bg="bg-green-400/10" />
            <KpiCard label="En attente" value={eur(stats.total_en_attente)}
              icon={Clock} color="text-amber-400" bg="bg-amber-400/10" />
          </div>

          {/* Détail factures */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Synthèse {MONTHS[month - 1]} {year}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {[
                { l: 'Factures émises',  v: stats.nb_factures || 0, c: 'text-white' },
                { l: 'Factures payées',  v: stats.nb_payees   || 0, c: 'text-green-400' },
                { l: 'En retard',        v: stats.nb_en_retard || 0, c: 'text-red-400' },
                { l: 'Total facturé TTC',v: eur(stats.total_facture_ttc), c: 'text-white' },
                { l: 'Total encaissé',   v: eur(stats.total_encaisse), c: 'text-green-400' },
                { l: 'Reste à encaisser',v: eur(stats.total_en_attente), c: 'text-amber-400' },
              ].map(({ l, v, c }) => (
                <div key={l} className="bg-white/3 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{l}</p>
                  <p className={`font-semibold ${c}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-[#111118] rounded-xl border border-white/10 p-8 text-center text-gray-500 text-sm">
          Impossible de charger les statistiques.
        </div>
      )}

      {/* Exports */}
      <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-amber-400" />
          Exports CSV — {MONTHS[month - 1]} {year}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={exportFactures}
            disabled={exporting}
            className="flex items-center gap-3 p-4 bg-white/3 hover:bg-white/6 border border-white/10
                       rounded-xl transition-colors text-left disabled:opacity-50"
          >
            <div className="w-9 h-9 bg-blue-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Factures du mois</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Numéro · Client · HT · TVA · TTC · Statut · Paiement
              </p>
            </div>
            {exporting && <Loader2 className="w-4 h-4 text-gray-500 animate-spin ml-auto" />}
          </button>

          <button
            onClick={exportEncaissements}
            disabled={exporting}
            className="flex items-center gap-3 p-4 bg-white/3 hover:bg-white/6 border border-white/10
                       rounded-xl transition-colors text-left disabled:opacity-50"
          >
            <div className="w-9 h-9 bg-green-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Encaissements du mois</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Date · Facture · Client · Montant · Mode · Référence
              </p>
            </div>
            {exporting && <Loader2 className="w-4 h-4 text-gray-500 animate-spin ml-auto" />}
          </button>
        </div>

        {/* Note légale FEC */}
        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400/80">
            Pour l'export FEC (Fichier des Écritures Comptables) requis par l'administration fiscale,
            transmettez les CSV ci-dessus à votre expert-comptable.
          </p>
        </div>
      </div>
    </div>
  )
}

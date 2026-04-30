'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import LineItemsEditor from '@/components/admin/LineItemsEditor'
import PaymentModal from '@/components/admin/PaymentModal'
import {
  ArrowLeft, Save, Download, Send, Loader2, CreditCard,
  CheckCircle2, Receipt, User, StickyNote,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  draft:     { label: 'Brouillon',  color: 'text-gray-400',  bg: 'bg-gray-400/10'  },
  sent:      { label: 'Envoyée',    color: 'text-blue-400',  bg: 'bg-blue-400/10'  },
  paid:      { label: 'Payée',      color: 'text-green-400', bg: 'bg-green-400/10' },
  partial:   { label: 'Partiel',    color: 'text-amber-400', bg: 'bg-amber-400/10' },
  overdue:   { label: 'En retard',  color: 'text-red-400',   bg: 'bg-red-400/10'   },
  cancelled: { label: 'Annulée',    color: 'text-gray-600',  bg: 'bg-gray-600/10'  },
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const INPUT_CLS = `w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white
                  text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors`

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page édition facture
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage() {
  const { id }   = useParams()
  const supabase = getSupabaseClient()

  const [shopId,    setShopId]    = useState(null)
  const [clients,   setClients]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [flash,     setFlash]     = useState(null)
  const [invoice,   setInvoice]   = useState(null)
  const [showModal, setShowModal] = useState(false)

  const [clientId,  setClientId]  = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate,   setDueDate]   = useState('')
  const [taxRate,   setTaxRate]   = useState('20')
  const [discount,  setDiscount]  = useState('0')
  const [qrDed,     setQrDed]     = useState('0')
  const [notes,     setNotes]     = useState('')
  const [lines,     setLines]     = useState([])

  // ---------------------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------------------

  async function loadData(shopId) {
    const [{ data: cls }, { data: inv }, { data: invLines }] = await Promise.all([
      supabase.from('clients').select('id, full_name, phone, email').eq('shop_id', shopId).order('full_name'),
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('sort_order'),
    ])
    setClients(cls || [])
    if (inv) {
      setInvoice(inv)
      setClientId(inv.client_id || '')
      setIssueDate(inv.issue_date || '')
      setDueDate(inv.due_date || '')
      setTaxRate(String(inv.tax_rate || '20'))
      setDiscount(String(inv.discount_amount || '0'))
      setQrDed(String(inv.qr_deduction || '0'))
      setNotes(inv.notes || '')
    }
    setLines((invLines || []).map(l => ({ ...l, _key: l.id })))
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      await loadData(shop.id)
      setLoading(false)
    }
    init()
  }, [id])

  // ---------------------------------------------------------------------------
  // Calculs
  // ---------------------------------------------------------------------------

  const subtotal  = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const discountN = Number(discount || 0)
  const totalHT   = subtotal - discountN
  const taxRateN  = Number(taxRate || 20)
  const tva       = totalHT * taxRateN / 100
  const totalTTC  = totalHT + tva
  const qrN       = Number(qrDed || 0)
  const totalNet  = totalTTC - qrN
  const resteDu   = Math.max(0, totalNet - Number(invoice?.amount_paid || 0))

  function showFlash(type, msg) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Sauvegarde
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async (statusOverride) => {
    if (!shopId) return
    setSaving(true)
    try {
      const labourCost = lines.filter(l => l.line_type === 'labour')
        .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
      const partsCost = lines.filter(l => l.line_type !== 'labour')
        .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)

      const payload = {
        client_id:       clientId || null,
        issue_date:      issueDate,
        due_date:        dueDate || null,
        labour_cost:     labourCost,
        parts_cost:      partsCost,
        discount_amount: discountN,
        qr_deduction:    qrN,
        tax_rate:        taxRateN,
        notes:           notes.trim() || null,
      }
      if (statusOverride) payload.status = statusOverride

      const { error: invErr } = await supabase.from('invoices').update(payload).eq('id', id)
      if (invErr) throw invErr

      await supabase.from('invoice_lines').delete().eq('invoice_id', id)
      if (lines.length) {
        const { error: lErr } = await supabase.from('invoice_lines').insert(
          lines.map((l, i) => ({
            invoice_id:  id,
            description: l.description || '',
            quantity:    Number(l.quantity) || 1,
            unit_price:  Number(l.unit_price) || 0,
            line_type:   l.line_type || 'labour',
            part_id:     l.part_id || null,
            sort_order:  i,
          }))
        )
        if (lErr) throw lErr
      }

      setInvoice(i => ({ ...i, ...payload }))
      showFlash('success', 'Facture enregistrée')
    } catch (err) {
      showFlash('error', err.message)
    } finally {
      setSaving(false)
    }
  }, [shopId, clientId, issueDate, dueDate, taxRateN, discountN, qrN, notes, lines, id])

  // ---------------------------------------------------------------------------
  // Télécharger PDF
  // ---------------------------------------------------------------------------

  async function handleDownloadPDF() {
    try {
      const clientData = clients.find(c => c.id === clientId) || {}
      const { data: shopData } = await supabase
        .from('shops').select('name, address, phone, email').eq('id', shopId).single()

      const [{ default: InvoicePDF }, { pdf }, { createElement }] = await Promise.all([
        import('@/components/admin/pdf/InvoicePDF'),
        import('@react-pdf/renderer'),
        import('react'),
      ])
      const blob = await pdf(createElement(InvoicePDF, {
        invoice: { ...invoice, discount_amount: discountN, tax_rate: taxRateN, notes, qr_deduction: qrN },
        lines, shop: shopData || {}, client: clientData,
      })).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `facture-${invoice?.invoice_number}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showFlash('error', 'Erreur PDF : ' + err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
    </div>
  )

  if (!invoice) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-gray-500">Facture introuvable</p>
      <Link href="/admin/factures" className="mt-3 text-amber-400 text-sm hover:text-amber-300">
        ← Retour aux factures
      </Link>
    </div>
  )

  const cfg = STATUS_CFG[invoice.status] || STATUS_CFG.draft

  return (
    <div className="space-y-5 max-w-4xl">
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${flash.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {flash.msg}
        </div>
      )}

      {showModal && invoice && (
        <PaymentModal
          invoice={{ ...invoice, total_net: totalNet }}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            setShowModal(false)
            if (shopId) { await loadData(shopId); setLoading(false) }
          }}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/factures" className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              {invoice.invoice_number}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white
                       bg-white/5 border border-white/10 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-400
                         bg-green-400/10 border border-green-400/20 rounded-xl hover:bg-green-400/20 transition-colors">
              <CreditCard className="w-4 h-4" /> Paiement
            </button>
          )}
          <button onClick={() => handleSave()} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white
                       bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Récap paiement si déjà payé partiellement */}
      {Number(invoice.amount_paid) > 0 && (
        <div className="bg-green-400/5 border border-green-400/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Paiement reçu : <strong>{eur(invoice.amount_paid)}</strong></span>
          </div>
          <span className={`text-sm font-medium ${resteDu > 0 ? 'text-amber-400' : 'text-green-400'}`}>
            {resteDu > 0 ? `Reste dû : ${eur(resteDu)}` : 'Soldée ✓'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Client & dates */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" /> Client & dates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Client">
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={INPUT_CLS}>
                  <option value="">— Sans client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </Field>
              <Field label="Date d'émission">
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label="Date d'échéance">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>
          </div>

          {/* Lignes */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Prestations & pièces</h2>
            <LineItemsEditor lines={lines} onChange={setLines} shopId={shopId} />
          </div>

          {/* Notes */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-400" /> Notes
            </h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Notes visibles sur la facture…" className={INPUT_CLS + ' resize-none'} />
          </div>
        </div>

        {/* Totaux */}
        <div>
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4 sticky top-4">
            <h2 className="text-sm font-semibold text-white">Récapitulatif</h2>
            <Field label="TVA (%)">
              <input type="number" min="0" max="100" step="0.1" value={taxRate}
                onChange={e => setTaxRate(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Remise (€)">
              <input type="number" min="0" step="0.01" value={discount}
                onChange={e => setDiscount(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Déduction QualiRépar (€)">
              <input type="number" min="0" step="0.01" value={qrDed}
                onChange={e => setQrDed(e.target.value)} className={INPUT_CLS} />
            </Field>
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Sous-total HT</span><span className="tabular-nums">{eur(subtotal)}</span>
              </div>
              {discountN > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Remise</span><span className="tabular-nums">−{eur(discountN)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-400">
                <span>TVA ({taxRateN}%)</span><span className="tabular-nums">{eur(tva)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-300 border-t border-white/10 pt-2">
                <span>Total TTC</span><span className="tabular-nums">{eur(totalTTC)}</span>
              </div>
              {qrN > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Bonus QualiRépar</span><span className="tabular-nums">−{eur(qrN)}</span>
                </div>
              )}
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-xs text-amber-400/70 mb-1">Net à payer</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{eur(totalNet)}</p>
            </div>
            <button onClick={() => handleSave()} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold
                         text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {invoice.status === 'draft' && (
              <button onClick={() => handleSave('sent')} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium
                           text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/20 rounded-xl transition-colors">
                <Send className="w-4 h-4" /> Marquer envoyée
              </button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <button onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium
                           text-green-400 bg-green-400/10 hover:bg-green-400/20 border border-green-400/20 rounded-xl transition-colors">
                <CreditCard className="w-4 h-4" /> Enregistrer un paiement
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import LineItemsEditor from '@/components/admin/LineItemsEditor'
import { ArrowLeft, Save, Loader2, Receipt, User, Calendar, StickyNote } from 'lucide-react'
import { format, addDays } from 'date-fns'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Page création facture
// ---------------------------------------------------------------------------

export default function NewInvoicePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const quoteId      = searchParams.get('quote')
  const supabase     = getSupabaseClient()

  const [shopId,  setShopId]  = useState(null)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [flash,   setFlash]   = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const [clientId,   setClientId]   = useState('')
  const [issueDate,  setIssueDate]  = useState(today)
  const [dueDate,    setDueDate]    = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [taxRate,    setTaxRate]    = useState('20')
  const [discount,   setDiscount]   = useState('0')
  const [qrDed,      setQrDed]      = useState('0')
  const [notes,      setNotes]      = useState('')
  const [lines,      setLines]      = useState([])

  // ---------------------------------------------------------------------------
  // Chargement + pré-remplissage depuis un devis
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)

      const { data: cls } = await supabase
        .from('clients').select('id, full_name, phone, email')
        .eq('shop_id', shop.id).order('full_name')
      setClients(cls || [])

      // Pré-remplir depuis un devis accepté
      if (quoteId) {
        const [{ data: q }, { data: qLines }] = await Promise.all([
          supabase.from('quotes').select('*').eq('id', quoteId).single(),
          supabase.from('quote_lines').select('*').eq('quote_id', quoteId).order('sort_order'),
        ])
        if (q) {
          setClientId(q.client_id || '')
          setTaxRate(String(q.tax_rate || '20'))
          setDiscount(String(q.discount_amount || '0'))
          setNotes(q.notes || '')
          setLines((qLines || []).map(l => ({ ...l, _key: l.id })))
        }
      }
      setLoading(false)
    }
    init()
  }, [quoteId])

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

  function showFlash(type, msg) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Sauvegarde
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!shopId) return
    setSaving(true)
    try {
      const labourCost = lines.filter(l => l.line_type === 'labour')
        .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
      const partsCost = lines.filter(l => l.line_type !== 'labour')
        .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)

      const { data: numData, error: numErr } = await supabase.rpc('next_document_number', {
        p_shop_id: shopId, p_type: 'invoice',
      })
      if (numErr) throw numErr

      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        shop_id:         shopId,
        client_id:       clientId || null,
        quote_id:        quoteId || null,
        invoice_number:  numData,
        status:          'draft',
        issue_date:      issueDate,
        due_date:        dueDate || null,
        labour_cost:     labourCost,
        parts_cost:      partsCost,
        discount_amount: discountN,
        qr_deduction:    qrN,
        tax_rate:        taxRateN,
        notes:           notes.trim() || null,
      }).select().single()
      if (invErr) throw invErr

      if (lines.length) {
        await supabase.from('invoice_lines').insert(
          lines.map((l, i) => ({
            invoice_id:  inv.id,
            description: l.description || '',
            quantity:    Number(l.quantity) || 1,
            unit_price:  Number(l.unit_price) || 0,
            line_type:   l.line_type || 'labour',
            part_id:     l.part_id || null,
            sort_order:  i,
          }))
        )
      }

      // Marque le devis comme converti
      if (quoteId) {
        await supabase.from('quotes').update({ status: 'converted', converted_at: new Date().toISOString() })
          .eq('id', quoteId)
      }

      router.replace(`/admin/factures/${inv.id}`)
    } catch (err) {
      showFlash('error', err.message)
      setSaving(false)
    }
  }, [shopId, clientId, quoteId, issueDate, dueDate, taxRateN, discountN, qrN, notes, lines])

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-4xl">
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${flash.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {flash.msg}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/factures" className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            Nouvelle facture
            {quoteId && <span className="text-xs text-gray-500 font-normal ml-1">depuis devis</span>}
          </h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white
                     bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Création…' : 'Créer la facture'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Client & dates */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" /> Client & dates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <Field label="Client">
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className={INPUT_CLS}>
                    <option value="">— Sans client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Date d'émission">
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label="Date d'échéance">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>
            {clientId && (() => {
              const cl = clients.find(c => c.id === clientId)
              if (!cl) return null
              return (
                <div className="flex gap-4 bg-white/3 rounded-lg px-4 py-2.5 text-sm text-gray-400">
                  <span>{cl.phone || '—'}</span><span>·</span><span>{cl.email || '—'}</span>
                </div>
              )
            })()}
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
            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold
                         text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Création…' : 'Créer la facture'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

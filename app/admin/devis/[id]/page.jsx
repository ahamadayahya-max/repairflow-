'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import LineItemsEditor from '@/components/admin/LineItemsEditor'
import {
  ArrowLeft, Save, Download, Send, Loader2, CheckCircle2,
  FileText, User, StickyNote,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS = {
  draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté',
  refused: 'Refusé', expired: 'Expiré', converted: 'Converti',
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
// Page édition devis
// ---------------------------------------------------------------------------

export default function QuoteDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [shopId,  setShopId]  = useState(null)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [flash,   setFlash]   = useState(null)
  const [quote,   setQuote]   = useState(null)

  const [clientId,   setClientId]   = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [taxRate,    setTaxRate]    = useState('20')
  const [discount,   setDiscount]   = useState('0')
  const [notes,      setNotes]      = useState('')
  const [lines,      setLines]      = useState([])

  // ---------------------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)

      const [{ data: cls }, { data: q }, { data: qLines }] = await Promise.all([
        supabase.from('clients').select('id, full_name, phone, email').eq('shop_id', shop.id).order('full_name'),
        supabase.from('quotes').select('*').eq('id', id).single(),
        supabase.from('quote_lines').select('*').eq('quote_id', id).order('sort_order'),
      ])

      setClients(cls || [])
      if (q) {
        setQuote(q)
        setClientId(q.client_id || '')
        setValidUntil(q.valid_until || '')
        setTaxRate(String(q.tax_rate || '20'))
        setDiscount(String(q.discount_amount || '0'))
        setNotes(q.notes || '')
      }
      setLines((qLines || []).map(l => ({ ...l, _key: l.id })))
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

  // ---------------------------------------------------------------------------
  // Flash
  // ---------------------------------------------------------------------------

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
        valid_until:     validUntil || null,
        labour_cost:     labourCost,
        parts_cost:      partsCost,
        discount_amount: discountN,
        tax_rate:        taxRateN,
        notes:           notes.trim() || null,
      }
      if (statusOverride) payload.status = statusOverride

      const { error: qErr } = await supabase.from('quotes').update(payload).eq('id', id)
      if (qErr) throw qErr

      await supabase.from('quote_lines').delete().eq('quote_id', id)
      if (lines.length) {
        const { error: lErr } = await supabase.from('quote_lines').insert(
          lines.map((l, i) => ({
            quote_id:    id,
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

      setQuote(q => ({ ...q, ...payload }))
      showFlash('success', 'Devis enregistré')
    } catch (err) {
      showFlash('error', err.message)
    } finally {
      setSaving(false)
    }
  }, [shopId, clientId, validUntil, taxRateN, discountN, notes, lines, id])

  // ---------------------------------------------------------------------------
  // Télécharger PDF
  // ---------------------------------------------------------------------------

  async function handleDownloadPDF() {
    try {
      const clientData = clients.find(c => c.id === clientId) || {}
      const { data: shopData } = await supabase
        .from('shops').select('name, address, phone, email').eq('id', shopId).single()

      const [{ default: QuotePDF }, { pdf }, { createElement }] = await Promise.all([
        import('@/components/admin/pdf/QuotePDF'),
        import('@react-pdf/renderer'),
        import('react'),
      ])
      const blob = await pdf(createElement(QuotePDF, {
        quote: { ...quote, discount_amount: discountN, tax_rate: taxRateN, notes, valid_until: validUntil },
        lines, shop: shopData || {}, client: clientData,
      })).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `devis-${quote?.quote_number}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showFlash('error', 'Erreur PDF : ' + err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // Convertir en ticket
  // ---------------------------------------------------------------------------

  async function handleConvert() {
    if (!quote || quote.status !== 'accepted') return
    if (!window.confirm('Créer un ticket de réparation depuis ce devis ?')) return
    try {
      const { data: ticket, error: tErr } = await supabase.from('tickets').insert({
        shop_id:     shopId,
        client_id:   quote.client_id || null,
        issue_desc:  quote.notes || `Devis ${quote.quote_number}`,
        status:      'pending',
        device_type: 'Autre',
        received_at: new Date().toISOString(),
      }).select().single()
      if (tErr) throw tErr

      await supabase.from('quotes').update({
        status: 'converted', converted_at: new Date().toISOString(), ticket_id: ticket.id,
      }).eq('id', id)

      router.push(`/admin/tickets/${ticket.id}`)
    } catch (err) {
      showFlash('error', err.message)
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

  if (!quote) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-gray-500">Devis introuvable</p>
      <Link href="/admin/devis" className="mt-3 text-amber-400 text-sm hover:text-amber-300">
        ← Retour aux devis
      </Link>
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
          <Link href="/admin/devis" className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              {quote.quote_number}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block
              ${quote.status === 'accepted' ? 'bg-green-400/10 text-green-400' :
                quote.status === 'sent'     ? 'bg-blue-400/10 text-blue-400'  : 'bg-gray-400/10 text-gray-400'}`}>
              {STATUS_LABELS[quote.status] || quote.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white
                       bg-white/5 border border-white/10 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
          {quote.status === 'accepted' && (
            <button onClick={handleConvert}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-400
                         bg-amber-400/10 border border-amber-400/20 rounded-xl hover:bg-amber-400/20 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Convertir en ticket
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Client & dates */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" /> Client & dates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Client">
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={INPUT_CLS}>
                  <option value="">— Sans client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </Field>
              <Field label="Valable jusqu'au">
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={INPUT_CLS} />
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
              <StickyNote className="w-4 h-4 text-amber-400" /> Notes client
            </h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Notes visibles sur le devis…" className={INPUT_CLS + ' resize-none'} />
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
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-xs text-amber-400/70 mb-1">Total TTC</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{eur(totalTTC)}</p>
            </div>
            <button onClick={() => handleSave()} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold
                         text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {quote.status === 'draft' && (
              <button onClick={() => handleSave('sent')} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium
                           text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/20 rounded-xl transition-colors">
                <Send className="w-4 h-4" /> Marquer envoyé
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

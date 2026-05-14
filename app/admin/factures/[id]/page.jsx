'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Receipt, Loader2, Download, Send, CheckCircle2,
  XCircle, Trash2, Plus, Save, Clock,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CFG = {
  draft:     { label: 'Brouillon', color: 'text-gray-400',  bg: 'bg-gray-400/10'  },
  sent:      { label: 'Envoyée',   color: 'text-blue-400',  bg: 'bg-blue-400/10'  },
  paid:      { label: 'Payée',     color: 'text-green-400', bg: 'bg-green-400/10' },
  cancelled: { label: 'Annulée',   color: 'text-red-400',   bg: 'bg-red-400/10'   },
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

const INPUT = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
               placeholder-gray-600 focus:outline-none focus:border-amber-500/50`

// ---------------------------------------------------------------------------
// Page détail facture
// ---------------------------------------------------------------------------
/**
 * Détail d'une facture : visualisation, édition des lignes, PDF, envoi email, paiement.
 */
export default function FactureDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [invoice,  setInvoice]  = useState(null)
  const [lines,    setLines]    = useState([])
  const [shop,     setShop]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [sending,  setSending]  = useState(false)
  const [flash,    setFlash]    = useState(null)

  // Champs éditables
  const [clientName,    setClientName]    = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [notes,         setNotes]         = useState('')
  const [dueAt,         setDueAt]         = useState('')
  const [tvaRate,       setTvaRate]       = useState(20)
  const [qrBonus,       setQrBonus]       = useState(0)

  useEffect(() => { loadAll() }, [id])

  const loadAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: inv }, { data: invLines }, { data: shopData }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('created_at'),
      supabase.from('shops').select('name, phone, address').eq('owner_id', user.id).single(),
    ])

    if (inv) {
      setInvoice(inv)
      setClientName(inv.client_name || '')
      setClientEmail(inv.client_email || '')
      setClientPhone(inv.client_phone || '')
      setClientAddress(inv.client_address || '')
      setNotes(inv.notes || '')
      setDueAt(inv.due_at ? inv.due_at.split('T')[0] : '')
      setTvaRate(parseFloat(inv.tva_rate || 20))
      setQrBonus(parseFloat(inv.qualirepar_bonus || 0))
    }
    setLines((invLines || []).map(l => ({ ...l })))
    setShop(shopData)
    setLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Calculs en temps réel
  // ---------------------------------------------------------------------------
  const subtotalHT = lines.reduce((s, l) =>
    s + parseFloat(l.unit_price_ht || 0) * parseInt(l.qty || 1), 0)
  const tvaAmount  = parseFloat((subtotalHT * tvaRate / 100).toFixed(2))
  const totalTTC   = parseFloat((subtotalHT + tvaAmount).toFixed(2))
  const totalNet   = parseFloat((totalTTC - qrBonus).toFixed(2))

  // ---------------------------------------------------------------------------
  // Gestion des lignes
  // ---------------------------------------------------------------------------
  const addLine = () =>
    setLines(l => [...l, { _new: true, description: '', qty: 1, unit_price_ht: 0, tva_rate: tvaRate }])

  const removeLine = idx => setLines(l => l.filter((_, i) => i !== idx))

  const updateLine = (idx, field, val) =>
    setLines(l => l.map((line, i) => i === idx ? { ...line, [field]: val } : line))

  // ---------------------------------------------------------------------------
  // Flash
  // ---------------------------------------------------------------------------
  function flash_(type, msg) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Sauvegarde
  // ---------------------------------------------------------------------------
  const handleSave = async (statusOverride) => {
    setSaving(true)
    try {
      const updates = {
        client_name:      clientName,
        client_email:     clientEmail || null,
        client_phone:     clientPhone || null,
        client_address:   clientAddress || null,
        notes:            notes || null,
        due_at:           dueAt ? new Date(dueAt).toISOString() : null,
        tva_rate:         tvaRate,
        tva_amount:       tvaAmount,
        subtotal_ht:      parseFloat(subtotalHT.toFixed(2)),
        total_ttc:        totalTTC,
        qualirepar_bonus: qrBonus,
        total_net:        totalNet,
        updated_at:       new Date().toISOString(),
      }
      if (statusOverride) updates.status = statusOverride

      const { error: invErr } = await supabase
        .from('invoices').update(updates).eq('id', id)
      if (invErr) throw invErr

      // Recréer les lignes
      await supabase.from('invoice_lines').delete().eq('invoice_id', id)
      const linesData = lines
        .filter(l => l.description?.trim())
        .map(l => ({
          invoice_id:    id,
          description:   l.description,
          qty:           parseInt(l.qty) || 1,
          unit_price_ht: parseFloat(l.unit_price_ht) || 0,
          tva_rate:      parseFloat(l.tva_rate) || tvaRate,
        }))
      if (linesData.length) {
        const { error: lErr } = await supabase.from('invoice_lines').insert(linesData)
        if (lErr) throw lErr
      }

      await loadAll()
      flash_('success', statusOverride ? `Statut → ${STATUS_CFG[statusOverride]?.label}` : 'Sauvegardé ✓')
    } catch (err) {
      flash_('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Télécharger PDF
  // ---------------------------------------------------------------------------
  const handleDownloadPDF = async () => {
    // Sauvegarde d'abord pour que le PDF soit à jour
    await handleSave()
    window.open(`/api/invoices/${id}/pdf`, '_blank')
  }

  // ---------------------------------------------------------------------------
  // Envoyer par email
  // ---------------------------------------------------------------------------
  const handleSendEmail = async () => {
    if (!clientEmail) { flash_('error', 'Aucun email client renseigné'); return }
    setSending(true)
    try {
      await handleSave('sent')
      const res  = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      flash_('success', `Email envoyé à ${clientEmail} ✓`)
    } catch (err) {
      flash_('error', err.message)
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Marquer payée / annulée
  // ---------------------------------------------------------------------------
  const handleMarkPaid = () => handleSave('paid').then(() => {
    supabase.from('invoices').update({ paid_at: new Date().toISOString() }).eq('id', id)
  })

  const handleCancel = () => {
    if (!confirm(`Annuler la facture ${invoice?.invoice_number} ?`)) return
    handleSave('cancelled')
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-sm">Facture introuvable</p>
        <Link href="/admin/factures" className="mt-3 text-amber-400 text-sm hover:text-amber-300">
          ← Retour aux factures
        </Link>
      </div>
    )
  }

  const cfg = STATUS_CFG[invoice.status] ?? STATUS_CFG.draft

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Flash */}
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl
          ${flash.type === 'success'
            ? 'bg-green-500/20 border border-green-500/30 text-green-300'
            : 'bg-red-500/20 border border-red-500/30 text-red-300'}`}>
          {flash.msg}
        </div>
      )}

      {/* Lien retour */}
      <Link href="/admin/factures"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Factures
      </Link>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            {invoice.invoice_number}
          </h1>
          <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-lg text-xs
                            font-semibold ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadPDF} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10
                       border border-white/10 text-gray-300 text-sm rounded-lg transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button onClick={handleSendEmail} disabled={sending || saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25
                         border border-blue-500/20 text-blue-400 text-sm rounded-lg transition-colors
                         disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Envoi…' : 'Envoyer email'}
            </button>
          )}

          {invoice.status === 'sent' && (
            <button onClick={handleMarkPaid} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-500/15 hover:bg-green-500/25
                         border border-green-500/20 text-green-400 text-sm rounded-lg transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Marquer payée
            </button>
          )}

          {invoice.status === 'draft' && (
            <button onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20
                         border border-red-500/20 text-red-400 text-sm rounded-lg transition-colors">
              <XCircle className="w-4 h-4" /> Annuler
            </button>
          )}

          <button onClick={() => handleSave()} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Colonne gauche : infos + lignes + notes */}
        <div className="lg:col-span-2 space-y-5">

          {/* Infos client */}
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Informations client</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                  className={INPUT} placeholder="Nom du client" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  className={INPUT} placeholder="client@email.fr" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  className={INPUT} placeholder="+33 6 00 00 00 00" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Adresse</label>
                <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                  className={INPUT} placeholder="Adresse du client" />
              </div>
            </div>
          </div>

          {/* Lignes de facture */}
          <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Prestations & pièces</h2>
              <button onClick={addLine}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-600 text-center">
                Aucune ligne — cliquez sur «&nbsp;Ajouter une ligne&nbsp;»
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Désignation','Qté','P.U. HT (€)','TVA %','Total HT',''].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-bold text-gray-600
                                               uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lines.map((line, idx) => {
                      const lineTotal = parseFloat(line.unit_price_ht || 0) * parseInt(line.qty || 1)
                      return (
                        <tr key={line.id || idx}>
                          <td className="px-4 py-2">
                            <input type="text" value={line.description}
                              onChange={e => updateLine(idx, 'description', e.target.value)}
                              placeholder="Description"
                              className="w-full bg-transparent text-gray-200 text-sm focus:outline-none
                                         border-b border-transparent focus:border-white/20" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="1" value={line.qty}
                              onChange={e => updateLine(idx, 'qty', e.target.value)}
                              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1
                                         text-white text-xs text-center focus:outline-none" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" step="0.01" value={line.unit_price_ht}
                              onChange={e => updateLine(idx, 'unit_price_ht', e.target.value)}
                              className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1
                                         text-white text-xs focus:outline-none" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" max="100" value={line.tva_rate}
                              onChange={e => updateLine(idx, 'tva_rate', e.target.value)}
                              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1
                                         text-white text-xs text-center focus:outline-none" />
                          </td>
                          <td className="px-4 py-2 text-gray-300 font-semibold text-xs whitespace-nowrap">
                            {lineTotal > 0 ? `${lineTotal.toFixed(2)} €` : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => removeLine(idx)}
                              className="text-gray-700 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5">
            <label className="block text-xs text-gray-500 mb-2">Notes (visibles sur la facture)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className={INPUT + ' resize-none'}
              placeholder="Conditions de paiement, garantie, remarques…" />
          </div>
        </div>

        {/* Colonne droite : récap + totaux */}
        <div className="space-y-4">
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4 sticky top-4">
            <h2 className="text-sm font-semibold text-white">Récapitulatif</h2>

            {/* Dates */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date d'émission</label>
              <p className="text-sm text-gray-300">
                {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Échéance</label>
              <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
                className={INPUT} />
            </div>

            {/* TVA */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Taux TVA (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={tvaRate}
                onChange={e => setTvaRate(parseFloat(e.target.value))}
                className={INPUT} />
            </div>

            {/* Bonus QualiRépar */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                🔁 Bonus QualiRépar (€)
                <span className="text-gray-700 font-normal ml-1">(déduit du total)</span>
              </label>
              <input type="number" min="0" step="0.01" value={qrBonus}
                onChange={e => setQrBonus(parseFloat(e.target.value) || 0)}
                className={INPUT} />
            </div>

            {/* Totaux */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Sous-total HT</span>
                <span className="tabular-nums">{eur(subtotalHT)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>TVA ({tvaRate}%)</span>
                <span className="tabular-nums">{eur(tvaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-300 border-t border-white/10 pt-2">
                <span>Total TTC</span>
                <span className="tabular-nums font-semibold">{eur(totalTTC)}</span>
              </div>
              {qrBonus > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Bonus QualiRépar</span>
                  <span className="tabular-nums">−{eur(qrBonus)}</span>
                </div>
              )}
            </div>

            {/* Net à payer */}
            <div className="rounded-xl p-4 text-center bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400/70 mb-1">Net à payer</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{eur(totalNet)}</p>
            </div>

            {/* Boutons actions */}
            <button onClick={() => handleSave()} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500
                         hover:bg-amber-400 text-white text-sm font-semibold rounded-lg
                         transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            {invoice.status === 'draft' && (
              <button onClick={() => handleSave('sent')} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/15
                           hover:bg-blue-500/25 border border-blue-500/20 text-blue-400 text-sm
                           font-medium rounded-lg transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" /> Marquer envoyée
              </button>
            )}

            {invoice.status === 'sent' && (
              <button onClick={handleMarkPaid} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500/15
                           hover:bg-green-500/25 border border-green-500/20 text-green-400 text-sm
                           font-medium rounded-lg transition-colors disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Marquer payée
              </button>
            )}

            {invoice.status === 'paid' && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-400
                              bg-green-400/10 rounded-lg py-2.5 border border-green-400/20">
                <CheckCircle2 className="w-4 h-4" />
                Payée le {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('fr-FR') : '—'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

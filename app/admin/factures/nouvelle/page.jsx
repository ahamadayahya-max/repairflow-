'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Save, Loader2, Receipt, User, FileText,
  Plus, Trash2, ChevronDown,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function emptyLine() {
  return { id: crypto.randomUUID(), description: '', qty: 1, unit_price_ht: '' }
}

const INPUT = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
              placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

// ---------------------------------------------------------------------------
// Page création facture (version pleine page avec pré-remplissage ticket)
// ---------------------------------------------------------------------------
/**
 * Page de création d'une nouvelle facture.
 * Accepte ?ticket=<id> pour pré-remplir les infos client et l'appareil.
 * @returns {JSX.Element}
 */
export default function NewInvoicePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const ticketParam  = searchParams.get('ticket')
  const supabase     = getSupabaseClient()

  const [shopId,  setShopId]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  // — Infos client
  const [clientName,    setClientName]    = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientAddress, setClientAddress] = useState('')

  // — Paramètres facture
  const [tvaRate, setTvaRate] = useState(20)
  const [qrBonus, setQrBonus] = useState(0)
  const [notes,   setNotes]   = useState('')
  const [dueAt,   setDueAt]   = useState('')

  // — Lignes
  const [lines, setLines] = useState([emptyLine()])

  // — Ticket source (pour rattachement)
  const [linkedTicketId, setLinkedTicketId] = useState(null)

  // ---------------------------------------------------------------------------
  // Calculs temps réel
  // ---------------------------------------------------------------------------
  const subtotalHT = lines.reduce((s, l) =>
    s + parseFloat(l.unit_price_ht || 0) * parseInt(l.qty || 1), 0)
  const tvaAmount  = subtotalHT * tvaRate / 100
  const totalTTC   = subtotalHT + tvaAmount
  const totalNet   = totalTTC - parseFloat(qrBonus || 0)

  // ---------------------------------------------------------------------------
  // Initialisation — pré-remplissage depuis ticket si param présent
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)

      // Pré-remplissage depuis un ticket
      if (ticketParam) {
        const { data: ticket } = await supabase
          .from('tickets')
          .select(`
            id, device_type, device_brand, device_model,
            price_estimate, price_final,
            clients(full_name, phone, email)
          `)
          .eq('id', ticketParam)
          .single()

        if (ticket) {
          setLinkedTicketId(ticket.id)
          if (ticket.clients) {
            setClientName(ticket.clients.full_name || '')
            setClientPhone(ticket.clients.phone    || '')
            setClientEmail(ticket.clients.email    || '')
          }
          const device = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ')
          const price  = parseFloat(ticket.price_final || ticket.price_estimate || 0)
          setLines([{
            id:            crypto.randomUUID(),
            description:   `Réparation ${device || ticket.device_type || ''}`.trim(),
            qty:           1,
            unit_price_ht: price > 0 ? price.toFixed(2) : '',
          }])
        }
      }

      setLoading(false)
    }
    init()
  }, [ticketParam])

  // ---------------------------------------------------------------------------
  // Lignes
  // ---------------------------------------------------------------------------
  const updateLine = (id, field, value) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))

  const removeLine = (id) => {
    if (lines.length === 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Soumission
  // ---------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    setError(null)
    if (!clientName.trim()) { setError('Le nom du client est requis.'); return }
    if (lines.some(l => !l.description.trim())) { setError('Toutes les lignes doivent avoir une description.'); return }
    if (lines.some(l => isNaN(parseFloat(l.unit_price_ht)))) { setError('Toutes les lignes doivent avoir un prix valide.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/invoices/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          shop_id:          shopId,
          ticket_id:        linkedTicketId || null,
          client_name:      clientName.trim(),
          client_email:     clientEmail.trim() || null,
          client_phone:     clientPhone.trim() || null,
          client_address:   clientAddress.trim() || null,
          lines:            lines.map(l => ({
            description:    l.description.trim(),
            qty:            parseInt(l.qty || 1),
            unit_price_ht:  parseFloat(l.unit_price_ht || 0),
          })),
          tva_rate:         parseFloat(tvaRate),
          qualirepar_bonus: parseFloat(qrBonus || 0),
          notes:            notes.trim() || null,
          due_at:           dueAt || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur lors de la création')
      router.replace(`/admin/factures/${json.invoice_id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }, [shopId, linkedTicketId, clientName, clientEmail, clientPhone, clientAddress, lines, tvaRate, qrBonus, notes, dueAt])

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

  return (
    <div className="space-y-5 max-w-4xl">

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/factures"
            className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-white font-bold text-lg flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            Nouvelle facture
            {linkedTicketId && (
              <span className="text-xs text-amber-400/60 font-normal ml-1">depuis ticket</span>
            )}
          </h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
                     bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Création…' : 'Créer la facture'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Colonne gauche ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Client */}
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" /> Client
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Nom <span className="text-red-400">*</span>
                </label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Jean Dupont" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Email</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  placeholder="jean@example.com" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Téléphone</label>
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  placeholder="+33 6 00 00 00 00" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Adresse</label>
                <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                  placeholder="1 rue de la Paix, Paris" className={INPUT} />
              </div>
            </div>
          </div>

          {/* Lignes de facturation */}
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" /> Lignes de facturation
              </h2>
              <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
            </div>

            {/* En-têtes */}
            <div className="grid grid-cols-[1fr_64px_110px_36px] gap-2 px-1">
              <span className="text-[10px] text-gray-600 uppercase">Description</span>
              <span className="text-[10px] text-gray-600 uppercase text-center">Qté</span>
              <span className="text-[10px] text-gray-600 uppercase text-right">Prix HT</span>
              <span />
            </div>

            <div className="space-y-2">
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-[1fr_64px_110px_36px] gap-2 items-center">
                  <input type="text" value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Description de la prestation…"
                    className={INPUT} />
                  <input type="number" min="1" step="1" value={line.qty}
                    onChange={e => updateLine(line.id, 'qty', e.target.value)}
                    className="px-2 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white
                               text-sm text-center focus:outline-none focus:border-amber-500/50" />
                  <div className="relative">
                    <input type="number" min="0" step="0.01" value={line.unit_price_ht}
                      onChange={e => updateLine(line.id, 'unit_price_ht', e.target.value)}
                      placeholder="0.00"
                      className="w-full pr-6 pl-3 py-2.5 bg-white/5 border border-white/10 rounded-lg
                                 text-white text-sm text-right focus:outline-none focus:border-amber-500/50" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs">€</span>
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)}
                    disabled={lines.length === 1}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600
                               hover:text-red-400 hover:bg-red-400/10 disabled:opacity-20
                               disabled:cursor-not-allowed transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Notes internes</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Remarques, conditions de paiement…"
              className={INPUT + ' resize-none'} />
          </div>
        </div>

        {/* ── Colonne droite — Totaux ── */}
        <div>
          <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4 sticky top-4">
            <h2 className="text-sm font-semibold text-white">Paramètres</h2>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">TVA (%)</label>
              <div className="relative">
                <select value={tvaRate} onChange={e => setTvaRate(Number(e.target.value))}
                  className={INPUT + ' appearance-none pr-8'}>
                  <option value={0}>0 %</option>
                  <option value={5.5}>5,5 %</option>
                  <option value={10}>10 %</option>
                  <option value={20}>20 %</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Bonus QualiRépar (€)</label>
              <input type="number" min="0" step="0.01" value={qrBonus}
                onChange={e => setQrBonus(e.target.value)} className={INPUT} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Échéance</label>
              <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
                className={INPUT + ' [color-scheme:dark]'} />
            </div>

            {/* Totaux */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Sous-total HT</span>
                <span className="tabular-nums">{eur(subtotalHT)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>TVA ({tvaRate} %)</span>
                <span className="tabular-nums">{eur(tvaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-300 border-t border-white/10 pt-2">
                <span>Total TTC</span>
                <span className="tabular-nums">{eur(totalTTC)}</span>
              </div>
              {parseFloat(qrBonus || 0) > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Bonus QualiRépar</span>
                  <span className="tabular-nums">− {eur(qrBonus)}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 text-center bg-amber-500/10 border border-amber-500/25">
              <p className="text-xs text-amber-400/70 mb-1">Net à payer</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{eur(totalNet)}</p>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold
                         text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Création…' : 'Créer la facture'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

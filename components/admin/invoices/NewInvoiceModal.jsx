'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  X, Plus, Trash2, Loader2, Receipt, User, FileText,
  ChevronDown, Search,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function emptyLine() {
  return { description: '', qty: 1, unit_price_ht: '' }
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
/**
 * Modal de création rapide d'une facture.
 * @param {{ shopId: string, ticketId?: string, onClose: () => void, onCreated: () => void }} props
 */
export default function NewInvoiceModal({ shopId, ticketId, onClose, onCreated }) {
  const supabase = getSupabaseClient()

  // — Infos client
  const [clientName,    setClientName]    = useState('')
  const [clientEmail,   setClientEmail]   = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientAddress, setClientAddress] = useState('')

  // — Paramètres facture
  const [tvaRate,    setTvaRate]    = useState(20)
  const [qrBonus,    setQrBonus]    = useState(0)
  const [notes,      setNotes]      = useState('')
  const [dueAt,      setDueAt]      = useState('')

  // — Lignes
  const [lines, setLines] = useState([emptyLine()])

  // — Recherche ticket optionnelle
  const [ticketSearch,   setTicketSearch]   = useState('')
  const [tickets,        setTickets]        = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showTickets,    setShowTickets]    = useState(false)

  // — État
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  // ---------------------------------------------------------------------------
  // Calculs temps réel
  // ---------------------------------------------------------------------------
  const subtotalHT = lines.reduce((s, l) =>
    s + parseFloat(l.unit_price_ht || 0) * parseInt(l.qty || 1), 0)
  const tvaAmount  = subtotalHT * tvaRate / 100
  const totalTTC   = subtotalHT + tvaAmount
  const totalNet   = totalTTC - parseFloat(qrBonus || 0)

  // ---------------------------------------------------------------------------
  // Recherche de tickets rattachables
  // ---------------------------------------------------------------------------
  const searchTickets = useCallback(async (q) => {
    if (!q || q.length < 2) { setTickets([]); return }
    const { data } = await supabase
      .from('tickets')
      .select('id, tracking_token, device_type, device_brand, device_model, clients(full_name, phone, email)')
      .eq('shop_id', shopId)
      .or(`tracking_token.ilike.%${q}%,device_brand.ilike.%${q}%,device_model.ilike.%${q}%`)
      .limit(6)
    setTickets(data ?? [])
  }, [shopId, supabase])

  useEffect(() => {
    const t = setTimeout(() => searchTickets(ticketSearch), 300)
    return () => clearTimeout(t)
  }, [ticketSearch, searchTickets])

  // Pré-remplir depuis ticket sélectionné
  const pickTicket = (t) => {
    setSelectedTicket(t)
    setShowTickets(false)
    setTicketSearch(t.tracking_token)
    if (t.clients) {
      setClientName(t.clients.full_name || '')
      setClientPhone(t.clients.phone    || '')
      setClientEmail(t.clients.email    || '')
    }
    // Ajouter une ligne pré-remplie avec l'appareil
    setLines([{
      description: `Réparation ${t.device_brand || ''} ${t.device_model || ''}`.trim(),
      qty: 1,
      unit_price_ht: '',
    }])
  }

  // ---------------------------------------------------------------------------
  // Gestion des lignes
  // ---------------------------------------------------------------------------
  const updateLine = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])

  const removeLine = (idx) => {
    if (lines.length === 1) return
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  // ---------------------------------------------------------------------------
  // Soumission
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!clientName.trim()) { setError('Le nom du client est requis.'); return }
    if (lines.some(l => !l.description.trim())) { setError('Toutes les lignes doivent avoir une description.'); return }
    if (lines.some(l => !l.unit_price_ht || isNaN(parseFloat(l.unit_price_ht)))) {
      setError('Toutes les lignes doivent avoir un prix valide.'); return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id:         shopId,
          ticket_id:       selectedTicket?.id || ticketId || null,
          client_name:     clientName.trim(),
          client_email:    clientEmail.trim() || null,
          client_phone:    clientPhone.trim() || null,
          client_address:  clientAddress.trim() || null,
          lines:           lines.map(l => ({
            description:   l.description.trim(),
            qty:           parseInt(l.qty || 1),
            unit_price_ht: parseFloat(l.unit_price_ht || 0),
          })),
          tva_rate:         parseFloat(tvaRate),
          qualirepar_bonus: parseFloat(qrBonus || 0),
          notes:            notes.trim() || null,
          due_at:           dueAt || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur lors de la création')

      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto
                      bg-[#111118] border border-white/10 rounded-2xl shadow-2xl">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#111118] z-10">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h2 className="text-white font-bold text-lg">Nouvelle facture</h2>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ----------------------------------------------------------------
              Rattacher à un ticket (optionnel)
          ---------------------------------------------------------------- */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Rattacher à un ticket <span className="text-gray-600 normal-case font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                value={ticketSearch}
                onChange={e => { setTicketSearch(e.target.value); setShowTickets(true) }}
                onFocus={() => setShowTickets(true)}
                placeholder="Numéro de suivi, marque, modèle…"
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
              {showTickets && tickets.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/10
                                rounded-lg overflow-hidden z-20 shadow-xl">
                  {tickets.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => pickTicket(t)}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                      <p className="text-amber-400 text-xs font-mono">{t.tracking_token}</p>
                      <p className="text-white text-sm">{[t.device_brand, t.device_model].filter(Boolean).join(' ')}</p>
                      {t.clients && <p className="text-gray-500 text-xs">{t.clients.full_name}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------------
              Informations client
          ---------------------------------------------------------------- */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-gray-500 mb-1">Nom <span className="text-red-400">*</span></label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Jean Dupont" required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                             text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                  placeholder="jean@example.com"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                             text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                             text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Adresse</label>
                <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                  placeholder="1 rue de la Paix, Paris"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                             text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------
              Lignes de facturation
          ---------------------------------------------------------------- */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lignes</span>
              </div>
              <button type="button" onClick={addLine}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>

            {/* En-tête colonnes */}
            <div className="grid grid-cols-[1fr_60px_100px_32px] gap-2 mb-1 px-1">
              <span className="text-[10px] text-gray-600 uppercase">Description</span>
              <span className="text-[10px] text-gray-600 uppercase text-center">Qté</span>
              <span className="text-[10px] text-gray-600 uppercase text-right">Prix HT</span>
              <span />
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_60px_100px_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={line.description}
                    onChange={e => updateLine(idx, 'description', e.target.value)}
                    placeholder="Description de la prestation…"
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                               text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
                  <input
                    type="number" min="1" step="1"
                    value={line.qty}
                    onChange={e => updateLine(idx, 'qty', e.target.value)}
                    className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg
                               text-white text-sm text-center focus:outline-none focus:border-amber-500/50" />
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      value={line.unit_price_ht}
                      onChange={e => updateLine(idx, 'unit_price_ht', e.target.value)}
                      placeholder="0.00"
                      className="w-full pr-6 pl-3 py-2 bg-white/5 border border-white/10 rounded-lg
                                 text-white text-sm text-right focus:outline-none focus:border-amber-500/50" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs">€</span>
                  </div>
                  <button type="button" onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg
                               text-gray-600 hover:text-red-400 hover:bg-red-400/10
                               disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ----------------------------------------------------------------
              Paramètres fiscaux + dates
          ---------------------------------------------------------------- */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">TVA (%)</label>
              <div className="relative">
                <select value={tvaRate} onChange={e => setTvaRate(Number(e.target.value))}
                  className="w-full appearance-none px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                             text-white text-sm focus:outline-none focus:border-amber-500/50">
                  <option value={0}>0 %</option>
                  <option value={5.5}>5,5 %</option>
                  <option value={10}>10 %</option>
                  <option value={20}>20 %</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bonus QualiRépar (€)</label>
              <input type="number" min="0" step="0.01" value={qrBonus}
                onChange={e => setQrBonus(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Échéance</label>
              <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white text-sm focus:outline-none focus:border-amber-500/50
                           [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes internes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Remarque…"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>

          {/* ----------------------------------------------------------------
              Récapitulatif des totaux
          ---------------------------------------------------------------- */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Sous-total HT</span>
              <span className="text-white tabular-nums">{eur(subtotalHT)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">TVA ({tvaRate} %)</span>
              <span className="text-white tabular-nums">{eur(tvaAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total TTC</span>
              <span className="text-white tabular-nums">{eur(totalTTC)}</span>
            </div>
            {parseFloat(qrBonus || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-400">Bonus QualiRépar</span>
                <span className="text-green-400 tabular-nums">− {eur(qrBonus)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-white/10">
              <span className="text-white font-bold">Net à payer</span>
              <span className="text-amber-400 font-bold text-lg tabular-nums">{eur(totalNet)}</span>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg
                            text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold rounded-lg transition-colors">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</>
                : <><Receipt className="w-4 h-4" /> Créer la facture</>
              }
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

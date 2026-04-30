'use client'

import { useState } from 'react'
import { X, CreditCard } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Modes de paiement
// ---------------------------------------------------------------------------

const METHODS = [
  { value: 'cash',     label: 'Espèces'   },
  { value: 'card',     label: 'Carte'     },
  { value: 'transfer', label: 'Virement'  },
  { value: 'check',    label: 'Chèque'    },
  { value: 'other',    label: 'Autre'     },
]

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Modale d'enregistrement d'un paiement sur une facture.
 * @param {{
 *   invoice: object,
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSuccess: () => void,
 * }} props
 */
export default function PaymentModal({ invoice, isOpen, onClose, onSuccess }) {
  const supabase  = getSupabaseClient()
  const remaining = Math.max(
    0,
    Number(invoice?.total_net ?? invoice?.total_ttc ?? 0) - Number(invoice?.amount_paid ?? 0)
  )

  const [amount,    setAmount]    = useState(remaining.toFixed(2))
  const [method,    setMethod]    = useState('card')
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  if (!isOpen || !invoice) return null

  // ---------------------------------------------------------------------------
  // Soumission
  // ---------------------------------------------------------------------------

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Montant invalide'); return }
    setSaving(true)
    setError('')
    try {
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id: invoice.id,
        shop_id:    invoice.shop_id,
        amount:     amt,
        method,
        paid_at:    new Date(date).toISOString(),
        reference:  reference.trim() || null,
      })
      if (payErr) throw payErr

      const newPaid  = Number(invoice.amount_paid || 0) + amt
      const total    = Number(invoice.total_net ?? invoice.total_ttc ?? 0)
      const newStatus = newPaid >= total - 0.01 ? 'paid' : 'partial'

      const { error: invErr } = await supabase.from('invoices').update({
        amount_paid:    newPaid,
        status:         newStatus,
        payment_method: method,
        ...(newStatus === 'paid' ? { payment_date: new Date().toISOString() } : {}),
      }).eq('id', invoice.id)
      if (invErr) throw invErr

      onSuccess()
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#111118] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">

        {/* En-tête */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            Enregistrer un paiement
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20
                          rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Montant */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
              Montant
              <span className="text-gray-600 normal-case ml-1">
                (reste dû : {remaining.toFixed(2).replace('.', ',')} €)
              </span>
            </label>
            <input
              type="number" step="0.01" min="0.01" required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5
                         text-white text-sm focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
              Mode de paiement
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors text-center
                    ${method === m.value
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/8 border border-white/10'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
              Date du paiement
            </label>
            <input
              type="date" required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5
                         text-white text-sm focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          {/* Référence */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
              Référence
              <span className="text-gray-700 normal-case ml-1">(optionnel)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="N° chèque, référence virement…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5
                         text-white text-sm placeholder-gray-600 focus:outline-none
                         focus:border-amber-500/40 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white
                         bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

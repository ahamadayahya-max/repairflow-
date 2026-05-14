'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  ShoppingCart, ArrowLeft, Loader2, Package, CheckCircle2,
  Clock, Send, XCircle, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Config statuts
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  draft:     { label: 'Brouillon',  color: 'text-gray-400',    bg: 'bg-gray-400/10',    icon: Clock        },
  sent:      { label: 'Envoyée',    color: 'text-blue-400',    bg: 'bg-blue-400/10',    icon: Send         },
  confirmed: { label: 'Confirmée', color: 'text-green-400',   bg: 'bg-green-400/10',   icon: CheckCircle2 },
  received:  { label: 'Reçue',     color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle2 },
  partial:   { label: 'Partielle', color: 'text-amber-400',   bg: 'bg-amber-400/10',   icon: AlertTriangle },
  cancelled: { label: 'Annulée',   color: 'text-red-400',     bg: 'bg-red-400/10',     icon: XCircle      },
}

// Transitions de statut autorisées
const NEXT_STATUS = {
  draft:     ['sent', 'cancelled'],
  sent:      ['confirmed', 'cancelled'],
  confirmed: ['received', 'partial', 'cancelled'],
  partial:   ['received', 'cancelled'],
  received:  [],
  cancelled: [],
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Page de détail d'une commande fournisseur.
 */
export default function CommandeDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [order,    setOrder]    = useState(null)
  const [lines,    setLines]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    const { data: o } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!o) { setLoading(false); return }
    setOrder(o)

    const { data: l } = await supabase
      .from('purchase_order_lines')
      .select('*, parts_inventory(part_name, sku, qty_stock)')
      .eq('order_id', id)
      .order('created_at')

    setLines(l ?? [])
    setLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Changement de statut
  // ---------------------------------------------------------------------------
  const changeStatus = async (newStatus) => {
    setUpdating(true)
    setError(null)

    const { error: err } = await supabase
      .from('purchase_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (err) { setError(err.message); setUpdating(false); return }

    // Si réception totale → met à jour le stock
    if (newStatus === 'received') {
      for (const line of lines) {
        if (!line.part_name?.trim() || line.qty_ordered < 1) continue

        if (line.part_id) {
          // Pièce déjà dans le catalogue → incrémente le stock
          const currentStock = line.parts_inventory?.qty_stock ?? 0
          await supabase
            .from('parts_inventory')
            .update({ qty_stock: currentStock + line.qty_ordered })
            .eq('id', line.part_id)
        } else {
          // Pièce inconnue → la crée dans le catalogue et l'ajoute au stock
          const { data: newPart } = await supabase
            .from('parts_inventory')
            .insert({
              shop_id:    order.shop_id,
              part_name:  line.part_name,
              sku:        line.sku ?? null,
              qty_stock:  line.qty_ordered,
              unit_price: line.unit_price ?? null,
              min_stock:  1,
            })
            .select('id')
            .single()

          // Met à jour la ligne de commande avec le part_id créé
          if (newPart?.id) {
            await supabase
              .from('purchase_order_lines')
              .update({ part_id: newPart.id })
              .eq('id', line.id)
          }
        }
      }
    }

    await loadOrder()
    setUpdating(false)
  }

  // Calcul total depuis les lignes
  const total = lines.reduce((s, l) =>
    s + (parseFloat(l.unit_price) || 0) * (parseInt(l.qty_ordered) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Package className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-500">Commande introuvable</p>
        <Link href="/admin/commandes" className="mt-3 text-xs text-amber-400 hover:text-amber-300">
          ← Retour aux commandes
        </Link>
      </div>
    )
  }

  const statusCfg   = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft
  const StatusIcon  = statusCfg.icon
  const nextOptions = NEXT_STATUS[order.status] ?? []

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Lien retour */}
      <Link href="/admin/commandes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white
                   transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Commandes
      </Link>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            {order.order_number}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{order.supplier_name}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold
                          ${statusCfg.bg} ${statusCfg.color}`}>
          <StatusIcon className="w-4 h-4" />
          {statusCfg.label}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Infos commande */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Fournisseur',      value: order.supplier_name },
          { label: 'Email',            value: order.supplier_email ?? '—' },
          { label: 'Date commande',    value: formatDate(order.ordered_at) },
          { label: 'Livraison prévue', value: formatDate(order.expected_at) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#111118] border border-white/10 rounded-xl p-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm font-medium text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Lignes de commande */}
      <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Lignes de commande</h2>
        </div>
        {lines.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-600 text-center">Aucune ligne</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Désignation', 'Réf.', 'Qté commandée', 'Qté reçue', 'P.U.', 'Total'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-600
                                           uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lines.map(line => {
                  const lineTotal = (parseFloat(line.unit_price) || 0) * (line.qty_ordered || 0)
                  return (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-gray-200">{line.part_name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {line.parts_inventory?.sku ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-center">{line.qty_ordered}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold
                          ${(line.qty_received ?? 0) >= line.qty_ordered
                            ? 'text-green-400' : 'text-amber-400'}`}>
                          {line.qty_received ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {line.unit_price != null ? `${parseFloat(line.unit_price).toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-200 font-semibold whitespace-nowrap">
                        {lineTotal > 0 ? `${lineTotal.toFixed(2)} €` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                    Total
                  </td>
                  <td className="px-4 py-3 text-amber-400 font-bold whitespace-nowrap">
                    {total.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-[#111118] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-gray-300 whitespace-pre-line">{order.notes}</p>
        </div>
      )}

      {/* Actions de changement de statut */}
      {nextOptions.length > 0 && (
        <div className="bg-[#111118] border border-white/10 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Avancer le statut</p>
          <div className="flex flex-wrap gap-3">
            {nextOptions.map(s => {
              const cfg = STATUS_CONFIG[s]
              const isReceive = s === 'received'
              return (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={updating}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                    transition-colors disabled:opacity-50
                    ${isReceive
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : s === 'cancelled'
                      ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-white'
                    }`}
                >
                  {updating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : null}
                  {isReceive ? '✅ ' : ''}
                  {cfg.label}
                  {isReceive ? ' — mise à jour du stock' : ''}
                </button>
              )
            })}
          </div>
          {nextOptions.includes('received') && (
            <p className="text-[10px] text-gray-700 mt-2">
              La réception totale ajoutera automatiquement les quantités commandées au stock de chaque pièce.
            </p>
          )}
        </div>
      )}

    </div>
  )
}

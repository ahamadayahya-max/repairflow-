'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Search, RefreshCw, Loader2, Ticket, Plus,
  Smartphone, Laptop, Tablet, Tv, Package, SlidersHorizontal, X
} from 'lucide-react'
import BrandDropdown from '@/components/admin/BrandDropdown'
import ModelDropdown from '@/components/admin/ModelDropdown'

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  pending:   { label: 'En attente',    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  in_repair: { label: 'En réparation', color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
  ready:     { label: 'Prêt',          color: 'text-green-400  bg-green-400/10  border-green-400/20'  },
  delivered: { label: 'Livré',         color: 'text-gray-400   bg-gray-400/10   border-gray-400/20'   },
}

const DEVICE_ICONS = { smartphone: Smartphone, tablet: Tablet, laptop: Laptop, tv: Tv }

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function DeviceIcon({ type }) {
  const Icon = DEVICE_ICONS[type] ?? Package
  return <Icon className="w-4 h-4 text-gray-400" />
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Page liste des tickets
// ---------------------------------------------------------------------------

export default function TicketsPage() {
  const supabase     = getSupabaseClient()
  const searchParams = useSearchParams()
  const clientFilter = searchParams.get('client') // filtre par client_id depuis /clients

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState('all')
  const [brandFilter,  setBrandFilter]  = useState(null)
  const [modelFilter,  setModelFilter]  = useState(null)
  const [showFilters,  setShowFilters]  = useState(false)

  // Charge le shop_id puis les tickets en une seule passe
  async function fetchTickets() {
    setLoading(true)
    setError(null)

    try {
      // 1. Utilisateur connecté
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error('Non authentifié')

      // 2. Shop de l'utilisateur
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (shopErr || !shop) throw new Error('Atelier introuvable')

      // 3. Tickets du shop
      let query = supabase
        .from('tickets')
        .select(`
          id, status, device_type, device_brand, device_model,
          issue_desc, received_at, estimated_ready_at, tracking_token,
          clients!tickets_client_id_fkey ( full_name, phone )
        `)
        .eq('shop_id', shop.id)
        .order('received_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter)
      if (clientFilter)    query = query.eq('client_id', clientFilter)

      const { data, error: ticketsErr } = await query
      if (ticketsErr) throw new Error(ticketsErr.message)

      setTickets(data ?? [])
    } catch (err) {
      console.error('[tickets]', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Charge au montage et quand le filtre change
  useEffect(() => { fetchTickets() }, [filter])

  // Filtre recherche + marque + modèle côté client
  const displayed = tickets.filter(t => {
    if (brandFilter && t.device_brand?.toLowerCase() !== brandFilter.toLowerCase()) return false
    if (modelFilter && t.device_model?.toLowerCase() !== modelFilter.toLowerCase())  return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.clients?.full_name?.toLowerCase().includes(q) ||
      t.device_brand?.toLowerCase().includes(q)       ||
      t.device_model?.toLowerCase().includes(q)       ||
      t.issue_desc?.toLowerCase().includes(q)
    )
  })

  // Décompte des filtres actifs (hors statut)
  const activeFilterCount = [brandFilter, modelFilter, search].filter(Boolean).length

  return (
    <div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white font-bold text-2xl">Tickets</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? '…' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} au total`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTickets}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                       text-sm text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <Link
            href="/admin/tickets/new"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400
                       text-sm text-white font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau ticket
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 mb-4">

        {/* Ligne 1 : recherche + bouton filtres avancés + statuts */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un client, appareil, problème…"
              className="w-full bg-[#111118] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white
                         placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          {/* Bouton filtres marque/modèle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors
              ${showFilters || brandFilter || modelFilter
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-[#111118] text-gray-400 border-white/10 hover:bg-white/5'
              }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex gap-1.5 flex-wrap">
            {[
              { value: 'all',       label: 'Tous' },
              { value: 'pending',   label: 'En attente' },
              { value: 'in_repair', label: 'En réparation' },
              { value: 'ready',     label: 'Prêts' },
              { value: 'delivered', label: 'Livrés' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border
                  ${filter === value
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-[#111118] text-gray-400 border-white/10 hover:bg-white/5'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Ligne 2 : filtres marque + modèle (dépliables) */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 p-3 bg-[#111118] border border-white/10 rounded-xl">
            <div className="flex-1">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-1.5">Marque</p>
              <BrandDropdown
                value={brandFilter}
                onChange={v => { setBrandFilter(v); setModelFilter(null) }}
                placeholder="Toutes les marques"
              />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-1.5">Modèle</p>
              <ModelDropdown
                brand={brandFilter}
                value={modelFilter}
                onChange={setModelFilter}
                placeholder="Tous les modèles"
              />
            </div>
            {(brandFilter || modelFilter) && (
              <div className="flex items-end">
                <button
                  onClick={() => { setBrandFilter(null); setModelFilter(null) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                             text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Effacer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={fetchTickets} className="text-xs text-gray-500 hover:text-white underline">
            Réessayer
          </button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-400 font-medium">Aucun ticket trouvé</p>
          <p className="text-gray-600 text-sm mt-1">
            {search ? 'Essayez un autre terme de recherche.' : 'Les tickets apparaîtront ici.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Client', 'Appareil', 'Problème', 'Statut', 'Reçu le', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayed.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{ticket.clients?.full_name ?? '—'}</p>
                      <p className="text-gray-500 text-xs">{ticket.clients?.phone ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DeviceIcon type={ticket.device_type} />
                        <p className="text-gray-200">
                          {[ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-gray-300 truncate">{ticket.issue_desc ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {formatDate(ticket.received_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tickets/${ticket.id}`}
                        className="text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

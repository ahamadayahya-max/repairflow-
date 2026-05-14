'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Loader2, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react'
import QRStatusBadge from './QRStatusBadge'

// ---------------------------------------------------------------------------
// Liste des dossiers QualiRépar avec filtres et actions rapides
// ---------------------------------------------------------------------------

const FILTERS = [
  { v: 'all',             l: 'Tous'         },
  { v: 'eligible',        l: 'À soumettre'  },
  { v: 'claim_submitted', l: 'En cours'     },
  { v: 'paid',            l: 'Remboursés'   },
]

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Liste des dossiers QualiRépar avec filtres.
 */
export default function QRTicketsList() {
  const supabase = getSupabaseClient()
  const router   = useRouter()

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  async function loadTickets() {
    setLoading(true)
    const { data } = await supabase.rpc('get_qualirepar_eligible_tickets')
    setTickets(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTickets() }, [])

  const filtered = filter === 'all'
    ? tickets
    : tickets.filter(t => t.qr_status === filter)

  function getPlatformUrl(ecoOrg) {
    return ecoOrg === 'ecologic'
      ? 'https://www.e-reparateur.eco/'
      : 'https://portail-reparateurs.ecosystem.eco/'
  }

  return (
    <div className="space-y-4">

      {/* Filtres + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => {
          const count = f.v === 'all'
            ? tickets.length
            : tickets.filter(t => t.qr_status === f.v).length
          return (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filter === f.v
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
            >
              {f.l}
              <span className="ml-1.5 opacity-60">({count})</span>
            </button>
          )
        })}

        <button
          onClick={loadTickets}
          disabled={loading}
          className="ml-auto p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500
                     hover:text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Actualiser"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-500">
          <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
          <span className="text-sm">Chargement des dossiers…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <span className="text-5xl mb-4">🔁</span>
          <p className="text-sm font-medium text-gray-400 mb-1">
            {filter === 'all' ? 'Aucun dossier QualiRépar' : 'Aucun dossier dans cette catégorie'}
          </p>
          <p className="text-xs text-gray-600 max-w-xs">
            {filter === 'all'
              ? 'Créez un ticket et vérifiez l\'éligibilité de l\'appareil dans le panneau QualiRépar.'
              : 'Changez de filtre pour voir les autres dossiers.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <div
              key={ticket.ticket_id}
              className="bg-[#111118] border border-white/8 rounded-xl p-4
                         hover:border-white/15 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">

                {/* Infos ticket */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {ticket.client_name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || 'Appareil'}
                    {' · '}{formatDate(ticket.created_at)}
                  </p>

                  {/* Éco-organisme + montant */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                      ${ticket.qr_eco_org === 'ecologic'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-blue-500/15 text-blue-400'}`}>
                      {ticket.qr_eco_org === 'ecologic' ? '🌱 Ecologic' : '♻️ Ecosystem'}
                    </span>
                    {ticket.qr_montant && (
                      <span className="text-sm font-bold text-amber-400">
                        {ticket.qr_montant} €
                      </span>
                    )}
                  </div>
                </div>

                {/* Statut */}
                <QRStatusBadge status={ticket.qr_status} size="sm" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => router.push(`/admin/tickets/${ticket.ticket_id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                             bg-white/5 border border-white/10 text-gray-300 text-xs font-medium
                             hover:bg-white/10 hover:text-white transition-colors"
                >
                  Voir le ticket
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {ticket.qr_status === 'eligible' && (
                  <a
                    href={getPlatformUrl(ticket.qr_eco_org)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                               bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold
                               transition-colors"
                  >
                    Demander remboursement
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

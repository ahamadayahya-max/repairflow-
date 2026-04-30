'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Leaf, Euro, CheckCircle2, XCircle, Send,
  Loader2, ChevronRight, Clock
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Config statuts
// ---------------------------------------------------------------------------

const QR_STATUS_CONFIG = {
  non_eligible:     { label: 'Non éligible',         color: 'text-gray-400',    bg: 'bg-gray-400/10'    },
  eligible:         { label: 'Éligible',              color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
  support_pending:  { label: 'SMS en attente',        color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
  support_accepted: { label: 'Validé client',         color: 'text-indigo-400',  bg: 'bg-indigo-400/10'  },
  support_refused:  { label: 'Refusé client',         color: 'text-red-400',     bg: 'bg-red-400/10'     },
  claim_submitted:  { label: 'Dossier soumis',        color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
  claim_accepted:   { label: 'Dossier accepté',       color: 'text-green-400',   bg: 'bg-green-400/10'   },
  claim_refused:    { label: 'Dossier refusé',        color: 'text-red-400',     bg: 'bg-red-400/10'     },
  paid:             { label: 'Remboursé',             color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Carte KPI.
 * @param {{ label: string, value: number|string, icon: React.ElementType, color: string, bg: string, sub?: string }} props
 */
function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="bg-[#111118] rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function QrBadge({ status }) {
  const cfg = QR_STATUS_CONFIG[status] ?? QR_STATUS_CONFIG.non_eligible
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function QualiReparDashboardPage() {
  const supabase = getSupabaseClient()

  const [loading,  setLoading]  = useState(true)
  const [tickets,  setTickets]  = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!shop) { setLoading(false); return }

      // Tous les tickets avec un statut QualiRépar (hors non_eligible)
      const { data } = await supabase
        .from('tickets')
        .select(`
          id, device_type, device_brand, device_model, created_at,
          qualirepar_status, qr_montant, qr_eco_org, qr_claim_id,
          qr_soumis_at, qr_paid_at,
          clients!tickets_client_id_fkey ( full_name )
        `)
        .eq('shop_id', shop.id)
        .neq('qualirepar_status', 'non_eligible')
        .not('qualirepar_status', 'is', null)
        .order('created_at', { ascending: false })

      setTickets(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  // KPIs
  const eligible  = tickets.filter(t => t.qualirepar_status === 'eligible').length
  const submitted = tickets.filter(t => ['claim_submitted', 'claim_accepted', 'paid'].includes(t.qualirepar_status)).length
  const paid      = tickets.filter(t => t.qualirepar_status === 'paid').length
  const refused   = tickets.filter(t => ['claim_refused', 'support_refused'].includes(t.qualirepar_status)).length
  const totalEuro = tickets
    .filter(t => t.qualirepar_status === 'paid' && t.qr_montant)
    .reduce((s, t) => s + Number(t.qr_montant ?? 0), 0)

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl">Bonus QualiRépar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Suivi des dossiers AgoraPlus</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Éligibles"       value={eligible}  icon={CheckCircle2} color="text-amber-400"   bg="bg-amber-400/10"   sub="À soumettre" />
        <KpiCard label="Soumis"          value={submitted} icon={Send}         color="text-blue-400"    bg="bg-blue-400/10"    sub="Chez AgoraPlus" />
        <KpiCard label="Remboursés"      value={paid}      icon={Euro}         color="text-emerald-400" bg="bg-emerald-400/10" sub={`${totalEuro} € récupérés`} />
        <KpiCard label="Refusés"         value={refused}   icon={XCircle}      color="text-red-400"     bg="bg-red-400/10"     sub="Dossiers non validés" />
      </div>

      {/* Tableau */}
      <div className="bg-[#111118] rounded-xl border border-white/10">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-400" />
            Tous les dossiers
          </h2>
          <span className="text-xs text-gray-500">{tickets.length} dossier{tickets.length > 1 ? 's' : ''}</span>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Leaf className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 mb-1">Aucun dossier QualiRépar pour le moment</p>
            <p className="text-xs text-gray-600 mb-4">
              Ouvrez un ticket et cliquez sur «&nbsp;Vérifier l'éligibilité&nbsp;» pour démarrer.
            </p>
            <Link href="/admin/tickets" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
              Voir les tickets →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tickets.map(ticket => {
              const label = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type
              return (
                <Link
                  key={ticket.id}
                  href={`/admin/tickets/${ticket.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-green-500/8 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 font-medium truncate">{label}</p>
                      <p className="text-xs text-gray-500 truncate">{ticket.clients?.full_name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {ticket.qr_montant && (
                      <span className="text-xs font-bold text-green-400 hidden sm:block">
                        −{ticket.qr_montant} €
                      </span>
                    )}
                    <QrBadge status={ticket.qualirepar_status} />
                    <span className="text-xs text-gray-600 hidden md:block">{formatDate(ticket.created_at)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

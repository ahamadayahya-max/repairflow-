'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Users, Search, Phone, Mail, Ticket,
  Loader2, ChevronRight, UserRound, Archive, RotateCcw,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'

/**
 * Page liste des clients de l'atelier.
 * Les clients ne sont jamais supprimés — ils sont archivés via la RPC archive_client().
 */
export default function ClientsPage() {
  const supabase = getSupabaseClient()
  const router   = useRouter()

  const [shopId,         setShopId]         = useState(null)
  const [clients,        setClients]        = useState([])
  const [archivedList,   setArchivedList]   = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [showArchived,   setShowArchived]   = useState(false)
  const [loadingArchived,setLoadingArchived]= useState(false)

  // Modale d'archivage
  const [archiveTarget, setArchiveTarget] = useState(null) // client à archiver
  const [archiveReason, setArchiveReason] = useState('')
  const [archiving,     setArchiving]     = useState(false)

  // Restauration
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoring,     setRestoring]     = useState(false)

  // ---------------------------------------------------------------------------
  // Chargement des clients actifs
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }

      setShopId(shop.id)

      // Filtre sur archived = false (clients actifs uniquement)
      const { data } = await supabase
        .from('clients')
        .select(`
          id, full_name, phone, email, created_at, archived,
          tickets!tickets_client_id_fkey(id, status)
        `)
        .eq('shop_id', shop.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })

      setClients(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ---------------------------------------------------------------------------
  // Chargement des clients archivés (à la demande)
  // ---------------------------------------------------------------------------
  async function loadArchived() {
    if (!shopId) return
    setLoadingArchived(true)
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, phone, email, archived_at, archive_reason')
      .eq('shop_id', shopId)
      .eq('archived', true)
      .order('archived_at', { ascending: false })
    setArchivedList(data ?? [])
    setLoadingArchived(false)
  }

  function handleToggleArchived() {
    const next = !showArchived
    setShowArchived(next)
    if (next && archivedList.length === 0) loadArchived()
  }

  // ---------------------------------------------------------------------------
  // Archivage
  // ---------------------------------------------------------------------------
  async function handleArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      const { error } = await supabase.rpc('archive_client', {
        p_client_id: archiveTarget.id,
        p_reason:    archiveReason.trim() || 'Demande utilisateur',
      })
      if (error) throw new Error(error.message)
      // Retire de la liste locale
      setClients(prev => prev.filter(c => c.id !== archiveTarget.id))
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setArchiving(false)
      setArchiveTarget(null)
      setArchiveReason('')
    }
  }

  // ---------------------------------------------------------------------------
  // Restauration
  // ---------------------------------------------------------------------------
  async function handleRestore() {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const { error } = await supabase.rpc('restore_client', {
        p_client_id: restoreTarget.id,
      })
      if (error) throw new Error(error.message)
      // Retire de la liste des archivés
      setArchivedList(prev => prev.filter(c => c.id !== restoreTarget.id))
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setRestoring(false)
      setRestoreTarget(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Filtrage local
  // ---------------------------------------------------------------------------
  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  })

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
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients.length} client(s) enregistré(s)</p>
        </div>
        <button
          onClick={handleToggleArchived}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                      border transition-colors
                      ${showArchived
                        ? 'bg-orange-400/10 border-orange-400/20 text-orange-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
        >
          <Archive className="w-3.5 h-3.5" />
          {showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
        </button>
      </div>

      {/* ── Barre de recherche ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone ou email…"
          className="w-full bg-[#111118] border border-white/10 rounded-xl pl-9 pr-4 py-2.5
                     text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* ── Liste clients actifs ── */}
      <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6 text-gray-600" />}
            title={search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            description={search ? 'Essayez un autre terme de recherche.' : 'Les clients créés avec les tickets apparaîtront ici.'}
            compact
          />
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(client => {
              const tickets = client.tickets ?? []
              const actifs  = tickets.filter(t => t.status !== 'delivered').length
              const total   = tickets.length

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
                >
                  {/* Infos client */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-400 font-bold text-sm">
                        {client.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{client.full_name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {client.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </span>
                        )}
                        {client.email && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail className="w-3 h-3" /> {client.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats + actions */}
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Ticket className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm text-gray-300 font-medium">{total}</span>
                        <span className="text-xs text-gray-600">ticket(s)</span>
                      </div>
                      {actifs > 0 && (
                        <p className="text-xs text-amber-400 mt-0.5">{actifs} en cours</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Tickets du client */}
                      <button
                        onClick={() => router.push(`/admin/tickets?client=${client.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                   bg-white/5 border border-white/10 text-gray-400
                                   hover:bg-white/10 hover:text-gray-200 transition-colors"
                      >
                        <Ticket className="w-3 h-3" />
                        <span className="hidden sm:inline">Tickets</span>
                      </button>

                      {/* Fiche client */}
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                   bg-amber-500/10 border border-amber-500/20 text-amber-400
                                   hover:bg-amber-500/20 transition-colors"
                      >
                        <UserRound className="w-3 h-3" />
                        <span className="hidden sm:inline">Fiche</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>

                      {/* Archiver (jamais supprimer) */}
                      <button
                        onClick={() => { setArchiveTarget(client); setArchiveReason('') }}
                        title="Archiver ce client"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-orange-400
                                   hover:bg-orange-400/10 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section clients archivés ── */}
      {showArchived && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Clients archivés
            {archivedList.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-400/10 text-orange-400
                               border border-orange-400/20 rounded-full">
                {archivedList.length}
              </span>
            )}
          </h2>

          <div className="bg-[#111118] rounded-xl border border-orange-400/15 overflow-hidden">
            {loadingArchived ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : archivedList.length === 0 ? (
              <EmptyState
                icon={<Archive className="w-6 h-6 text-gray-600" />}
                title="Aucun client archivé"
                compact
              />
            ) : (
              <div className="divide-y divide-white/5">
                {archivedList.map(client => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between px-5 py-4 opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-500 font-bold text-sm">
                          {client.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-400 font-semibold truncate line-through">
                          {client.full_name}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {client.archive_reason ?? 'Archivé'}
                          {client.archived_at && (
                            <> · {new Date(client.archived_at).toLocaleDateString('fr-FR')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRestoreTarget(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                 bg-green-400/10 border border-green-400/20 text-green-400
                                 hover:bg-green-400/20 transition-colors flex-shrink-0 ml-3"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modale d'archivage ── */}
      {archiveTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setArchiveTarget(null) }}
        >
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10"
               style={{ background: '#111118' }}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-orange-400/10 flex items-center justify-center">
                <Archive className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">
              Archiver ce client ?
            </h3>
            <p className="text-sm text-gray-400 text-center mb-4 leading-relaxed">
              <strong className="text-gray-200">{archiveTarget.full_name}</strong> sera masqué de la liste principale
              mais conservé dans l'historique. Ses tickets et factures restent accessibles.
            </p>
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-500 mb-1.5 block uppercase tracking-wide">
                Raison (optionnel)
              </label>
              <input
                type="text"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder="Ex : client parti, doublon…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                           text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-400/40"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold
                           py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {archiving ? 'Archivage…' : 'Archiver'}
              </button>
              <button
                onClick={() => setArchiveTarget(null)}
                disabled={archiving}
                className="flex-1 bg-white/5 border border-white/10 text-gray-300 font-medium
                           py-2.5 rounded-xl text-sm transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale de restauration ── */}
      <ConfirmDialog
        isOpen={!!restoreTarget}
        title="Restaurer ce client ?"
        message={`${restoreTarget?.full_name ?? 'Ce client'} sera réactivé et réapparaîtra dans la liste principale.`}
        confirmLabel="Restaurer"
        cancelLabel="Annuler"
        icon="archive"
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

    </div>
  )
}

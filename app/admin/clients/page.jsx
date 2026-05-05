'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Users, Search, Phone, Mail, Ticket,
  Loader2, ChevronRight, UserRound,
} from 'lucide-react'

/**
 * Page liste des clients de l'atelier.
 */
export default function ClientsPage() {
  const supabase = getSupabaseClient()
  const router   = useRouter()

  const [shopId,  setShopId]  = useState(null)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }

      setShopId(shop.id)

      // Récupère les clients avec le nombre de tickets associés
      const { data } = await supabase
        .from('clients')
        .select(`
          id, full_name, phone, email, created_at,
          tickets!tickets_client_id_fkey(id, status)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })

      setClients(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients.length} client(s) enregistré(s)</p>
        </div>
      </div>

      {/* Barre de recherche */}
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

      {/* Liste */}
      <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">
              {search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(client => {
              const tickets       = client.tickets ?? []
              const actifs        = tickets.filter(t => t.status !== 'delivered').length
              const total         = tickets.length

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
                >
                  {/* Infos client */}
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Avatar initiales */}
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

                  {/* Stats tickets + lien */}
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

                    {/* Boutons action */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/tickets?client=${client.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                   bg-white/5 border border-white/10 text-gray-400
                                   hover:bg-white/10 hover:text-gray-200 transition-colors"
                      >
                        <Ticket className="w-3 h-3" />
                        <span className="hidden sm:inline">Tickets</span>
                      </button>
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
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

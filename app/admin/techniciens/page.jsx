'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { HardHat, Plus, Loader2, ToggleLeft, ToggleRight, Phone, Mail, Wrench, Star } from 'lucide-react'

// ---------------------------------------------------------------------------
// Formulaire d'ajout de technicien (état local)
// ---------------------------------------------------------------------------
const EMPTY_FORM = { full_name: '', email: '', phone: '', specialty: '' }

/**
 * Page de gestion des techniciens de l'atelier.
 * @param {{}} props
 */
export default function TechniciensPage() {
  const supabase = getSupabaseClient()

  const [shopId,      setShopId]      = useState(null)
  const [techs,       setTechs]       = useState([])
  const [ticketCounts,setTicketCounts]= useState({}) // { [tech_id]: nb }
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  // ---------------------------------------------------------------------------
  // Chargement initial
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }

      setShopId(shop.id)
      await loadTechs(shop.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadTechs = async (sid) => {
    const { data } = await supabase
      .from('technicians')
      .select('id, full_name, email, phone, specialty, is_active, created_at')
      .eq('shop_id', sid)
      .order('full_name')

    const list = data ?? []
    setTechs(list)

    // Charge le nombre de tickets assignés à chaque technicien
    if (list.length > 0) {
      const ids = list.map(t => t.id)
      const { data: counts } = await supabase
        .from('tickets')
        .select('assigned_to')
        .eq('shop_id', sid)
        .in('assigned_to', ids)

      const map = {}
      ;(counts ?? []).forEach(r => {
        map[r.assigned_to] = (map[r.assigned_to] ?? 0) + 1
      })
      setTicketCounts(map)
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle actif / inactif
  // ---------------------------------------------------------------------------
  const toggleActive = async (tech) => {
    await supabase
      .from('technicians')
      .update({ is_active: !tech.is_active })
      .eq('id', tech.id)
    setTechs(prev => prev.map(t => t.id === tech.id ? { ...t, is_active: !t.is_active } : t))
  }

  // ---------------------------------------------------------------------------
  // Ajout d'un technicien
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!shopId || !form.full_name.trim()) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('technicians')
      .insert({ shop_id: shopId, ...form })

    if (err) { setError(err.message); setSaving(false); return }

    setForm(EMPTY_FORM)
    setShowForm(false)
    await loadTechs(shopId)
    setSaving(false)
  }

  // Initiales pour l'avatar
  const initials = (name) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <HardHat className="w-5 h-5 text-amber-400" />
            Techniciens
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{techs.length} technicien{techs.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-white">Nouveau technicien</h2>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom complet *</label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2
                           text-white text-sm placeholder-gray-600 focus:outline-none
                           focus:border-amber-500/50"
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2
                           text-white text-sm placeholder-gray-600 focus:outline-none
                           focus:border-amber-500/50"
                placeholder="jean@atelier.fr"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2
                           text-white text-sm placeholder-gray-600 focus:outline-none
                           focus:border-amber-500/50"
                placeholder="+33 6 00 00 00 00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Spécialité</label>
              <input
                type="text"
                value={form.specialty}
                onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2
                           text-white text-sm placeholder-gray-600 focus:outline-none
                           focus:border-amber-500/50"
                placeholder="Smartphones, Laptops…"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm
                         font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm
                         rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste des techniciens */}
      {techs.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center
                        bg-[#111118] border border-white/10 rounded-xl">
          <HardHat className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">Aucun technicien</p>
          <p className="text-xs text-gray-700 mt-1">Ajoutez le premier technicien de l'atelier</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white
                       text-sm font-semibold rounded-lg transition-colors"
          >
            + Ajouter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {techs.map(tech => {
            const nbTickets = ticketCounts[tech.id] ?? 0
            return (
              <div
                key={tech.id}
                className={`bg-[#111118] border rounded-xl p-5 space-y-4 transition-colors
                  ${tech.is_active ? 'border-white/10' : 'border-white/5 opacity-60'}`}
              >
                {/* Avatar + nom */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center
                                    justify-center flex-shrink-0">
                      <span className="text-amber-400 font-bold text-sm">
                        {initials(tech.full_name)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{tech.full_name}</p>
                      {tech.specialty && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {tech.specialty}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Toggle actif */}
                  <button
                    onClick={() => toggleActive(tech)}
                    className={`flex-shrink-0 transition-colors
                      ${tech.is_active ? 'text-green-400 hover:text-red-400' : 'text-gray-700 hover:text-green-400'}`}
                    title={tech.is_active ? 'Désactiver' : 'Activer'}
                  >
                    {tech.is_active
                      ? <ToggleRight className="w-6 h-6" />
                      : <ToggleLeft className="w-6 h-6" />
                    }
                  </button>
                </div>

                {/* Coordonnées */}
                <div className="space-y-1">
                  {tech.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{tech.email}</span>
                    </div>
                  )}
                  {tech.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{tech.phone}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-400">{nbTickets}</p>
                    <p className="text-[10px] text-gray-600">ticket{nbTickets > 1 ? 's' : ''} assigné{nbTickets > 1 ? 's' : ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${tech.is_active
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-500'}`}>
                    {tech.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

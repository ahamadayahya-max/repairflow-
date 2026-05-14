'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Search, X, Ticket, Users, FileText, Receipt, Package } from 'lucide-react'

// ---------------------------------------------------------------------------
// Config des sources de recherche
// ---------------------------------------------------------------------------
const SOURCES = [
  {
    key: 'tickets',
    label: 'Tickets',
    icon: Ticket,
    color: 'text-blue-400',
    // Colonnes à sélectionner
    select: 'id, device_brand, device_model, device_type, ticket_number',
    // Champs de recherche (ilike)
    searchFields: ['device_brand', 'device_model', 'device_type', 'ticket_number'],
    getLabel: (r) => [r.device_brand, r.device_model].filter(Boolean).join(' ') || r.device_type || '—',
    getSub:   (r) => r.ticket_number ? `#${r.ticket_number}` : '',
    getHref:  (r) => `/admin/tickets/${r.id}`,
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: Users,
    color: 'text-green-400',
    select: 'id, full_name, phone',
    searchFields: ['full_name', 'phone'],
    getLabel: (r) => r.full_name || '—',
    getSub:   (r) => r.phone || '',
    getHref:  (r) => `/admin/clients/${r.id}`,
  },
  {
    key: 'invoices',
    label: 'Factures',
    icon: Receipt,
    color: 'text-amber-400',
    select: 'id, invoice_number, status',
    searchFields: ['invoice_number'],
    getLabel: (r) => `Facture ${r.invoice_number || '—'}`,
    getSub:   (r) => r.status || '',
    getHref:  (r) => `/admin/factures/${r.id}`,
  },
  {
    key: 'quotes',
    label: 'Devis',
    icon: FileText,
    color: 'text-purple-400',
    select: 'id, quote_number, status',
    searchFields: ['quote_number'],
    getLabel: (r) => `Devis ${r.quote_number || '—'}`,
    getSub:   (r) => r.status || '',
    getHref:  (r) => `/admin/devis/${r.id}`,
  },
  {
    key: 'parts_inventory',
    label: 'Pièces',
    icon: Package,
    color: 'text-orange-400',
    select: 'id, part_name, sku',
    searchFields: ['part_name', 'sku'],
    getLabel: (r) => r.part_name || '—',
    getSub:   (r) => r.sku ? `Réf. ${r.sku}` : '',
    getHref:  (r) => `/admin/parts`,
  },
]

/**
 * Barre de recherche globale modale (Ctrl+K).
 * Recherche en parallèle dans tickets, clients, factures, devis, pièces.
 */
export default function GlobalSearch() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([]) // [{ source, items }]
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(0)  // index dans la liste aplatie

  const inputRef  = useRef(null)
  const debounceRef = useRef(null)

  // Liste aplatie pour la navigation clavier
  const flatItems = results.flatMap(group =>
    group.items.map(item => ({ ...item, href: group.source.getHref(item) }))
  )

  // ---------------------------------------------------------------------------
  // Raccourci clavier Ctrl+K
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Focus auto à l'ouverture
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // ---------------------------------------------------------------------------
  // Recherche avec debounce 300ms
  // ---------------------------------------------------------------------------
  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)

    try {
      // Récupère le shop de l'utilisateur pour filtrer
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }

      // Requêtes en parallèle
      const promises = SOURCES.map(async (src) => {
        // Construit un filtre OR sur les champs de recherche
        const orFilter = src.searchFields
          .map(f => `${f}.ilike.%${q}%`)
          .join(',')

        let query = supabase
          .from(src.key)
          .select(src.select)
          .eq('shop_id', shop.id)
          .or(orFilter)
          .limit(4)

        // Les clients archivés sont exclus de la recherche globale
        if (src.key === 'clients') {
          query = query.eq('archived', false)
        }

        const { data } = await query
        return { source: src, items: data ?? [] }
      })

      const all = await Promise.all(promises)
      // Filtre les groupes vides
      setResults(all.filter(g => g.items.length > 0))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setSelected(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  // ---------------------------------------------------------------------------
  // Navigation clavier ↑↓ Enter
  // ---------------------------------------------------------------------------
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && flatItems[selected]) {
      navigate(flatItems[selected].href)
    }
  }

  const navigate = (href) => {
    setOpen(false)
    router.push(href)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
                   text-gray-400 hover:text-white hover:bg-white/10 text-sm transition-colors"
        title="Recherche globale (Ctrl+K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Ctrl+K</span>
      </button>
    )
  }

  return (
    // Overlay modal
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
         onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-[#1A1A27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
           onClick={e => e.stopPropagation()}>

        {/* Champ de recherche */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un ticket, client, facture, pièce…"
            className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          )}
          <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Résultats groupés */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              Aucun résultat pour « {query} »
            </div>
          )}
          {query.length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-gray-700">
              Saisissez au moins 2 caractères pour rechercher
            </div>
          )}

          {results.map((group) => {
            const { source, items } = group
            const Icon = source.icon
            return (
              <div key={source.key} className="border-b border-white/5 last:border-0">
                {/* En-tête du groupe */}
                <div className="flex items-center gap-2 px-4 py-2 bg-white/3">
                  <Icon className={`w-3.5 h-3.5 ${source.color}`} />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {source.label}
                  </span>
                </div>
                {/* Lignes */}
                {items.map((item) => {
                  const href    = source.getHref(item)
                  const label   = source.getLabel(item)
                  const sub     = source.getSub(item)
                  // Index dans la liste aplatie
                  const idx = flatItems.findIndex(f => f.id === item.id && f.href === href)
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(href)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                        ${idx === selected ? 'bg-amber-500/10' : 'hover:bg-white/5'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                                       bg-white/5 flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${source.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{label}</p>
                        {sub && <p className="text-xs text-gray-600 truncate">{sub}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Pied de modale */}
        <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-4 text-[10px] text-gray-700">
          <span>↑↓ Naviguer</span>
          <span>↵ Ouvrir</span>
          <span>Esc Fermer</span>
        </div>
      </div>
    </div>
  )
}

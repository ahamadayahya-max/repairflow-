'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Search, Loader2, Package, AlertTriangle, Plus } from 'lucide-react'

/**
 * Champ de recherche autocomplete pour les pièces détachées.
 * Interroge parts_inventory via Supabase avec debounce 300ms.
 *
 * @param {{
 *   onSelect: (part: object) => void,
 *   onCreateNew?: (name: string) => void,
 *   placeholder?: string,
 *   filterShopId?: string,
 *   className?: string,
 * }} props
 */
export default function PartSearchDropdown({
  onSelect,
  onCreateNew,
  placeholder = 'Rechercher une pièce… (min. 2 caractères)',
  filterShopId,
  className = '',
}) {
  const supabase = getSupabaseClient()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const inputRef    = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)
  const shopIdRef   = useRef(filterShopId)

  // Met à jour la ref si filterShopId change après le montage
  useEffect(() => { shopIdRef.current = filterShopId }, [filterShopId])

  // ---------------------------------------------------------------------------
  // Recherche avec debounce 300ms
  // ---------------------------------------------------------------------------
  const search = useCallback(async (q) => {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    setLoading(true)
    setOpen(true)

    const shopId = shopIdRef.current

    let req = supabase
      .from('parts_inventory')
      .select('id, part_name, sku, qty_stock, unit_price, shop_id')
      .or(`part_name.ilike.%${q}%,sku.ilike.%${q}%,supplier_name.ilike.%${q}%`)
      .order('part_name')
      .limit(10)

    if (shopId) req = req.eq('shop_id', shopId)

    const { data } = await req

    setResults(data ?? [])
    setActiveIdx(-1)
    setLoading(false)
  }, [supabase])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  // ---------------------------------------------------------------------------
  // Fermeture au clic extérieur
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function onMouseDown(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ---------------------------------------------------------------------------
  // Navigation clavier
  // ---------------------------------------------------------------------------
  const handleKeyDown = (e) => {
    if (!open) return

    // Nombre d'items = résultats + éventuellement le bouton "Créer"
    const total = results.length + (query.length >= 2 ? 1 : 0)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, total - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && activeIdx < results.length) {
        selectPart(results[activeIdx])
      } else if (activeIdx === results.length) {
        // Bouton "Créer"
        handleCreate()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  // ---------------------------------------------------------------------------
  // Sélection et création
  // ---------------------------------------------------------------------------
  const selectPart = (part) => {
    setQuery('')
    setResults([])
    setOpen(false)
    setActiveIdx(-1)
    onSelect(part)
  }

  const handleCreate = () => {
    const name = query.trim()
    setQuery('')
    setResults([])
    setOpen(false)
    setActiveIdx(-1)
    onCreateNew?.(name)
  }

  // ---------------------------------------------------------------------------
  // Rendu du badge de stock
  // ---------------------------------------------------------------------------
  function StockBadge({ qty }) {
    if (qty === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                         bg-red-400/10 text-red-400 text-xs font-semibold">
          <AlertTriangle className="w-3 h-3" />
          Rupture
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                       bg-green-400/10 text-green-400 text-xs font-semibold">
        En stock ({qty})
      </span>
    )
  }

  return (
    <div className={`relative ${className}`}>

      {/* Champ de saisie */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          id="part-search-input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-[#111118] border border-white/10 rounded-xl pl-9 pr-4 py-2.5
                     text-sm text-white placeholder-gray-600
                     focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1.5 bg-[#111118] border border-white/10
                     rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Résultats vides */}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Aucune pièce trouvée pour « {query} »
            </div>
          )}

          {/* Liste des résultats */}
          {results.map((part, i) => {
            const isActive  = i === activeIdx
            const isRupture = part.qty_stock === 0

            return (
              <button
                key={part.id}
                type="button"
                onMouseDown={() => selectPart(part)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left
                            border-b border-white/5 last:border-0 transition-colors
                            ${isActive ? 'bg-amber-500/10' : 'hover:bg-white/3'}
                            ${isRupture ? 'opacity-60' : ''}`}
              >
                {/* Infos pièce */}
                <div className="flex items-center gap-3 min-w-0">
                  <Package className={`w-4 h-4 shrink-0 ${isRupture ? 'text-gray-600' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-100 font-medium truncate">{part.part_name}</p>
                    {part.sku && (
                      <p className="text-xs text-gray-600 font-mono">{part.sku}</p>
                    )}
                  </div>
                </div>

                {/* Prix + stock */}
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {part.unit_price != null && (
                    <span className="text-xs text-gray-400">
                      {Number(part.unit_price).toFixed(2)} €
                    </span>
                  )}
                  <StockBadge qty={part.qty_stock} />
                </div>
              </button>
            )
          })}

          {/* Bouton "Créer" — toujours affiché quand il y a une query valide */}
          {query.length >= 2 && onCreateNew && (
            <button
              type="button"
              onMouseDown={handleCreate}
              onMouseEnter={() => setActiveIdx(results.length)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-amber-400
                          border-t border-white/5 transition-colors
                          ${activeIdx === results.length ? 'bg-amber-500/10' : 'hover:bg-white/3'}`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Créer « <strong>{query}</strong> »</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

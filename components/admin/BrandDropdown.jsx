'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Tag, X, ChevronDown } from 'lucide-react'

// ---------------------------------------------------------------------------
// Marques statiques de secours
// ---------------------------------------------------------------------------

const STATIC_BRANDS = [
  'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'OnePlus', 'Sony',
  'LG', 'Nokia', 'Motorola', 'Google', 'Oppo', 'Realme',
  'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Microsoft',
  'Nintendo', 'PlayStation', 'Xbox', 'Bosch', 'Dyson',
  'Whirlpool', 'Beko', 'Canon', 'Nikon', 'GoPro',
]

// ---------------------------------------------------------------------------
// Highlight des caractères matchés
// ---------------------------------------------------------------------------

/**
 * Surligne en ambré les caractères qui correspondent à la recherche.
 * @param {{ text: string, query: string }} props
 */
function Highlight({ text, query }) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: '#F59E0B', fontWeight: 600 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

/**
 * Dropdown intelligent de sélection de marque.
 * Affiche les marques récentes de l'atelier puis toutes les marques connues.
 *
 * @param {{
 *   value: string | null,
 *   onChange: (brand: string | null) => void,
 *   placeholder?: string,
 *   className?: string,
 * }} props
 */
export default function BrandDropdown({
  value,
  onChange,
  placeholder = 'Ex : Apple, Samsung…',
  className = '',
}) {
  const supabase = getSupabaseClient()

  const [open,          setOpen]          = useState(false)
  const [query,         setQuery]         = useState('')
  const [recentBrands,  setRecentBrands]  = useState([])   // [{ device_brand, total }]
  const [allBrands,     setAllBrands]     = useState([])   // string[]
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const [shopId,        setShopId]        = useState(null)

  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)

  // ---------------------------------------------------------------------------
  // Chargement initial : shop + marques récentes + catalogue iFixit
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) return
      setShopId(shop.id)

      // Requête 1 — marques récentes (agrégation JS pour éviter un RPC)
      const { data: rows } = await supabase
        .from('tickets')
        .select('device_brand')
        .eq('shop_id', shop.id)
        .not('device_brand', 'is', null)

      if (rows?.length) {
        const counts = {}
        rows.forEach(r => {
          if (r.device_brand) counts[r.device_brand] = (counts[r.device_brand] || 0) + 1
        })
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([device_brand, total]) => ({ device_brand, total }))
        setRecentBrands(sorted)
      }

      // Requête 2 — marques depuis ifixit_devices (premier mot de subcategory)
      const { data: ifixitRows } = await supabase
        .from('ifixit_devices')
        .select('subcategory')
        .not('subcategory', 'is', null)

      const brandSet = new Set(STATIC_BRANDS)
      ifixitRows?.forEach(r => {
        const word = r.subcategory?.split(' ')[0]
        if (word && word.length > 1) brandSet.add(word)
      })

      setAllBrands([...brandSet].sort((a, b) => a.localeCompare(b)))
    }
    load()
  }, [])

  // ---------------------------------------------------------------------------
  // Fermeture au clic extérieur
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function handler(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus automatique sur la recherche à l'ouverture
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40)
  }, [open])

  // ---------------------------------------------------------------------------
  // Listes filtrées
  // ---------------------------------------------------------------------------

  const q = query.toLowerCase()

  const filteredRecent = recentBrands.filter(b =>
    !q || b.device_brand.toLowerCase().includes(q)
  )
  const filteredAll = allBrands
    .filter(b => !q || b.toLowerCase().includes(q))
    .filter(b => !filteredRecent.some(r => r.device_brand === b))

  // Liste plate pour la navigation clavier
  const noResults = filteredRecent.length === 0 && filteredAll.length === 0
  const flatCount = filteredRecent.length + filteredAll.length + (noResults && q ? 1 : 0)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function select(brand) {
    onChange(brand)
    setOpen(false)
    setQuery('')
    setActiveIdx(-1)
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, flatCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const allFlat = [
        ...filteredRecent.map(r => r.device_brand),
        ...filteredAll,
        ...(noResults && q ? [q] : []),
      ]
      if (activeIdx >= 0 && allFlat[activeIdx]) select(allFlat[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  const isSelected = !!value

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>

      {/* ── Bouton déclencheur ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onKeyDown={handleKeyDown}
        style={{
          border:        `1.5px solid ${open ? '#F59E0B' : isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:  10,
          boxShadow:     open ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
          background:    isSelected ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
          padding:       '10px 14px',
          transition:    'border-color .2s, box-shadow .2s',
        }}
        className="w-full flex items-center gap-2 text-sm text-left"
      >
        <Tag className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className={`flex-1 truncate ${value ? 'text-white' : 'text-gray-500'}`}>
          {value || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(null) }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(null))}
            className="text-gray-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-[#111118] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

          {/* Recherche */}
          <div className="p-2 border-b border-white/5">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher une marque…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                         placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          <div className="max-h-72 overflow-y-auto">

            {/* Section récentes */}
            {filteredRecent.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-medium">
                  Utilisées récemment
                </p>
                {filteredRecent.map((b, i) => (
                  <button
                    key={b.device_brand}
                    type="button"
                    onMouseDown={() => select(b.device_brand)}
                    onMouseEnter={() => setActiveIdx(i)}
                    style={{ background: activeIdx === i ? 'rgba(245,158,11,0.08)' : undefined }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left
                               text-gray-200 hover:bg-white/3 transition-colors"
                  >
                    <Highlight text={b.device_brand} query={query} />
                    <span className="text-[10px] text-gray-600 ml-3 shrink-0">
                      {b.total} ticket{b.total > 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
                {filteredAll.length > 0 && <div className="border-t border-white/5 my-1" />}
              </>
            )}

            {/* Section toutes les marques */}
            {filteredAll.length > 0 && (
              <>
                {filteredRecent.length > 0 && (
                  <p className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-medium">
                    Toutes les marques
                  </p>
                )}
                {filteredAll.map((b, i) => {
                  const idx = filteredRecent.length + i
                  return (
                    <button
                      key={b}
                      type="button"
                      onMouseDown={() => select(b)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{ background: activeIdx === idx ? 'rgba(245,158,11,0.08)' : undefined }}
                      className="w-full flex items-center px-3 py-2.5 text-sm text-gray-200
                                 text-left hover:bg-white/3 transition-colors"
                    >
                      <Highlight text={b} query={query} />
                    </button>
                  )
                })}
              </>
            )}

            {/* Aucun résultat */}
            {noResults && (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-gray-500 mb-2">Aucune marque trouvée</p>
                {q && (
                  <button
                    type="button"
                    onMouseDown={() => select(query)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    + Utiliser «&nbsp;<strong>{query}</strong>&nbsp;» comme marque
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

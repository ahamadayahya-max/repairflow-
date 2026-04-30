'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Building2, X, ChevronDown } from 'lucide-react'

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
 * Dropdown intelligent de sélection de fournisseur.
 * Affiche les fournisseurs les plus utilisés dans parts_inventory.
 *
 * @param {{
 *   shopId: string | null,
 *   value: string | null,
 *   onChange: (supplier: string | null) => void,
 *   placeholder?: string,
 *   className?: string,
 * }} props
 */
export default function SupplierDropdown({
  shopId,
  value,
  onChange,
  placeholder = 'Tous les fournisseurs',
  className = '',
}) {
  const supabase = getSupabaseClient()

  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [suppliers, setSuppliers] = useState([])   // [{ name, count }]
  const [loaded,    setLoaded]    = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)

  // ---------------------------------------------------------------------------
  // Chargement des fournisseurs
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!shopId || loaded) return

    async function loadSuppliers() {
      const { data: rows } = await supabase
        .from('parts_inventory')
        .select('supplier_name')
        .eq('shop_id', shopId)
        .not('supplier_name', 'is', null)

      if (!rows?.length) { setLoaded(true); return }

      // Agrégation côté client pour éviter un RPC
      const counts = {}
      rows.forEach(r => {
        if (r.supplier_name) {
          counts[r.supplier_name] = (counts[r.supplier_name] || 0) + 1
        }
      })

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }))

      setSuppliers(sorted)
      setLoaded(true)
    }

    loadSuppliers()
  }, [shopId])

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
  // Filtrage
  // ---------------------------------------------------------------------------

  const q = query.toLowerCase()

  const filtered = suppliers.filter(s =>
    !q || s.name.toLowerCase().includes(q)
  )

  const noResults = filtered.length === 0
  const flatCount = filtered.length + (noResults && q ? 1 : 0)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function select(name) {
    onChange(name)
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
        ...filtered.map(s => s.name),
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
          border:       `1.5px solid ${open ? '#F59E0B' : isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          boxShadow:    open ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
          background:   isSelected ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
          padding:      '10px 14px',
          transition:   'border-color .2s, box-shadow .2s',
        }}
        className="w-full flex items-center gap-2 text-sm text-left"
      >
        <Building2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
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
              placeholder="Rechercher un fournisseur…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                         placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">

            {/* Fournisseurs */}
            {filtered.length > 0 && (
              <>
                {suppliers.length > 0 && (
                  <p className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-medium">
                    Fournisseurs
                  </p>
                )}
                {filtered.map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    onMouseDown={() => select(s.name)}
                    onMouseEnter={() => setActiveIdx(i)}
                    style={{ background: activeIdx === i ? 'rgba(245,158,11,0.08)' : undefined }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left
                               text-gray-200 hover:bg-white/3 transition-colors"
                  >
                    <Highlight text={s.name} query={query} />
                    <span className="text-[10px] text-gray-600 ml-3 shrink-0">
                      {s.count} pièce{s.count > 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Aucun résultat */}
            {noResults && (
              <div className="px-3 py-4 text-center">
                {suppliers.length === 0 && !query ? (
                  <p className="text-xs text-gray-500">Aucun fournisseur renseigné</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-2">Aucun fournisseur trouvé</p>
                    {q && (
                      <button
                        type="button"
                        onMouseDown={() => select(query)}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        + Utiliser «&nbsp;<strong>{query}</strong>&nbsp;» comme fournisseur
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

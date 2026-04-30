'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Search, X, Smartphone, Laptop, Tablet, Tv, Monitor,
  Package, ChevronRight, ChevronLeft, ChevronDown, Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Catégories et correspondance device_type
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'Phone',     label: 'Téléphones',     icon: Smartphone },
  { key: 'Laptop',    label: 'Ordinateurs',    icon: Laptop     },
  { key: 'Tablet',    label: 'Tablettes',      icon: Tablet     },
  { key: 'TV',        label: 'Télévisions',    icon: Tv         },
  { key: 'Console',   label: 'Consoles',       icon: Monitor    },
  { key: 'Appliance', label: 'Électroménager', icon: Package    },
]

const CATEGORY_TO_TYPE = {
  Phone: 'smartphone', Laptop: 'laptop', Tablet: 'tablet',
  TV: 'tv', Console: 'console', Appliance: 'appliance',
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Sélecteur d'appareil iFixit sous forme de liste déroulante inline.
 * @param {{ value: object|null, onChange: (device: object|null) => void, className?: string }} props
 */
export default function DevicePicker({ value, onChange, className = '' }) {
  const supabase = getSupabaseClient()

  const [open,    setOpen]    = useState(false)
  const [mode,    setMode]    = useState('browse')   // 'browse' | 'category' | 'search'
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [activeCategory,  setActiveCategory]  = useState(null)
  const [categoryDevices, setCategoryDevices] = useState([])

  const searchRef  = useRef(null)
  const debounceId = useRef(null)
  const containerRef = useRef(null)

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Focus sur la recherche à l'ouverture
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      // Réinitialise l'état interne
      setMode('browse')
      setQuery('')
      setResults([])
      setCategoryDevices([])
      setActiveCategory(null)
    }
  }, [open])

  // ── Recherche dans la table ifixit_devices ──
  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('ifixit_devices')
        .select('id, name, category, subcategory, image_url, ifixit_url')
        .ilike('name', `%${q.trim()}%`)
        .order('name')
        .limit(20)
      setResults(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    if (debounceId.current) clearTimeout(debounceId.current)
    if (q.trim().length >= 2) {
      setMode('search')
      debounceId.current = setTimeout(() => runSearch(q), 300)
    } else {
      setMode(activeCategory ? 'category' : 'browse')
      setResults([])
    }
  }

  // ── Charge les appareils d'une catégorie ──
  async function handleCategoryClick(cat) {
    setActiveCategory(cat)
    setMode('category')
    setLoading(true)
    const { data } = await supabase
      .from('ifixit_devices')
      .select('id, name, category, subcategory, image_url, ifixit_url')
      .eq('category', cat.key)
      .order('name')
      .limit(60)
    setCategoryDevices(data ?? [])
    setLoading(false)
  }

  // ── Sélection ──
  function handleSelect(device) {
    onChange({
      id:          device.id          ?? '',
      name:        device.name        ?? '',
      category:    device.category    ?? '',
      subcategory: device.subcategory ?? '',
      imageUrl:    device.image_url   ?? null,
      ifixitUrl:   device.ifixit_url  ?? null,
      deviceType:  CATEGORY_TO_TYPE[device.category] ?? 'other',
    })
    setOpen(false)
  }

  function handleBack() {
    setActiveCategory(null)
    setCategoryDevices([])
    setMode('browse')
    setQuery('')
    setResults([])
  }

  const CatIcon = activeCategory?.icon ?? Package

  const deviceList = mode === 'category' ? categoryDevices : results

  return (
    <div ref={containerRef} className={`relative ${className}`}>

      {/* ── Déclencheur ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm
                    transition-colors text-left
                    ${open
                      ? 'bg-white/8 border-amber-500/40 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-amber-500/30 hover:text-gray-300'
                    }`}
      >
        {value ? (
          <>
            {value.imageUrl ? (
              <img src={value.imageUrl} alt={value.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
            ) : (
              <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <span className="flex-1 truncate text-white font-medium">{value.name}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null) }}
              className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Rechercher un appareil…</span>
            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* ── Liste déroulante ── */}
      {open && (
        <div className="mt-1.5 rounded-xl border border-white/10 bg-[#0d0d14] shadow-xl overflow-hidden"
             style={{ zIndex: 100 }}>

          {/* Barre de recherche + bouton retour */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8">
            {mode === 'category' && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder={mode === 'category' ? `Filtrer dans ${activeCategory?.label}…` : 'iPhone 15, Galaxy S24…'}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
              />
              {query && (
                <button type="button"
                  onClick={() => { setQuery(''); setResults([]); setMode(activeCategory ? 'category' : 'browse') }}
                  className="text-gray-600 hover:text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Corps de la liste */}
          <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>

            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              </div>
            )}

            {/* Grille de catégories */}
            {!loading && mode === 'browse' && (
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-white/4
                               hover:bg-white/10 hover:border-amber-500/20 border border-white/8
                               text-gray-400 hover:text-white transition-all group"
                  >
                    <cat.icon className="w-4 h-4 group-hover:text-amber-400 transition-colors" />
                    <span className="text-[10px] font-medium text-center leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Liste d'appareils (catégorie ou recherche) */}
            {!loading && (mode === 'category' || mode === 'search') && (
              <>
                {deviceList.length === 0 ? (
                  <div className="text-center py-6 text-gray-600 text-xs">
                    {mode === 'search' && query.trim().length >= 2
                      ? `Aucun résultat pour « ${query} »`
                      : 'Aucun appareil dans cette catégorie.'}
                  </div>
                ) : (
                  <div>
                    {deviceList.map(device => (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => handleSelect(device)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5
                                   border-b border-white/4 last:border-0 transition-colors group text-left"
                      >
                        {device.image_url ? (
                          <img src={device.image_url} alt={device.name}
                               className="w-7 h-7 rounded object-cover bg-white/5 flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                            <CatIcon className="w-3.5 h-3.5 text-gray-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 font-medium truncate">{device.name}</p>
                          {device.subcategory && (
                            <p className="text-[10px] text-gray-600">{device.subcategory}</p>
                          )}
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-700 group-hover:text-amber-400 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pied */}
          <div className="px-3 py-1.5 border-t border-white/5">
            <p className="text-[9px] text-gray-700 text-center">
              Données iFixit — libre de droits
            </p>
          </div>

        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Cpu, X, ChevronDown, ExternalLink } from 'lucide-react'

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
 * Dropdown intelligent de sélection de modèle, dépendant de la marque choisie.
 * Affiche les modèles récents de l'atelier puis les modèles iFixit avec miniatures.
 *
 * @param {{
 *   brand: string | null,
 *   value: string | null,
 *   onChange: (model: string | null) => void,
 *   onIfixitSelect?: (device: object) => void,
 *   placeholder?: string,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export default function ModelDropdown({
  brand,
  value,
  onChange,
  onIfixitSelect,
  placeholder = 'Ex : iPhone 15, Galaxy S24…',
  disabled = false,
  className = '',
}) {
  const supabase = getSupabaseClient()

  const [open,          setOpen]          = useState(false)
  const [query,         setQuery]         = useState('')
  const [recentModels,  setRecentModels]  = useState([])   // [{ device_model, total }]
  const [ifixitModels,  setIfixitModels]  = useState([])   // [{ id, name, image_url, subcategory }]
  const [loading,       setLoading]       = useState(false)
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const [shopId,        setShopId]        = useState(null)

  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)

  // ---------------------------------------------------------------------------
  // Réinitialise le modèle sélectionné quand la marque change
  // ---------------------------------------------------------------------------

  const prevBrandRef = useRef(brand)
  useEffect(() => {
    if (prevBrandRef.current !== brand) {
      onChange(null)
      setRecentModels([])
      setIfixitModels([])
      setQuery('')
      prevBrandRef.current = brand
    }
  }, [brand])

  // ---------------------------------------------------------------------------
  // Chargement du shop_id au montage
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadShop() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (shop) setShopId(shop.id)
    }
    loadShop()
  }, [])

  // ---------------------------------------------------------------------------
  // Chargement des modèles quand la marque ou la query change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!brand || !open) return

    const timer = setTimeout(async () => {
      setLoading(true)
      await Promise.all([loadRecentModels(), loadIfixitModels()])
      setLoading(false)
    }, 200)

    return () => clearTimeout(timer)
  }, [brand, query, open, shopId])

  async function loadRecentModels() {
    if (!shopId || !brand) return

    // Récents : tickets du même shop avec cette marque
    const { data: rows } = await supabase
      .from('tickets')
      .select('device_model')
      .eq('shop_id', shopId)
      .eq('device_brand', brand)
      .not('device_model', 'is', null)

    if (!rows?.length) return

    const counts = {}
    rows.forEach(r => {
      if (r.device_model) counts[r.device_model] = (counts[r.device_model] || 0) + 1
    })

    let sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([device_model, total]) => ({ device_model, total }))

    // Filtrer par query si présente
    if (query) {
      sorted = sorted.filter(m =>
        m.device_model.toLowerCase().includes(query.toLowerCase())
      )
    }

    setRecentModels(sorted)
  }

  async function loadIfixitModels() {
    if (!brand) return

    // Requête iFixit : subcategory contient la marque (insensible à la casse)
    let q = supabase
      .from('ifixit_devices')
      .select('id, name, image_url, subcategory, category')
      .ilike('subcategory', `${brand}%`)
      .order('name')
      .limit(30)

    if (query) {
      q = q.ilike('name', `%${query}%`)
    }

    const { data: rows } = await q
    setIfixitModels(rows ?? [])
  }

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
  // Listes filtrées et comptage pour navigation clavier
  // ---------------------------------------------------------------------------

  const q = query.toLowerCase()

  const filteredRecent  = recentModels
  const filteredIfixit  = ifixitModels.filter(
    d => !filteredRecent.some(r => r.device_model === d.name)
  )

  const noResults = !loading && filteredRecent.length === 0 && filteredIfixit.length === 0
  const flatCount = filteredRecent.length + filteredIfixit.length + (noResults && q ? 1 : 0)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function selectModel(modelName) {
    onChange(modelName)
    setOpen(false)
    setQuery('')
    setActiveIdx(-1)
  }

  function selectIfixit(device) {
    onChange(device.name)
    onIfixitSelect?.(device)
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
        ...filteredRecent.map(r => ({ type: 'recent', data: r })),
        ...filteredIfixit.map(d => ({ type: 'ifixit', data: d })),
        ...(noResults && q ? [{ type: 'custom', data: query }] : []),
      ]
      if (activeIdx >= 0 && allFlat[activeIdx]) {
        const item = allFlat[activeIdx]
        if (item.type === 'recent')  selectModel(item.data.device_model)
        if (item.type === 'ifixit')  selectIfixit(item.data)
        if (item.type === 'custom')  selectModel(item.data)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  const isSelected = !!value
  const isDisabled = disabled || !brand

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>

      {/* ── Bouton déclencheur ── */}
      <button
        type="button"
        onClick={() => !isDisabled && setOpen(v => !v)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        style={{
          border:       `1.5px solid ${open ? '#F59E0B' : isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          boxShadow:    open ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
          background:   isSelected
            ? 'rgba(245,158,11,0.06)'
            : isDisabled
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(255,255,255,0.04)',
          padding:      '10px 14px',
          transition:   'border-color .2s, box-shadow .2s',
          opacity:      isDisabled ? 0.5 : 1,
          cursor:       isDisabled ? 'not-allowed' : 'pointer',
        }}
        className="w-full flex items-center gap-2 text-sm text-left"
      >
        <Cpu className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className={`flex-1 truncate ${value ? 'text-white' : 'text-gray-500'}`}>
          {isDisabled && !brand ? 'Choisir d\'abord une marque' : (value || placeholder)}
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
      {open && !isDisabled && (
        <div className="absolute z-50 w-full mt-1.5 bg-[#111118] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

          {/* Recherche */}
          <div className="p-2 border-b border-white/5">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un modèle…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                         placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>

          <div className="max-h-80 overflow-y-auto">

            {/* Chargement */}
            {loading && (
              <div className="px-3 py-4 text-center text-xs text-gray-600">
                Recherche en cours…
              </div>
            )}

            {/* Section récentes */}
            {!loading && filteredRecent.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-medium">
                  Déjà réparés chez vous
                </p>
                {filteredRecent.map((m, i) => (
                  <button
                    key={m.device_model}
                    type="button"
                    onMouseDown={() => selectModel(m.device_model)}
                    onMouseEnter={() => setActiveIdx(i)}
                    style={{ background: activeIdx === i ? 'rgba(245,158,11,0.08)' : undefined }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left
                               text-gray-200 hover:bg-white/3 transition-colors"
                  >
                    <Highlight text={m.device_model} query={query} />
                    <span className="text-[10px] text-gray-600 ml-3 shrink-0">
                      {m.total} ticket{m.total > 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
                {filteredIfixit.length > 0 && <div className="border-t border-white/5 my-1" />}
              </>
            )}

            {/* Section iFixit */}
            {!loading && filteredIfixit.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-medium">
                  Modèles disponibles
                </p>
                {filteredIfixit.map((device, i) => {
                  const idx = filteredRecent.length + i
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onMouseDown={() => selectIfixit(device)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{ background: activeIdx === idx ? 'rgba(245,158,11,0.08)' : undefined }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left
                                 text-gray-200 hover:bg-white/3 transition-colors"
                    >
                      {/* Miniature iFixit */}
                      {device.image_url ? (
                        <img
                          src={device.image_url}
                          alt=""
                          className="w-8 h-8 rounded object-cover shrink-0 bg-white/5"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/5 shrink-0 flex items-center justify-center">
                          <Cpu className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="truncate">
                          <Highlight text={device.name} query={query} />
                        </div>
                        {device.subcategory && (
                          <div className="text-[10px] text-gray-600 truncate mt-0.5">
                            {device.subcategory}
                          </div>
                        )}
                      </div>

                      <ExternalLink className="w-3 h-3 text-gray-700 shrink-0" />
                    </button>
                  )
                })}
              </>
            )}

            {/* Aucun résultat */}
            {!loading && noResults && (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-gray-500 mb-2">Aucun modèle trouvé</p>
                {q && (
                  <button
                    type="button"
                    onMouseDown={() => selectModel(query)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    + Utiliser «&nbsp;<strong>{query}</strong>&nbsp;» comme modèle
                  </button>
                )}
              </div>
            )}

            {/* Hint quand aucune query et aucun résultat encore */}
            {!loading && !noResults && filteredRecent.length === 0 && filteredIfixit.length === 0 && !query && (
              <div className="px-3 py-4 text-center text-xs text-gray-600">
                Tapez pour rechercher…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

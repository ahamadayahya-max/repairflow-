'use client'

import { useState } from 'react'
import { Plus, Trash2, Wrench, Package } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPES = {
  labour:     { label: 'Main d\'œuvre', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
  part:       { label: 'Pièce',          color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
  other:      { label: 'Autre',          color: '#6B7280', bg: 'rgba(107,114,128,0.12)'},
  qualirepar: { label: 'QualiRépar',    color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + ' €'
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Éditeur de lignes de prestation — réutilisé pour devis et factures.
 * @param {{ lines: object[], onChange: (lines: object[]) => void, shopId: string }} props
 */
export default function LineItemsEditor({ lines = [], onChange, shopId }) {
  const supabase = getSupabaseClient()

  const [catalog,      setCatalog]      = useState([])
  const [showPicker,   setShowPicker]   = useState(null)  // _key de la ligne active
  const [loadingParts, setLoadingParts] = useState(false)
  const [partSearch,   setPartSearch]   = useState('')

  // ---------------------------------------------------------------------------
  // Chargement du catalogue pièces
  // ---------------------------------------------------------------------------

  async function loadCatalog() {
    if (catalog.length) return
    setLoadingParts(true)
    const { data } = await supabase
      .from('parts_inventory')
      .select('id, part_name, unit_price, qty_stock')
      .eq('shop_id', shopId)
      .order('part_name')
    setCatalog(data || [])
    setLoadingParts(false)
  }

  // ---------------------------------------------------------------------------
  // Actions sur les lignes
  // ---------------------------------------------------------------------------

  function newLine(type) {
    return {
      _key:        crypto.randomUUID(),
      description: type === 'labour' ? 'Main d\'œuvre' : type === 'part' ? 'Pièce de rechange' : '',
      quantity:    1,
      unit_price:  0,
      line_type:   type,
      part_id:     null,
    }
  }

  function add(type) {
    const line = newLine(type)
    onChange([...lines, line])
    if (type === 'part') {
      loadCatalog().then(() => { setShowPicker(line._key); setPartSearch('') })
    }
  }

  function upd(key, field, value) {
    onChange(lines.map(l => l._key === key ? { ...l, [field]: value } : l))
  }

  function remove(key) {
    onChange(lines.filter(l => l._key !== key))
  }

  function pick(key, part) {
    onChange(lines.map(l => l._key === key
      ? { ...l, description: part.part_name, unit_price: part.unit_price ?? 0, part_id: part.id }
      : l))
    setShowPicker(null)
    setPartSearch('')
  }

  const filteredCatalog = catalog.filter(p =>
    !partSearch || p.part_name.toLowerCase().includes(partSearch.toLowerCase())
  )

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-1.5">

      {/* En-têtes colonnes */}
      <div className="hidden sm:grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 px-2">
        {['Description', 'Qté', 'Prix unit. HT', 'Total HT', ''].map(h => (
          <span key={h} className="text-[10px] text-gray-600 uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {/* Lignes */}
      {lines.map(line => {
        const t     = TYPES[line.line_type] || TYPES.other
        const total = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0)
        return (
          <div key={line._key} className="relative">
            <div className="grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 items-center
                            bg-white/[0.03] border border-white/[0.07] rounded-lg p-2">

              {/* Description + badge type */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
                  style={{ background: t.bg, color: t.color }}
                >
                  {t.label}
                </span>
                <input
                  value={line.description}
                  onChange={e => upd(line._key, 'description', e.target.value)}
                  placeholder="Description…"
                  className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600
                             focus:outline-none min-w-0"
                />
                {line.line_type === 'part' && (
                  <button
                    type="button"
                    onClick={() => {
                      loadCatalog()
                      setShowPicker(showPicker === line._key ? null : line._key)
                      setPartSearch('')
                    }}
                    className="text-gray-600 hover:text-purple-400 transition-colors flex-shrink-0"
                    title="Choisir dans le catalogue"
                  >
                    <Package className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quantité */}
              <input
                type="number" min="0" step="0.5"
                value={line.quantity}
                onChange={e => upd(line._key, 'quantity', e.target.value)}
                className="bg-transparent text-sm text-gray-200 text-right focus:outline-none
                           border border-white/10 rounded px-2 py-0.5 focus:border-amber-500/30 w-full"
              />

              {/* Prix unitaire */}
              <input
                type="number" min="0" step="0.01" placeholder="0,00"
                value={line.unit_price}
                onChange={e => upd(line._key, 'unit_price', e.target.value)}
                className="bg-transparent text-sm text-gray-200 text-right focus:outline-none
                           border border-white/10 rounded px-2 py-0.5 focus:border-amber-500/30 w-full"
              />

              {/* Total ligne */}
              <span className="text-sm text-gray-300 text-right tabular-nums">{eur(total)}</span>

              {/* Supprimer */}
              <button
                type="button"
                onClick={() => remove(line._key)}
                className="text-gray-700 hover:text-red-400 transition-colors p-1 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Picker catalogue pièces */}
            {showPicker === line._key && (
              <div
                className="absolute left-0 right-8 z-30 mt-1 bg-[#1A1A28] border border-white/10
                            rounded-xl shadow-2xl overflow-hidden"
                onMouseDown={e => e.preventDefault()}
              >
                <div className="p-2 border-b border-white/5">
                  <input
                    autoFocus
                    type="text"
                    value={partSearch}
                    onChange={e => setPartSearch(e.target.value)}
                    placeholder="Rechercher une pièce…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm
                               text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30"
                  />
                </div>
                {loadingParts ? (
                  <p className="text-xs text-gray-500 p-3 text-center">Chargement…</p>
                ) : filteredCatalog.length === 0 ? (
                  <p className="text-xs text-gray-500 p-3 text-center">Aucune pièce trouvée</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto">
                    {filteredCatalog.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => pick(line._key, p)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm
                                   text-gray-200 hover:bg-white/5 text-left gap-3"
                      >
                        <span className="truncate">{p.part_name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {eur(p.unit_price)} · stock {p.qty_stock}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Boutons d'ajout */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => add('labour')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     text-blue-400 bg-blue-400/8 hover:bg-blue-400/15 border border-blue-400/20 transition-colors"
        >
          <Wrench className="w-3 h-3" />
          + Main d'œuvre
        </button>
        <button
          type="button"
          onClick={() => add('part')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     text-purple-400 bg-purple-400/8 hover:bg-purple-400/15 border border-purple-400/20 transition-colors"
        >
          <Package className="w-3 h-3" />
          + Pièce
        </button>
        <button
          type="button"
          onClick={() => add('other')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     text-gray-400 bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
        >
          <Plus className="w-3 h-3" />
          + Autre
        </button>
      </div>
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import PartSearchDropdown from '@/components/admin/PartSearchDropdown'
import SupplierDropdown from '@/components/admin/SupplierDropdown'
import {
  Package, Plus, Pencil, Trash2, Check, X,
  Loader2, AlertTriangle, SlidersHorizontal
} from 'lucide-react'

const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

const EMPTY_FORM = { name: '', reference: '', stock: '', price: '', supplier: '' }

/**
 * Page de gestion des pièces détachées.
 */
export default function PartsPage() {
  const supabase = getSupabaseClient()

  const [shopId,   setShopId]   = useState(null)
  const [parts,    setParts]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState(null)

  // Formulaire (null = fermé, 'new' = nouveau, id = édition)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [deleting,      setDeleting]      = useState(null)
  const [highlightId,   setHighlightId]   = useState(null)
  const highlightTimer = useRef(null)

  // Filtres
  const [supplierFilter, setSupplierFilter] = useState(null)
  const [stockFilter,    setStockFilter]    = useState('all')  // 'all' | 'low' | 'out'
  const [showFilters,    setShowFilters]    = useState(false)

  // Charge le shop + les pièces
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }

      setShopId(shop.id)
      await fetchParts(shop.id)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchParts(sid) {
    const { data } = await supabase
      .from('parts_inventory')
      .select('id, part_name, sku, qty_stock, unit_price, supplier_name')
      .eq('shop_id', sid ?? shopId)
      .order('part_name')
    // Normalise les colonnes pour le reste du composant
    if (data) setParts(data.map(p => ({
      id:        p.id,
      name:      p.part_name,
      reference: p.sku,
      stock:     p.qty_stock,
      price:     p.unit_price,
      supplier:  p.supplier_name,
    })))
  }

  const openNew = () => {
    setEditId('new')
    setForm(EMPTY_FORM)
  }

  const openEdit = (part) => {
    setEditId(part.id)
    setForm({
      name:      part.name      ?? '',
      reference: part.reference ?? '',
      stock:     part.stock     ?? '',
      price:     part.price     ?? '',
      supplier:  part.supplier  ?? '',   // champ ajouté — évite le crash form.supplier.trim()
    })
  }

  const closeForm = () => { setEditId(null); setForm(EMPTY_FORM) }

  const flash = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return
    setSaving(true)

    try {
      // Utilise les vrais noms de colonnes de parts_inventory
      // Garde défensive sur supplier : peut être undefined si openEdit ancien code
      const supplierValue = (form.supplier ?? '').trim() || null

      const payload = {
        part_name:     form.name.trim(),
        sku:           (form.reference ?? '').trim() || null,
        qty_stock:     parseInt(form.stock)          || 0,
        unit_price:    parseFloat(form.price)        || null,
        supplier_name: supplierValue,
        shop_id:       shopId,
      }

      let error
      if (editId === 'new') {
        ;({ error } = await supabase.from('parts_inventory').insert(payload))
      } else {
        ;({ error } = await supabase.from('parts_inventory').update(payload).eq('id', editId))
      }

      if (error) {
        flash('error', error.message)
      } else {
        flash('success', editId === 'new' ? 'Pièce ajoutée ✅' : 'Pièce mise à jour ✅')
        closeForm()
        // Passe shopId explicitement pour éviter tout problème de closure
        await fetchParts(shopId)
      }
    } catch (err) {
      console.error('[parts] handleSave error:', err)
      flash('error', 'Erreur inattendue : ' + err.message)
    } finally {
      // finally garantit que le bouton n'est jamais bloqué en "Enregistrement…"
      setSaving(false)
    }
  }, [form, editId, shopId])

  const handleDelete = useCallback(async (id) => {
    setDeleting(id)
    try {
      const { error } = await supabase.from('parts_inventory').delete().eq('id', id)
      if (error) {
        flash('error', error.message)
      } else {
        setParts(prev => prev.filter(p => p.id !== id))
      }
    } catch (err) {
      flash('error', 'Erreur inattendue : ' + err.message)
    } finally {
      setDeleting(null)
    }
  }, [])

  // Ouvre le formulaire d'édition avec le nom pré-rempli via le payload du formulaire
  const openEditFromPayload = useCallback((payload) => {
    setEditId(payload.id)
    setForm({
      name:      payload.part_name ?? '',
      reference: payload.sku       ?? '',
      stock:     payload.qty_stock ?? '',
      price:     payload.unit_price ?? '',
      supplier:  payload.supplier_name ?? '',
    })
  }, [])

  // Sélection via PartSearchDropdown → flash jaune 2s sur la ligne correspondante
  const handleSearchSelect = useCallback((part) => {
    clearTimeout(highlightTimer.current)
    setHighlightId(part.id)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2000)

    // Scroll la ligne dans la vue si possible
    const row = document.getElementById(`part-row-${part.id}`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Ouvre le formulaire "nouveau" avec le nom pré-rempli
  const openNewWithName = useCallback((name) => {
    setEditId('new')
    setForm({ ...EMPTY_FORM, name })
  }, [])

  // Filtrage client par fournisseur + stock
  const filtered = parts.filter(p => {
    if (supplierFilter && p.supplier?.toLowerCase() !== supplierFilter.toLowerCase()) return false
    if (stockFilter === 'out') return p.stock === 0
    if (stockFilter === 'low') return p.stock > 0 && p.stock < 3
    return true
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
          <h1 className="text-white font-bold text-xl">Pièces détachées</h1>
          <p className="text-gray-500 text-sm mt-0.5">{parts.length} pièce(s) en catalogue</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter une pièce
        </button>
      </div>

      {/* Message flash */}
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm border
          ${msg.type === 'success'
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Formulaire ajout/édition */}
      {editId !== null && (
        <div className="bg-[#111118] rounded-xl border border-amber-500/30 p-5">
          <h2 className="text-white font-semibold text-sm mb-4">
            {editId === 'new' ? '➕ Nouvelle pièce' : '✏️ Modifier la pièce'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex : Écran iPhone 13"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Référence</label>
              <input
                type="text"
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="Ex : SCR-IP13-BLK"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stock (unités)</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Prix (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            {/* Fournisseur — nouvelle colonne pleine largeur */}
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Fournisseur <span className="text-gray-600">(optionnel)</span></label>
              <SupplierDropdown
                shopId={shopId}
                value={form.supplier || null}
                onChange={v => setForm(f => ({ ...f, supplier: v ?? '' }))}
                placeholder="Ex : GSM Parts, iStock…"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                         text-white text-sm font-semibold rounded-lg transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement…</>
                : <><Check className="w-3.5 h-3.5" /> Enregistrer</>
              }
            </button>
            <button
              onClick={closeForm}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10
                         text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Barre de recherche autocomplete + filtres */}
      <div className="flex flex-col gap-3">

        {/* Ligne 1 : recherche + bouton filtres */}
        <div className="flex gap-3">
          <div className="flex-1">
            <PartSearchDropdown
              filterShopId={shopId}
              onSelect={handleSearchSelect}
              onCreateNew={openNewWithName}
              placeholder="Rechercher une pièce… (Ctrl+P)"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap
              ${showFilters || supplierFilter || stockFilter !== 'all'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-[#111118] text-gray-400 border-white/10 hover:bg-white/5'
              }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtres
            {(supplierFilter || stockFilter !== 'all') && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                {[supplierFilter, stockFilter !== 'all' ? stockFilter : null].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Ligne 2 : filtres avancés (repliables) */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 p-3 bg-[#111118] border border-white/10 rounded-xl">
            <div className="flex-1">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-1.5">Fournisseur</p>
              <SupplierDropdown
                shopId={shopId}
                value={supplierFilter}
                onChange={setSupplierFilter}
                placeholder="Tous les fournisseurs"
              />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-1.5">Stock</p>
              <div className="flex gap-1.5">
                {[
                  { value: 'all', label: 'Tous'       },
                  { value: 'low', label: '⚠️ Bas'     },
                  { value: 'out', label: '🔴 Rupture' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStockFilter(opt.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors
                      ${stockFilter === opt.value
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/8'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {(supplierFilter || stockFilter !== 'all') && (
              <div className="flex items-end">
                <button
                  onClick={() => { setSupplierFilter(null); setStockFilter('all') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                             text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Effacer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liste des pièces */}
      <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">
        {parts.length === 0 ? (
          /* Catalogue vide — aucune pièce en base */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">Aucune pièce dans le catalogue</p>
            <button onClick={openNew} className="mt-3 text-xs text-amber-400 hover:text-amber-300">
              Ajouter la première pièce →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* Pièces existent mais les filtres n'ont aucun résultat */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">Aucun résultat pour ces filtres</p>
            <button
              onClick={() => { setSupplierFilter(null); setStockFilter('all') }}
              className="mt-3 text-xs text-amber-400 hover:text-amber-300"
            >
              Effacer les filtres →
            </button>
          </div>
        ) : (
          <>
            {/* En-tête tableau */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/10 text-xs text-gray-500 font-medium uppercase tracking-wide">
              <div className="col-span-3">Nom</div>
              <div className="col-span-2">Référence</div>
              <div className="col-span-3">Fournisseur</div>
              <div className="col-span-2 text-center">Stock</div>
              <div className="col-span-1 text-right">Prix</div>
              <div className="col-span-1" />
            </div>

            {filtered.map(part => {
              const stockAlert = part.stock === 0
                ? 'text-red-400 bg-red-400/10'
                : part.stock < 3
                  ? 'text-orange-400 bg-orange-400/10'
                  : 'text-green-400 bg-green-400/10'

              return (
                <div
                  key={part.id}
                  id={`part-row-${part.id}`}
                  className={`grid grid-cols-12 gap-4 px-5 py-3.5 border-b border-white/5 last:border-0
                             transition-colors duration-300 items-center
                             ${highlightId === part.id
                               ? 'bg-amber-500/15 border-l-2 border-l-amber-500'
                               : 'hover:bg-white/2'}`}
                >
                  <div className="col-span-3">
                    <p className="text-sm text-gray-200 font-medium">{part.name}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 font-mono">{part.reference ?? '—'}</p>
                  </div>
                  <div className="col-span-3">
                    {part.supplier ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                                       bg-white/5 border border-white/10 text-gray-400">
                        {part.supplier}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${stockAlert}`}>
                      {part.stock === 0 && <AlertTriangle className="w-3 h-3" />}
                      {part.stock}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm text-gray-300">
                      {part.price != null ? `${Number(part.price).toFixed(2)} €` : '—'}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(part)}
                      className="p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-white/5 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(part.id)}
                      disabled={deleting === part.id}
                      className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-40"
                      title="Supprimer"
                    >
                      {deleting === part.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

    </div>
  )
}

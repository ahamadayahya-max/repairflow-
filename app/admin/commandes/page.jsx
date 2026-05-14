'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { ShoppingCart, Plus, Loader2, Trash2, X, ChevronRight, Sparkles, ClipboardPaste, CheckCheck } from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Config des statuts de commande
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  draft:      { label: 'Brouillon',  color: 'text-gray-400',    bg: 'bg-gray-400/10'    },
  sent:       { label: 'Envoyée',    color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
  confirmed:  { label: 'Confirmée', color: 'text-green-400',   bg: 'bg-green-400/10'   },
  received:   { label: 'Reçue',     color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  partial:    { label: 'Partielle', color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
  cancelled:  { label: 'Annulée',   color: 'text-red-400',     bg: 'bg-red-400/10'     },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                      ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ---------------------------------------------------------------------------
// Modale de création de commande
// ---------------------------------------------------------------------------

const INPUT_CLS = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2
  text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50`

/**
 * Modale de création de commande fournisseur.
 * Deux onglets : saisie manuelle et import IA depuis Mobilax.
 * @param {{ shopId: string, onClose: () => void, onCreated: () => void }} props
 */
function NewOrderModal({ shopId, onClose, onCreated }) {
  const supabase = getSupabaseClient()

  // État commun
  const [parts,   setParts]   = useState([])
  const [form,    setForm]    = useState({ supplier_name: '', supplier_email: '', notes: '' })
  const [lines,   setLines]   = useState([{ part_id: '', part_name: '', qty_ordered: 1, unit_price: '' }])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  // État onglets
  const [tab,     setTab]     = useState('manual') // 'manual' | 'ai'

  // État onglet IA
  const [rawText,      setRawText]      = useState('')
  const [parsing,      setParsing]      = useState(false)
  const [parsedLines,  setParsedLines]  = useState(null)  // null = pas encore analysé
  const [parseError,   setParseError]   = useState(null)

  useEffect(() => {
    // Charge les pièces pour l'autocomplete (saisie manuelle)
    supabase.from('parts_inventory').select('id, part_name, sku')
      .eq('shop_id', shopId).order('part_name').limit(200)
      .then(({ data }) => setParts(data ?? []))
  }, [shopId])

  // ── Saisie manuelle : gestion des lignes ──
  const addLine = () =>
    setLines(l => [...l, { part_id: '', part_name: '', qty_ordered: 1, unit_price: '' }])

  const removeLine = (idx) =>
    setLines(l => l.filter((_, i) => i !== idx))

  const updateLine = (idx, field, value) =>
    setLines(l => l.map((line, i) => {
      if (i !== idx) return line
      if (field === 'part_id') {
        const part = parts.find(p => p.id === value)
        return { ...line, part_id: value, part_name: part ? part.part_name : line.part_name }
      }
      return { ...line, [field]: value }
    }))

  // ── Onglet IA : appel à /api/parse-order ──
  const handleParse = async () => {
    if (!rawText.trim()) return
    setParsing(true)
    setParseError(null)
    setParsedLines(null)
    try {
      const res  = await fetch('/api/parse-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur analyse')
      setParsedLines(data.lines ?? [])
    } catch (err) {
      setParseError(err.message)
    } finally {
      setParsing(false)
    }
  }

  const updateParsed = (idx, field, value) =>
    setParsedLines(l => l.map((line, i) => i === idx ? { ...line, [field]: value } : line))

  const removeParsed = (idx) =>
    setParsedLines(l => l.filter((_, i) => i !== idx))

  // Importe les lignes IA dans le formulaire manuel
  const importParsedLines = () => {
    const imported = parsedLines
      .filter(l => l.part_name?.trim())
      .map(l => ({
        part_id:    '',
        part_name:  l.part_name,
        qty_ordered: l.qty ?? 1,
        unit_price:  l.unit_price ?? '',
      }))
    if (imported.length > 0) setLines(imported)
    setTab('manual')
  }

  // ── Sauvegarde ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.supplier_name.trim()) return
    setSaving(true)
    setError(null)

    try {
      const { data: poNum } = await supabase.rpc('next_po_number', { p_shop_id: shopId })

      const total = lines.reduce((sum, l) =>
        sum + (parseFloat(l.unit_price) || 0) * (parseInt(l.qty_ordered) || 0), 0)

      const { data: order, error: errO } = await supabase
        .from('purchase_orders')
        .insert({
          shop_id:        shopId,
          order_number:   poNum,
          supplier_name:  form.supplier_name,
          supplier_email: form.supplier_email || null,
          notes:          form.notes || null,
          total_amount:   total,
          ordered_at:     new Date().toISOString(),
        })
        .select('id')
        .single()

      if (errO) throw errO

      const linesData = lines
        .filter(l => l.part_name.trim())
        .map(l => ({
          order_id:     order.id,
          part_id:      l.part_id || null,
          part_name:    l.part_name,
          qty_ordered:  parseInt(l.qty_ordered) || 1,
          qty_received: 0,
          unit_price:   parseFloat(l.unit_price) || null,
        }))

      if (linesData.length > 0) {
        const { error: errL } = await supabase.from('purchase_order_lines').insert(linesData)
        if (errL) throw errL
      }

      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60">
      <div className="w-full max-w-2xl bg-[#1A1A27] border border-white/15 rounded-2xl shadow-2xl
                      overflow-hidden max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Nouvelle commande fournisseur</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-6 pt-3 pb-0">
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-semibold
                        border-b-2 transition-colors
                        ${tab === 'manual'
                          ? 'border-amber-500 text-amber-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Saisie manuelle
          </button>
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-semibold
                        border-b-2 transition-colors
                        ${tab === 'ai'
                          ? 'border-amber-500 text-amber-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Coller depuis Mobilax
          </button>
        </div>
        <div className="border-b border-white/10 mx-0" />

        {/* ── Onglet Saisie manuelle ── */}
        {tab === 'manual' && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 space-y-5">
              {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

              {/* Bannière si des lignes ont été importées */}
              {lines.length > 0 && lines[0].part_name && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                                bg-amber-500/8 border border-amber-500/20 text-amber-400 text-xs">
                  <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  {lines.length} ligne{lines.length > 1 ? 's' : ''} importée{lines.length > 1 ? 's' : ''} depuis l'IA — vérifiez et complétez si besoin
                </div>
              )}

              {/* Fournisseur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fournisseur *</label>
                  <input
                    type="text" required
                    value={form.supplier_name}
                    onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="Ex : Mobilax"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email fournisseur</label>
                  <input
                    type="email"
                    value={form.supplier_email}
                    onChange={e => setForm(f => ({ ...f, supplier_email: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="contact@fournisseur.fr"
                  />
                </div>
              </div>

              {/* Lignes de commande */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500">
                    Lignes de commande
                    <span className="text-gray-700 ml-1 font-mono">Qté · P.U. HT (€)</span>
                  </label>
                  <button type="button" onClick={addLine}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                    + Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex-1 min-w-0">
                        {parts.length > 0 ? (
                          <select
                            value={line.part_id}
                            onChange={e => updateLine(idx, 'part_id', e.target.value)}
                            className={INPUT_CLS}
                          >
                            <option value="">— Libellé libre —</option>
                            {parts.map(p => (
                              <option key={p.id} value={p.id}>{p.part_name}{p.sku ? ` (${p.sku})` : ''}</option>
                            ))}
                          </select>
                        ) : null}
                        {!line.part_id && (
                          <input
                            type="text"
                            value={line.part_name}
                            onChange={e => updateLine(idx, 'part_name', e.target.value)}
                            placeholder="Désignation"
                            className={INPUT_CLS + (parts.length > 0 ? ' mt-1' : '')}
                          />
                        )}
                      </div>
                      <input
                        type="number" min="1"
                        value={line.qty_ordered}
                        onChange={e => updateLine(idx, 'qty_ordered', e.target.value)}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-3 py-2
                                   text-white text-sm focus:outline-none focus:border-amber-500/50 text-center"
                      />
                      <input
                        type="number" min="0" step="0.01"
                        value={line.unit_price}
                        onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                        placeholder="P.U."
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2
                                   text-white text-sm placeholder-gray-600 focus:outline-none
                                   focus:border-amber-500/50"
                      />
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(idx)}
                          className="text-gray-600 hover:text-red-400 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={INPUT_CLS + ' resize-none'}
                  placeholder="Instructions, délais, conditions particulières…"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex gap-3">
              <button
                type="submit" disabled={saving}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm
                           font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Création…</>
                  : 'Créer la commande'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm
                           rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* ── Onglet Import IA ── */}
        {tab === 'ai' && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Explication */}
            <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20
                            rounded-xl p-4">
              <ClipboardPaste className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-sm font-semibold">Comment ça marche ?</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Copiez le texte d'une page produit Mobilax (ou tout autre fournisseur) —
                  nom des pièces, références, prix — et collez-le ci-dessous.
                  L'IA extrait automatiquement toutes les lignes de commande.
                </p>
              </div>
            </div>

            {/* Zone de collage */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Texte copié depuis Mobilax / GSM55 / autre
              </label>
              <textarea
                value={rawText}
                onChange={e => { setRawText(e.target.value); setParsedLines(null); setParseError(null) }}
                rows={7}
                className={INPUT_CLS + ' resize-none font-mono text-xs leading-relaxed'}
                placeholder={'Exemple :\n\nÉcran complet iPhone 14 Pro — Réf. IPH14P-SCR-BLK — 89,90 €\nBatterie Samsung S22 — Réf. SS22-BAT — 24,50 €\nVitre arrière Google Pixel 7a ×2 — 18,00 €'}
              />
            </div>

            {/* Bouton analyser */}
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || !rawText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400
                         text-white text-sm font-semibold rounded-lg transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {parsing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…</>
                : <><Sparkles className="w-4 h-4" /> Analyser avec l'IA</>}
            </button>

            {/* Erreur d'analyse */}
            {parseError && (
              <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{parseError}</p>
            )}

            {/* Résultats d'analyse */}
            {parsedLines !== null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                    {parsedLines.length === 0
                      ? 'Aucune pièce détectée'
                      : `${parsedLines.length} pièce${parsedLines.length > 1 ? 's' : ''} détectée${parsedLines.length > 1 ? 's' : ''}`}
                  </p>
                  {parsedLines.length > 0 && (
                    <span className="text-[10px] text-gray-600">Modifiez avant d'importer si besoin</span>
                  )}
                </div>

                {parsedLines.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">
                    Essayez avec un texte contenant des noms de pièces, références et/ou prix.
                  </p>
                ) : (
                  <>
                    {/* En-têtes colonnes */}
                    <div className="grid grid-cols-[1fr_80px_80px_28px] gap-2 px-1">
                      {['Désignation', 'Qté', 'P.U. HT', ''].map(h => (
                        <span key={h} className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">{h}</span>
                      ))}
                    </div>

                    {parsedLines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_80px_80px_28px] gap-2 items-center
                                                 bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                        <input
                          type="text"
                          value={line.part_name}
                          onChange={e => updateParsed(idx, 'part_name', e.target.value)}
                          className="bg-transparent text-gray-200 text-xs focus:outline-none
                                     border-b border-transparent focus:border-white/20 transition-colors"
                        />
                        <input
                          type="number" min="1"
                          value={line.qty ?? 1}
                          onChange={e => updateParsed(idx, 'qty', e.target.value)}
                          className="bg-white/5 border border-white/10 rounded px-2 py-1
                                     text-white text-xs text-center focus:outline-none
                                     focus:border-amber-500/40 w-full"
                        />
                        <input
                          type="number" min="0" step="0.01"
                          value={line.unit_price ?? ''}
                          onChange={e => updateParsed(idx, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          className="bg-white/5 border border-white/10 rounded px-2 py-1
                                     text-white text-xs focus:outline-none focus:border-amber-500/40 w-full"
                        />
                        <button type="button" onClick={() => removeParsed(idx)}
                          className="text-gray-700 hover:text-red-400 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Bouton importer */}
                    <button
                      type="button"
                      onClick={importParsedLines}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5
                                 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold
                                 rounded-lg transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Utiliser ces {parsedLines.length} ligne{parsedLines.length > 1 ? 's' : ''} →
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------
export default function CommandesPage() {
  const supabase = getSupabaseClient()

  const [shopId,    setShopId]    = useState(null)
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter,    setFilter]    = useState('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      await loadOrders(shop.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadOrders = async (sid) => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        id, order_number, supplier_name, status, total_amount,
        ordered_at, expected_at, created_at,
        purchase_order_lines(id)
      `)
      .eq('shop_id', sid)
      .order('created_at', { ascending: false })

    setOrders(data ?? [])
  }

  const statuses = ['all', ...Object.keys(STATUS_CONFIG)]

  const filtered = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Modale création */}
      {showModal && shopId && (
        <NewOrderModal
          shopId={shopId}
          onClose={() => setShowModal(false)}
          onCreated={() => loadOrders(shopId)}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            Commandes fournisseurs
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} commande{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle commande
        </button>
      </div>

      {/* Filtres statut */}
      <div className="flex flex-wrap gap-2">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${filter === s
                ? 'bg-amber-500 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {s === 'all' ? 'Toutes' : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* Table des commandes */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center
                        bg-[#111118] border border-white/10 rounded-xl">
          <ShoppingCart className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">Aucune commande</p>
          <p className="text-xs text-gray-700 mt-1">Créez votre première commande fournisseur</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white
                       text-sm font-semibold rounded-lg transition-colors"
          >
            + Nouvelle commande
          </button>
        </div>
      ) : (
        <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['N° commande', 'Fournisseur', 'Statut', 'Lignes', 'Montant', 'Date commande', 'Livraison prévue', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-600
                                           uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(order => (
                  <tr key={order.id} className="hover:bg-white/3 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-amber-400 whitespace-nowrap">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-gray-200 font-medium">{order.supplier_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-gray-400 text-center">
                      {order.purchase_order_lines?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                      {order.total_amount != null
                        ? `${parseFloat(order.total_amount).toFixed(2)} €`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDate(order.ordered_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDate(order.expected_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/commandes/${order.id}`}
                        className="flex items-center justify-center w-7 h-7 rounded-lg
                                   text-gray-700 group-hover:text-amber-400 hover:bg-white/5
                                   transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

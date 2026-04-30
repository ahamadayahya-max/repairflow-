'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  FileText, Plus, Search, Download, Trash2, Send, CheckCircle2,
  Copy, ArrowRight, Loader2, RefreshCw, Eye,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  draft:     { label: 'Brouillon',  color: 'text-gray-400',   bg: 'bg-gray-400/10'   },
  sent:      { label: 'Envoyé',     color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
  accepted:  { label: 'Accepté',    color: 'text-green-400',  bg: 'bg-green-400/10'  },
  refused:   { label: 'Refusé',     color: 'text-red-400',    bg: 'bg-red-400/10'    },
  expired:   { label: 'Expiré',     color: 'text-orange-400', bg: 'bg-orange-400/10' },
  converted: { label: 'Converti',   color: 'text-amber-400',  bg: 'bg-amber-400/10'  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function DevisPage() {
  const supabase = getSupabaseClient()

  const [shopId,   setShopId]   = useState(null)
  const [quotes,   setQuotes]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [statusF,  setStatusF]  = useState('all')
  const [flash,    setFlash]    = useState(null)
  const [deleting, setDeleting] = useState(null)

  // ---------------------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------------------

  const load = useCallback(async (sid) => {
    const id = sid ?? shopId
    if (!id) return
    setLoading(true)
    const { data } = await supabase
      .from('quotes')
      .select(`
        id, quote_number, status, valid_until, total_ttc, total_ht,
        discount_amount, created_at,
        clients!quotes_client_id_fkey(full_name, phone)
      `)
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)
      load(shop.id)
    }
    init()
  }, [])

  // ---------------------------------------------------------------------------
  // Flash
  // ---------------------------------------------------------------------------

  function showFlash(type, msg) {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 3000)
  }

  // ---------------------------------------------------------------------------
  // Filtrage
  // ---------------------------------------------------------------------------

  const filtered = quotes.filter(q => {
    if (statusF !== 'all' && q.status !== statusF) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        q.quote_number?.toLowerCase().includes(s) ||
        q.clients?.full_name?.toLowerCase().includes(s)
      )
    }
    return true
  })

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleDelete(q) {
    if (!window.confirm(`Supprimer le devis ${q.quote_number} ?`)) return
    setDeleting(q.id)
    const { error } = await supabase.from('quotes').delete().eq('id', q.id)
    if (error) showFlash('error', error.message)
    else { showFlash('success', 'Devis supprimé'); load() }
    setDeleting(null)
  }

  async function handleDuplicate(q) {
    if (!shopId) return
    try {
      const { data: numData, error: numErr } = await supabase.rpc('next_document_number', {
        p_shop_id: shopId, p_type: 'quote',
      })
      if (numErr) throw numErr

      const { data: newQ, error: qErr } = await supabase.from('quotes').insert({
        shop_id:         shopId,
        client_id:       q.client_id,
        quote_number:    numData,
        status:          'draft',
        labour_cost:     q.labour_cost || 0,
        parts_cost:      q.parts_cost  || 0,
        discount_amount: q.discount_amount || 0,
        tax_rate:        q.tax_rate || 20,
        notes:           q.notes,
        valid_until:     new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      }).select().single()
      if (qErr) throw qErr

      // Duplique les lignes
      const { data: srcLines } = await supabase
        .from('quote_lines')
        .select('description, quantity, unit_price, line_type, part_id, sort_order')
        .eq('quote_id', q.id)

      if (srcLines?.length) {
        await supabase.from('quote_lines').insert(
          srcLines.map(l => ({ ...l, quote_id: newQ.id }))
        )
      }

      showFlash('success', `Devis ${numData} créé`)
      load()
    } catch (err) {
      showFlash('error', err.message)
    }
  }

  async function handleMarkAccepted(q) {
    const { error } = await supabase.from('quotes').update({
      status: 'accepted', accepted_at: new Date().toISOString(),
    }).eq('id', q.id)
    if (error) showFlash('error', error.message)
    else { showFlash('success', 'Devis marqué accepté'); load() }
  }

  async function handleDownloadPDF(q) {
    try {
      const { data: lines } = await supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', q.id)
        .order('sort_order')

      const { data: clientData } = q.client_id
        ? await supabase.from('clients').select('*').eq('id', q.client_id).single()
        : { data: null }

      const { data: shopData } = await supabase
        .from('shops')
        .select('name, address, phone, email')
        .eq('id', shopId)
        .single()

      const [{ default: QuotePDF }, { pdf }] = await Promise.all([
        import('@/components/admin/pdf/QuotePDF'),
        import('@react-pdf/renderer'),
      ])

      const { createElement } = await import('react')
      const blob = await pdf(createElement(QuotePDF, {
        quote: q, lines: lines || [], shop: shopData || {}, client: clientData || {},
      })).toBlob()

      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `devis-${q.quote_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showFlash('error', 'Erreur PDF : ' + err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">

      {/* Flash */}
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${flash.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {flash.msg}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Devis
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} devis</p>
        </div>
        <Link
          href="/admin/devis/nouveau"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                     text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau devis
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-[#111118] border border-white/10 rounded-xl pl-9 pr-3 py-2
                       text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/40"
          />
        </div>
        <select
          value={statusF}
          onChange={e => setStatusF(e.target.value)}
          className="bg-[#111118] border border-white/10 rounded-xl px-3 py-2 text-sm
                     text-gray-200 focus:outline-none focus:border-amber-500/40"
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white
                     bg-white/5 border border-white/10 rounded-xl transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-500">
              {quotes.length === 0 ? 'Aucun devis pour le moment' : 'Aucun résultat'}
            </p>
            {quotes.length === 0 && (
              <Link href="/admin/devis/nouveau" className="mt-3 text-xs text-amber-400 hover:text-amber-300">
                Créer le premier devis →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Numéro', 'Client', 'Montant TTC', 'Statut', 'Validité', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(q => (
                  <tr key={q.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3">
                      <Link href={`/admin/devis/${q.id}`}
                        className="font-mono text-amber-400 hover:text-amber-300 text-xs font-medium">
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-200">{q.clients?.full_name || '—'}</p>
                      <p className="text-xs text-gray-600">{q.clients?.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-200 font-medium">
                      {eur(q.total_ttc)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(q.valid_until)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/admin/devis/${q.id}`}
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          title="Voir / Éditer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {q.status === 'sent' && (
                          <button
                            onClick={() => handleMarkAccepted(q)}
                            className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                            title="Marquer accepté"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPDF(q)}
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="Télécharger PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(q)}
                          className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                          title="Dupliquer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {q.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(q)}
                            disabled={deleting === q.id}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {q.status === 'accepted' && (
                          <Link
                            href={`/admin/factures/nouvelle?quote=${q.id}`}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
                                       text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 rounded-lg transition-colors"
                            title="Convertir en facture"
                          >
                            <ArrowRight className="w-3 h-3" />
                            Facturer
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

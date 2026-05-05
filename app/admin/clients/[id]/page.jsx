'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Save,
  Loader2, Ticket, FileText, Receipt, Plus,
  Wrench, CheckCircle2, Clock, Truck, CalendarDays,
  AlertTriangle, ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TICKET_STATUS = {
  pending:   { label: 'En attente',    color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  in_repair: { label: 'En réparation', color: 'text-blue-400',   bg: 'bg-blue-400/10'  },
  ready:     { label: 'Prêt',          color: 'text-green-400',  bg: 'bg-green-400/10' },
  delivered: { label: 'Livré',         color: 'text-gray-400',   bg: 'bg-gray-400/10'  },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function eur(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const INPUT_CLS = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

/**
 * Page de détail d'un client — fiche, historique tickets, devis et factures.
 */
export default function ClientDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [shopId,   setShopId]   = useState(null)
  const [client,   setClient]   = useState(null)
  const [tickets,  setTickets]  = useState([])
  const [quotes,   setQuotes]   = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [flash,    setFlash]    = useState(null)

  // Formulaire d'édition
  const [form, setForm] = useState({
    full_name: '',
    phone:     '',
    email:     '',
    address:   '',
  })

  // ---------------------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------------------

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shop } = await supabase
      .from('shops').select('id').eq('owner_id', user.id).single()
    if (!shop) { setLoading(false); return }
    setShopId(shop.id)

    // Charge le client + ses données liées en parallèle
    const [{ data: cli }, { data: tix }, { data: qts }, { data: inv }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).eq('shop_id', shop.id).single(),
      supabase.from('tickets')
        .select('id, status, device_type, device_brand, device_model, issue_desc, created_at, price_final, repair_cost')
        .eq('client_id', id)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
      supabase.from('quotes')
        .select('id, quote_number, status, total_ttc, created_at')
        .eq('client_id', id)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
      supabase.from('invoices')
        .select('id, invoice_number, status, total_ttc, total_net, created_at')
        .eq('client_id', id)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
    ])

    if (!cli) { router.replace('/admin/clients'); return }

    setClient(cli)
    setForm({
      full_name: cli.full_name ?? '',
      phone:     cli.phone     ?? '',
      email:     cli.email     ?? '',
      address:   cli.address   ?? '',
    })
    setTickets(tix  ?? [])
    setQuotes(qts   ?? [])
    setInvoices(inv ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // ---------------------------------------------------------------------------
  // Sauvegarde
  // ---------------------------------------------------------------------------

  async function handleSave(e) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setFlash({ type: 'error', text: 'Le nom du client est requis.' })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('clients')
      .update({
        full_name: form.full_name.trim(),
        phone:     form.phone.trim()   || null,
        email:     form.email.trim()   || null,
        address:   form.address.trim() || null,
      })
      .eq('id', id)

    if (error) {
      setFlash({ type: 'error', text: 'Erreur lors de la sauvegarde.' })
    } else {
      setFlash({ type: 'success', text: '✅ Fiche client mise à jour' })
      await loadAll()
    }
    setSaving(false)
    setTimeout(() => setFlash(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Statistiques agrégées
  // ---------------------------------------------------------------------------

  const totalDepense = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + Number(i.total_net ?? i.total_ttc ?? 0), 0)

  const ticketsActifs = tickets.filter(t => t.status !== 'delivered').length

  // ---------------------------------------------------------------------------
  // Rendu chargement
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!client) return null

  return (
    <div className="space-y-5 max-w-5xl">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clients"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl">{client.full_name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Client depuis {fmtDate(client.created_at)}
          </p>
        </div>

        {/* CTA rapide */}
        <div className="ml-auto flex gap-2">
          <Link
            href={`/admin/tickets/new?clientId=${id}`}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau ticket
          </Link>
        </div>
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border
          ${flash.type === 'success'
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
          {flash.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {flash.text}
        </div>
      )}

      {/* Corps — 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── COLONNE GAUCHE : Fiche + stats ── */}
        <div className="space-y-4">

          {/* Statistiques client */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{tickets.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Ticket{tickets.length > 1 ? 's' : ''} total</p>
            </div>
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{ticketsActifs}</p>
              <p className="text-xs text-gray-500 mt-0.5">En cours</p>
            </div>
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-green-400">{eur(totalDepense)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Dépensé (payé)</p>
            </div>
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-300">{invoices.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Facture{invoices.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Formulaire fiche client */}
          <form onSubmit={handleSave} className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-amber-400" />
              Fiche client
            </h2>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Nom complet *</label>
              <input
                className={INPUT_CLS}
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Jean Dupont"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</span>
              </label>
              <input
                className={INPUT_CLS}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+33 6 00 00 00 00"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
              </label>
              <input
                className={INPUT_CLS}
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean@exemple.fr"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Adresse</span>
              </label>
              <textarea
                className={`${INPUT_CLS} resize-none`}
                rows={2}
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="1 rue de la Paix, 75001 Paris"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400
                         text-white font-semibold text-sm py-2.5 rounded-lg transition-colors
                         disabled:opacity-50"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
                : <><Save className="w-4 h-4" /> Enregistrer</>
              }
            </button>
          </form>
        </div>

        {/* ── COLONNE DROITE : Tickets, Devis, Factures ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tickets */}
          <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Tickets</span>
              <span className="ml-auto text-xs text-gray-600">{tickets.length}</span>
            </div>

            {tickets.length === 0 ? (
              <div className="py-10 text-center">
                <Ticket className="w-7 h-7 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Aucun ticket pour ce client</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {tickets.map(t => {
                  const st  = TICKET_STATUS[t.status] ?? TICKET_STATUS.pending
                  const dev = [t.device_brand, t.device_model].filter(Boolean).join(' ') || t.device_type
                  return (
                    <Link
                      key={t.id}
                      href={`/admin/tickets/${t.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-medium truncate">{dev}</p>
                        <p className="text-xs text-gray-500 truncate">{t.issue_desc}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(t.price_final || t.repair_cost) && (
                          <span className="text-xs text-gray-400">{eur(t.price_final ?? t.repair_cost)}</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                        <span className="text-xs text-gray-600 hidden sm:block">{fmtDate(t.created_at)}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Devis */}
          <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Devis</span>
              <span className="ml-auto text-xs text-gray-600">{quotes.length}</span>
            </div>

            {quotes.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-7 h-7 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Aucun devis pour ce client</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {quotes.map(q => (
                  <Link
                    key={q.id}
                    href={`/admin/devis/${q.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium">{q.quote_number}</p>
                      <p className="text-xs text-gray-500">{fmtDate(q.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-amber-400">{eur(q.total_ttc)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Factures */}
          <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Factures</span>
              <span className="ml-auto text-xs text-gray-600">{invoices.length}</span>
            </div>

            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <Receipt className="w-7 h-7 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Aucune facture pour ce client</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {invoices.map(inv => {
                  const statusCfg = {
                    draft:     { label: 'Brouillon',  color: 'text-gray-400',   bg: 'bg-gray-400/10'   },
                    sent:      { label: 'Envoyée',     color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
                    paid:      { label: 'Payée',       color: 'text-green-400',  bg: 'bg-green-400/10'  },
                    partial:   { label: 'Partiel',     color: 'text-amber-400',  bg: 'bg-amber-400/10'  },
                    overdue:   { label: 'En retard',   color: 'text-red-400',    bg: 'bg-red-400/10'    },
                    cancelled: { label: 'Annulée',     color: 'text-gray-600',   bg: 'bg-gray-600/10'   },
                  }[inv.status] ?? { label: inv.status, color: 'text-gray-400', bg: 'bg-gray-400/10' }

                  return (
                    <Link
                      key={inv.id}
                      href={`/admin/factures/${inv.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-medium">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-500">{fmtDate(inv.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-300">
                          {eur(inv.total_net ?? inv.total_ttc)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

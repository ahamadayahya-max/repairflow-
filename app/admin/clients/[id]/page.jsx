'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Save,
  Loader2, Ticket, FileText, Receipt, Plus,
  Wrench, CheckCircle2, AlertTriangle, ChevronRight,
  Archive, StickyNote,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { TICKET_STATUSES, issueFromTicket, priceFromTicket, formatEur, formatDate } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Styles communs
// ---------------------------------------------------------------------------
const INPUT_CLS = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

const INV_STATUS = {
  draft:     { label: 'Brouillon', textCls: 'text-gray-400',  bgCls: 'bg-gray-400/10'  },
  sent:      { label: 'Envoyée',   textCls: 'text-blue-400',  bgCls: 'bg-blue-400/10'  },
  paid:      { label: 'Payée',     textCls: 'text-green-400', bgCls: 'bg-green-400/10' },
  partial:   { label: 'Partiel',   textCls: 'text-amber-400', bgCls: 'bg-amber-400/10' },
  overdue:   { label: 'En retard', textCls: 'text-red-400',   bgCls: 'bg-red-400/10'   },
  cancelled: { label: 'Annulée',   textCls: 'text-gray-600',  bgCls: 'bg-gray-600/10'  },
}

/**
 * Page de détail d'un client.
 * L'archivage remplace la suppression — un client n'est jamais effacé.
 */
export default function ClientDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [client,   setClient]   = useState(null)
  const [tickets,  setTickets]  = useState([])
  const [quotes,   setQuotes]   = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [flash,    setFlash]    = useState(null)

  // Onglet actif dans la colonne droite
  const [activeTab, setActiveTab] = useState('tickets')

  // Archivage
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [archiveReason,     setArchiveReason]     = useState('')
  const [archiving,         setArchiving]         = useState(false)

  // Formulaire
  const [form, setForm] = useState({
    full_name: '',
    phone:     '',
    email:     '',
    address:   '',
    notes:     '',
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

    const [{ data: cli }, { data: tix }, { data: qts }, { data: inv }] = await Promise.all([
      supabase.from('clients')
        .select('id, full_name, phone, email, address, notes, created_at, archived')
        .eq('id', id).eq('shop_id', shop.id).single(),
      supabase.from('tickets')
        .select('id, status, device_type, device_brand, device_model, issue_desc, issue_description, created_at, price_final, repair_cost')
        .or(`client_id.eq.${id},contact_id.eq.${id}`)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
      supabase.from('quotes')
        .select('id, quote_number, status, total_ttc, created_at')
        .eq('client_id', id).eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
      supabase.from('invoices')
        .select('id, invoice_number, status, total_ttc, total_net, created_at')
        .eq('client_id', id).eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
    ])

    if (!cli) { router.replace('/admin/clients'); return }

    setClient(cli)
    setForm({
      full_name: cli.full_name ?? '',
      phone:     cli.phone     ?? '',
      email:     cli.email     ?? '',
      address:   cli.address   ?? '',
      notes:     cli.notes     ?? '',
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
      showFlash('error', 'Le nom du client est requis.')
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
        notes:     form.notes.trim()   || null,
      })
      .eq('id', id)

    if (error) {
      showFlash('error', 'Erreur lors de la sauvegarde.')
    } else {
      showFlash('success', '✅ Fiche client mise à jour')
      await loadAll()
    }
    setSaving(false)
  }

  function showFlash(type, text) {
    setFlash({ type, text })
    setTimeout(() => setFlash(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Archivage (jamais de suppression)
  // ---------------------------------------------------------------------------
  const ticketsActifs = tickets.filter(t => t.status !== 'delivered').length

  async function handleArchive() {
    setArchiving(true)
    try {
      const { error } = await supabase.rpc('archive_client', {
        p_client_id: id,
        p_reason:    archiveReason.trim() || 'Demande utilisateur',
      })
      if (error) throw new Error(error.message)
      router.push('/admin/clients')
    } catch (err) {
      showFlash('error', 'Erreur lors de l\'archivage : ' + err.message)
      setArchiving(false)
      setShowArchiveDialog(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Statistiques
  // ---------------------------------------------------------------------------
  const totalDepense = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + Number(i.total_net ?? i.total_ttc ?? 0), 0)

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!client) return null

  const TABS = [
    { key: 'tickets',  label: 'Tickets',  count: tickets.length,  icon: Ticket   },
    { key: 'devis',    label: 'Devis',    count: quotes.length,   icon: FileText  },
    { key: 'factures', label: 'Factures', count: invoices.length, icon: Receipt   },
  ]

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clients"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <User className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            {client.full_name}
            {client.archived && (
              <span className="text-xs font-medium text-orange-400 bg-orange-400/10
                               border border-orange-400/20 px-2 py-0.5 rounded-full">
                Archivé
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Client depuis {formatDate(client.created_at)}
          </p>
        </div>

        {/* CTA */}
        <div className="ml-auto flex gap-2">
          <Link
            href={`/admin/tickets/new?clientId=${id}`}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau ticket
          </Link>
          {/* Archiver seulement si pas déjà archivé */}
          {!client.archived && (
            <button
              onClick={() => {
                // Empêche l'archivage si tickets actifs
                if (ticketsActifs > 0) {
                  showFlash('error', `Impossible d'archiver : ce client a ${ticketsActifs} ticket(s) en cours.`)
                  return
                }
                setArchiveReason('')
                setShowArchiveDialog(true)
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                         border border-orange-400/20 bg-orange-400/8 text-orange-400
                         hover:bg-orange-400/15 transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archiver
            </button>
          )}
        </div>
      </div>

      {/* ── Flash message ── */}
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

      {/* ── Corps — 2 colonnes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── COLONNE GAUCHE : Stats + formulaire ── */}
        <div className="space-y-4">

          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{tickets.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Ticket{tickets.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{ticketsActifs}</p>
              <p className="text-xs text-gray-500 mt-0.5">En cours</p>
            </div>
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-base font-bold text-green-400 break-all">{formatEur(totalDepense)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Dépensé</p>
            </div>
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-300">{invoices.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Facture{invoices.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Formulaire fiche client */}
          <form onSubmit={handleSave} className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              Fiche client
            </h2>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Nom complet *</label>
              <input className={INPUT_CLS} value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Jean Dupont" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Phone className="w-3 h-3" /> Téléphone
              </label>
              <input className={INPUT_CLS} value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+33 6 00 00 00 00" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input className={INPUT_CLS} type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean@exemple.fr" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Adresse
              </label>
              <textarea className={`${INPUT_CLS} resize-none`} rows={2} value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="1 rue de la Paix, 75001 Paris" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                <StickyNote className="w-3 h-3" /> Notes internes
              </label>
              <textarea className={`${INPUT_CLS} resize-none`} rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes visibles uniquement par l'équipe…" />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400
                         text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
                : <><Save className="w-4 h-4" /> Enregistrer</>}
            </button>
          </form>
        </div>

        {/* ── COLONNE DROITE : Onglets Tickets / Devis / Factures ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Onglets */}
          <div className="flex gap-1 bg-white/4 p-1 rounded-xl border border-white/8">
            {TABS.map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg
                            text-xs font-medium transition-colors
                            ${activeTab === key
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                              : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                    ${activeTab === key ? 'bg-amber-500/30' : 'bg-white/8'}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contenu onglet Tickets */}
          {activeTab === 'tickets' && (
            <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
              {tickets.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="w-6 h-6 text-gray-600" />}
                  title="Aucun ticket pour ce client"
                  actionLabel="Créer un ticket"
                  actionHref={`/admin/tickets/new?clientId=${id}`}
                  compact
                />
              ) : (
                <div className="divide-y divide-white/5">
                  {tickets.map(t => {
                    const st  = TICKET_STATUSES[t.status] ?? TICKET_STATUSES.pending
                    const dev = [t.device_brand, t.device_model].filter(Boolean).join(' ') || t.device_type
                    const price = priceFromTicket(t)
                    return (
                      <Link key={t.id} href={`/admin/tickets/${t.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors group">
                        <div
                          className="w-1.5 h-9 rounded-full flex-shrink-0"
                          style={{ background: st.color, boxShadow: `0 0 6px ${st.color}50` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 font-medium truncate">{dev}</p>
                          <p className="text-xs text-gray-500 truncate">{issueFromTicket(t)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {price > 0 && (
                            <span className="text-xs text-gray-400">{formatEur(price)}</span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bgCls} ${st.textCls}`}>
                            {st.label}
                          </span>
                          <span className="text-xs text-gray-600 hidden sm:block">{formatDate(t.created_at)}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Contenu onglet Devis */}
          {activeTab === 'devis' && (
            <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
              {quotes.length === 0 ? (
                <EmptyState
                  icon={<FileText className="w-6 h-6 text-gray-600" />}
                  title="Aucun devis pour ce client"
                  compact
                />
              ) : (
                <div className="divide-y divide-white/5">
                  {quotes.map(q => (
                    <Link key={q.id} href={`/admin/devis/${q.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 font-medium">{q.quote_number}</p>
                        <p className="text-xs text-gray-500">{formatDate(q.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-amber-400">{formatEur(q.total_ttc)}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contenu onglet Factures */}
          {activeTab === 'factures' && (
            <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
              {invoices.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="w-6 h-6 text-gray-600" />}
                  title="Aucune facture pour ce client"
                  compact
                />
              ) : (
                <div className="divide-y divide-white/5">
                  {invoices.map(inv => {
                    const st = INV_STATUS[inv.status] ?? { label: inv.status, textCls: 'text-gray-400', bgCls: 'bg-gray-400/10' }
                    return (
                      <Link key={inv.id} href={`/admin/factures/${inv.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 font-medium">{inv.invoice_number}</p>
                          <p className="text-xs text-gray-500">{formatDate(inv.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold text-gray-300">
                            {formatEur(inv.total_net ?? inv.total_ttc)}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bgCls} ${st.textCls}`}>
                            {st.label}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modale d'archivage ── */}
      {showArchiveDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !archiving) setShowArchiveDialog(false) }}
        >
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10"
               style={{ background: '#111118' }}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-orange-400/10 flex items-center justify-center">
                <Archive className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">
              Archiver ce client ?
            </h3>
            <p className="text-sm text-gray-400 text-center mb-4 leading-relaxed">
              <strong className="text-gray-200">{client.full_name}</strong> sera masqué de la liste principale
              mais conservé dans l'historique. Ses données restent intactes.
            </p>
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-500 mb-1.5 block uppercase tracking-wide">
                Raison (optionnel)
              </label>
              <input
                type="text"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder="Ex : client parti, doublon…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                           text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-400/40"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold
                           py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {archiving ? 'Archivage…' : 'Archiver'}
              </button>
              <button
                onClick={() => setShowArchiveDialog(false)}
                disabled={archiving}
                className="flex-1 bg-white/5 border border-white/10 text-gray-300 font-medium
                           py-2.5 rounded-xl text-sm transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

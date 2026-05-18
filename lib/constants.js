/**
 * Constantes et helpers partagés dans toute l'application TickeeFlow.
 * Importer depuis '@/lib/constants' dans tous les composants.
 */

// ---------------------------------------------------------------------------
// Statuts de tickets — source de vérité unique
// ---------------------------------------------------------------------------
export const TICKET_STATUSES = {
  pending: {
    label:    'En attente',
    color:    '#f59e0b',
    icon:     '📥',
    bg:       'rgba(245,158,11,0.1)',
    textCls:  'text-yellow-400',
    bgCls:    'bg-yellow-400/10',
    borderCls:'border-yellow-400/20',
  },
  in_repair: {
    label:    'En réparation',
    color:    '#3b82f6',
    icon:     '🔧',
    bg:       'rgba(59,130,246,0.1)',
    textCls:  'text-blue-400',
    bgCls:    'bg-blue-400/10',
    borderCls:'border-blue-400/20',
  },
  ready: {
    label:    'Prêt',
    color:    '#10b981',
    icon:     '✅',
    bg:       'rgba(16,185,129,0.1)',
    textCls:  'text-green-400',
    bgCls:    'bg-green-400/10',
    borderCls:'border-green-400/20',
  },
  delivered: {
    label:    'Livré',
    color:    '#6b7280',
    icon:     '📤',
    bg:       'rgba(107,114,128,0.1)',
    textCls:  'text-gray-400',
    bgCls:    'bg-gray-400/10',
    borderCls:'border-gray-400/20',
  },
}

// ---------------------------------------------------------------------------
// Statuts de factures — source de vérité unique
// ---------------------------------------------------------------------------
export const INVOICE_STATUSES = {
  draft:     { label: 'Brouillon',  color: '#6b7280', textCls: 'text-gray-400',   bgCls: 'bg-gray-400/10'   },
  sent:      { label: 'Envoyée',    color: '#3b82f6', textCls: 'text-blue-400',   bgCls: 'bg-blue-400/10'   },
  paid:      { label: 'Payée',      color: '#10b981', textCls: 'text-green-400',  bgCls: 'bg-green-400/10'  },
  partial:   { label: 'Partiel',    color: '#f59e0b', textCls: 'text-amber-400',  bgCls: 'bg-amber-400/10'  },
  overdue:   { label: 'En retard',  color: '#ef4444', textCls: 'text-red-400',    bgCls: 'bg-red-400/10'    },
  cancelled: { label: 'Annulée',    color: '#4b5563', textCls: 'text-gray-600',   bgCls: 'bg-gray-600/10'   },
}

// ---------------------------------------------------------------------------
// Helpers de normalisation des données ticket
// Utilisés pour gérer les deux colonnes concurrentes en base
// ---------------------------------------------------------------------------

/**
 * Retourne la description de panne, en préférant issue_description.
 * @param {object} ticket
 * @returns {string}
 */
export function issueFromTicket(ticket) {
  return ticket?.issue_description ?? ticket?.issue_desc ?? '—'
}

/**
 * Retourne le prix de réparation, en préférant price_final.
 * @param {object} ticket
 * @returns {number}
 */
export function priceFromTicket(ticket) {
  return ticket?.price_final ?? ticket?.repair_cost ?? 0
}

/**
 * Retourne l'objet client associé à un ticket.
 * Gère les deux clés FK possibles (client_id / contact_id).
 * @param {object} ticket
 * @returns {object|null}
 */
export function clientFromTicket(ticket) {
  return ticket?.clients ?? ticket?.client ?? null
}

/**
 * Retourne le nom affiché du client d'un ticket.
 * @param {object} ticket
 * @returns {string}
 */
export function clientNameFromTicket(ticket) {
  const c = clientFromTicket(ticket)
  if (!c) return '—'
  return c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ') ?? '—'
}

// ---------------------------------------------------------------------------
// Helpers de formatage
// ---------------------------------------------------------------------------

/**
 * Formate un nombre en euros.
 * @param {number|string|null} n
 * @returns {string}
 */
export function formatEur(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
  })
}

/**
 * Formate une date en format court français.
 * @param {string|null} d
 * @returns {string}
 */
export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

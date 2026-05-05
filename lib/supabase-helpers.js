/**
 * Helpers Supabase partagés côté client.
 * Fournit des utilitaires de formatage et des fonctions de récupération
 * courantes pour éviter la duplication dans les pages admin.
 */

import { getSupabaseClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

/**
 * Formate un nombre en euros.
 * @param {number|string|null} n
 * @returns {string}
 */
export function fmtPrice(n) {
  return Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'
}

/**
 * Formate une date ISO en date courte française.
 * @param {string|null} d
 * @param {{ weekday?: boolean, time?: boolean }} opts
 * @returns {string}
 */
export function fmtDate(d, opts = {}) {
  if (!d) return '—'
  try {
    const date = new Date(d)
    /** @type {Intl.DateTimeFormatOptions} */
    const options = { day: '2-digit', month: 'short', year: 'numeric' }
    if (opts.weekday) options.weekday = 'short'
    if (opts.time)    { options.hour = '2-digit'; options.minute = '2-digit' }
    return date.toLocaleDateString('fr-FR', options)
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// Mapping statut tickets
// ---------------------------------------------------------------------------

/** @type {Record<string, { label: string, color: string, bg: string }>} */
export const TICKET_STATUS = {
  pending:   { label: 'En attente',    color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  in_repair: { label: 'En réparation', color: 'text-blue-400',   bg: 'bg-blue-400/10'  },
  ready:     { label: 'Prêt',          color: 'text-green-400',  bg: 'bg-green-400/10' },
  delivered: { label: 'Livré',         color: 'text-gray-400',   bg: 'bg-gray-400/10'  },
}

// ---------------------------------------------------------------------------
// Fonctions de récupération shop
// ---------------------------------------------------------------------------

/**
 * Retourne le shop_id de l'utilisateur connecté.
 * @returns {Promise<string|null>}
 */
export async function getShopId() {
  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  return shop?.id ?? null
}

/**
 * Retourne les données complètes du shop de l'utilisateur connecté.
 * @param {string} [fields='*']
 * @returns {Promise<object|null>}
 */
export async function getShop(fields = '*') {
  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: shop } = await supabase
    .from('shops')
    .select(fields)
    .eq('owner_id', user.id)
    .maybeSingle()
  return shop ?? null
}

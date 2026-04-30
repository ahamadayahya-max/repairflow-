/**
 * Client Supabase côté navigateur — utilise la clé anon (publique).
 * À importer uniquement dans les Client Components ('use client').
 * Ne jamais y passer la service_role key.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Instance singleton pour éviter de recréer le client à chaque render
let _client = null

/**
 * Retourne le client Supabase navigateur (singleton).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return _client
}

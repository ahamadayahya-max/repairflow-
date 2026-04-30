/**
 * Client Supabase côté serveur — utilise la service_role key.
 * Ne jamais importer ce fichier dans un Client Component ('use client').
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Appelle une fonction RPC Supabase côté serveur (POST).
 *
 * @param {string} fnName       - Nom de la fonction RPC
 * @param {Record<string,unknown>} params - Paramètres JSON envoyés dans le body
 * @returns {Promise<{ data: unknown, error: string|null }>}
 */
export async function rpc(fnName, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
    // Pas de cache — les données de ticket doivent être fraîches à chaque requête
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return { data: null, error: `RPC ${fnName} erreur ${res.status}: ${text}` }
  }

  const data = await res.json()
  return { data, error: null }
}

/**
 * Requête REST sur une table Supabase côté serveur (GET).
 *
 * @param {string} table                   - Nom de la table
 * @param {Record<string,string>} [query]  - Filtres PostgREST (ex: { status: 'eq.pending' })
 * @returns {Promise<{ data: unknown, error: string|null }>}
 */
export async function from(table, query = {}) {
  const qs = new URLSearchParams(query)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return { data: null, error: `Table ${table} erreur ${res.status}: ${text}` }
  }

  const data = await res.json()
  return { data, error: null }
}

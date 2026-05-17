import { Wrench } from 'lucide-react'
import { rpc, from } from '@/lib/supabase/server'
import TrackingClient from './TrackingClient'

// ---------------------------------------------------------------------------
// Fetch du ticket via RPC Supabase (côté serveur, aucune auth requise)
// ---------------------------------------------------------------------------

/**
 * Appelle get_ticket_by_token et retourne le ticket ou null si introuvable.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function fetchTicket(token) {
  // p_token est le nom exact du paramètre dans la RPC Supabase
  const { data, error } = await rpc('get_ticket_by_token', { p_token: token })

  if (error) {
    console.error('[track] Erreur RPC get_ticket_by_token :', error)
    return null
  }

  // La RPC retourne null si le token est inconnu, ou un objet JSON sinon
  if (!data || (Array.isArray(data) && data.length === 0)) return null

  return Array.isArray(data) ? data[0] : data
}

// ---------------------------------------------------------------------------
// Metadata dynamique (noindex — données privées)
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }) {
  const { token } = await params
  const ticket    = await fetchTicket(token)
  const shopName  = ticket?.shop?.name ?? 'ReparFlow'

  return {
    title:       `Suivi de réparation #${token} — ${shopName}`,
    description: "Suivez l'avancement de la réparation de votre appareil en temps réel.",
    robots:      { index: false, follow: false },
  }
}

// ---------------------------------------------------------------------------
// Page 404 personnalisée (token inconnu)
// ---------------------------------------------------------------------------

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center px-4 text-center">

      <div className="flex items-center justify-center mb-8">
        <img src="/logo-light.png" alt="ReparFlow" style={{ height: 40, width: 'auto' }} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10 max-w-sm w-full">
        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Wrench className="w-7 h-7 text-amber-400" />
        </div>

        <h1 className="text-gray-900 font-bold text-xl mb-3">
          Lien introuvable
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Ce lien de suivi n&apos;existe pas ou a expiré.
          Vérifiez le SMS reçu ou contactez directement votre atelier de réparation.
        </p>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale — Server Component async
// ---------------------------------------------------------------------------

/**
 * Page de suivi public — accessible sans authentification.
 * Récupère le ticket + les infos de l'atelier via la RPC Supabase.
 * Passe les données au Client Component pour le polling et l'affichage.
 */
/**
 * Récupère les photos publiques avant/après d'un ticket via l'API REST PostgREST.
 * La RLS autorise la lecture anonyme pour les types 'before' et 'after'.
 * @param {string} ticketId
 * @returns {Promise<Array>}
 */
async function fetchPublicPhotos(ticketId) {
  try {
    const { data } = await from('ticket_photos', {
      select:    'id,url,thumbnail_url,type,taken_at',
      ticket_id: `eq.${ticketId}`,
      type:      'in.(before,after)',
      order:     'taken_at.asc',
    })
    return Array.isArray(data) ? data : []
  } catch {
    // Les photos sont optionnelles — ne jamais bloquer la page de suivi
    return []
  }
}

export default async function TrackPage({ params }) {
  const { token } = await params
  const result    = await fetchTicket(token)

  if (!result) return <NotFoundPage />

  // La RPC retourne { ticket: {...}, shop: {...} }
  // Si la structure est plate (future version), on extrait shop séparément
  const shop   = result.shop   ?? {}
  const ticket = result.ticket ?? result

  // Charge les photos avant/après pour l'affichage sur la page de suivi
  const photos = ticket.id ? await fetchPublicPhotos(ticket.id) : []

  return <TrackingClient ticket={ticket} shop={shop} photos={photos} />
}

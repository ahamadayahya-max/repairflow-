import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TrackingClient from '@/app/track/[token]/TrackingClient'

// Client serveur avec service_role pour bypasser les RLS sur la page publique
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Page publique de suivi de réparation — accessible sans authentification.
 * URL : /suivi/:token
 * Appelle la RPC get_ticket_by_token et délègue l'affichage à TrackingClient.
 *
 * @param {{ params: { token: string } }} props
 */
export default async function SuiviPage({ params }) {
  const { token } = await params

  const { data, error } = await supabase.rpc('get_ticket_by_token', {
    p_token: token,
  })

  // Token inconnu ou RPC en erreur → 404 propre
  if (error || !data) return notFound()

  // La RPC peut retourner un tableau ou un objet selon la version
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.ticket) return notFound()

  const { ticket, shop = {} } = result

  return <TrackingClient ticket={ticket} shop={shop} />
}

// Métadonnées dynamiques pour le SEO
export async function generateMetadata({ params }) {
  const { token } = await params
  return {
    title: `Suivi réparation · ${token}`,
    description: 'Suivez l\'avancement de votre réparation en temps réel.',
  }
}

import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * DELETE /api/tickets/[id]
 * Supprime définitivement un ticket et ses données liées.
 */
export async function DELETE(request, { params }) {
  const { id } = await params

  // Vérifie que le ticket existe avant de supprimer
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const [ticket] = await getRes.json()
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 })
  }

  // Supprime l'historique des statuts d'abord (contrainte FK)
  await fetch(
    `${SUPABASE_URL}/rest/v1/ticket_status_history?ticket_id=eq.${id}`,
    {
      method:  'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }
  )

  // Supprime le ticket
  const deleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}`,
    {
      method:  'DELETE',
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer:        'return=minimal',
      },
    }
  )

  if (!deleteRes.ok) {
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

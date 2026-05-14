import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
  apikey:        SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

/**
 * DELETE /api/tickets/[id]
 * Supprime définitivement un ticket.
 * Les tables liées sont gérées automatiquement par la base :
 *   CASCADE  → ticket_parts, ticket_photos, ticket_status_history
 *   SET NULL → appointments, invoices, quotes, sms_logs, intake_conversations
 */
export async function DELETE(request, { params }) {
  const { id } = await params

  // Vérifie que le ticket existe
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}&select=id`,
    { headers }
  )
  const [ticket] = await checkRes.json()
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 })
  }

  // Suppression — les contraintes FK CASCADE/SET NULL gèrent le reste
  const deleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}`,
    { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } }
  )

  if (!deleteRes.ok) {
    const body = await deleteRes.text()
    console.error('[ticket-delete]', body)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

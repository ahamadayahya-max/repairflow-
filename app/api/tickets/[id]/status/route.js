import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

// Transitions de statut autorisées (flux normal)
const TRANSITIONS = {
  pending:   'in_repair',
  in_repair: 'ready',
  ready:     'delivered',
}

// Tous les statuts valides (utilisés pour la correction admin)
const VALID_STATUSES = ['pending', 'in_repair', 'ready', 'delivered']

/**
 * PATCH /api/tickets/[id]/status
 * Body : { newStatus: string, force?: boolean, reason?: string }
 * - Sans force : valide la transition normale
 * - Avec force + reason : correction admin, accepte n'importe quel statut valide
 */
export async function PATCH(request, { params }) {
  const { id } = await params

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body invalide' }, { status: 400 })
  }

  const { newStatus, force = false, reason = '' } = body
  if (!newStatus) return NextResponse.json({ error: 'newStatus requis' }, { status: 400 })

  // Récupère le statut actuel
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}&select=status`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const [ticket] = await getRes.json()
  if (!ticket) return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 })

  if (force) {
    // Correction admin : statut doit être valide et différent du statut actuel
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 422 })
    }
    if (newStatus === ticket.status) {
      return NextResponse.json({ error: 'Le statut est déjà à cette valeur' }, { status: 422 })
    }
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'Un motif de correction est obligatoire (5 caractères min.)' }, { status: 422 })
    }
  } else {
    // Flux normal : valide la transition autorisée
    const allowed = TRANSITIONS[ticket.status]
    if (allowed !== newStatus) {
      return NextResponse.json(
        { error: `Transition interdite : ${ticket.status} → ${newStatus}` },
        { status: 422 }
      )
    }
  }

  // Met à jour le statut
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ status: newStatus }),
    }
  )

  if (!updateRes.ok) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: newStatus, forced: force })
}

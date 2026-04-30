import { createClient } from '@supabase/supabase-js'

// Client serveur pour invoquer l'Edge Function
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/sms
 * Proxy vers l'Edge Function send-sms.
 * Permet au frontend d'envoyer un SMS sans exposer la service_role key.
 *
 * Body : { ticket_id: string, template: string }
 */
export async function POST(req) {
  let ticket_id, template

  try {
    const body = await req.json()
    ticket_id  = body.ticket_id
    template   = body.template
  } catch {
    return Response.json({ error: 'Corps invalide' }, { status: 400 })
  }

  if (!ticket_id || !template) {
    return Response.json({ error: 'ticket_id et template requis' }, { status: 400 })
  }

  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: { ticket_id, template },
  })

  if (error) {
    console.error('[api/sms] Edge Function error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

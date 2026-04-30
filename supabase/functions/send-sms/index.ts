import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Edge Function : send-sms
// Envoie un SMS via Twilio et logue dans sms_logs.
//
// Variables d'environnement requises (Supabase Dashboard → Edge Functions → Secrets) :
//   TWILIO_ACCOUNT_SID  = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN   = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_PHONE_FROM   = +33xxxxxxxxx
// ---------------------------------------------------------------------------

const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID     = Deno.env.get('TWILIO_ACCOUNT_SID')     ?? 'TO_BE_CONFIGURED'
const TWILIO_AUTH_TOKEN      = Deno.env.get('TWILIO_AUTH_TOKEN')      ?? 'TO_BE_CONFIGURED'
const TWILIO_PHONE_FROM      = Deno.env.get('TWILIO_PHONE_FROM')      ?? 'TO_BE_CONFIGURED'
const TRACKING_BASE_URL      = 'https://repairflow-app.vercel.app/suivi'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ---------------------------------------------------------------------------
// Templates SMS
// ---------------------------------------------------------------------------

function buildMessage(template: string, ctx: {
  first_name:     string
  device_brand:   string
  shop_name:      string
  shop_phone:     string
  tracking_token: string
  price_estimate: number | null
}): string {
  const trackUrl = `${TRACKING_BASE_URL}/${ctx.tracking_token}`
  const prenom   = ctx.first_name   || 'Client'
  const device   = ctx.device_brand || 'votre appareil'
  const atelier  = ctx.shop_name    || 'notre atelier'

  const templates: Record<string, string> = {
    received: `Bonjour ${prenom}, votre ${device} a bien été déposé chez ${atelier}. Suivez votre réparation : ${trackUrl}`,
    in_repair: `Bonjour ${prenom}, votre ${device} est en cours de réparation chez ${atelier}. Suivi : ${trackUrl}`,
    ready: `Bonjour ${prenom}, votre ${device} est PRÊT ! Vous pouvez le récupérer chez ${atelier}. Tél : ${ctx.shop_phone || '—'}`,
    devis: `Bonjour ${prenom}, devis pour votre ${device} : ${ctx.price_estimate ?? '—'}€. Répondez OUI pour valider. Détail : ${trackUrl}`,
  }

  return templates[template] ?? `Bonjour ${prenom}, mise à jour de votre réparation. Suivi : ${trackUrl}`
}

// ---------------------------------------------------------------------------
// Envoi via l'API Twilio
// ---------------------------------------------------------------------------

async function sendViaTwilio(to: string, body: string) {
  // Numéro en format E.164 obligatoire
  const toClean = to.startsWith('+') ? to : `+33${to.replace(/^0/, '')}`

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: TWILIO_PHONE_FROM,
      To:   toClean,
      Body: body,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message ?? `Twilio error ${res.status}`)
  }
  return data.sid as string
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  let ticket_id: string
  let template:  string

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

  // Récupère le ticket + client + shop
  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select(`
      id, tracking_token, device_brand, device_model,
      price_estimate, shop_id,
      clients!tickets_client_id_fkey ( first_name, last_name, full_name, phone )
    `)
    .eq('id', ticket_id)
    .single()

  if (tErr || !ticket) {
    return Response.json({ error: 'Ticket introuvable' }, { status: 404 })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('name, phone')
    .eq('id', ticket.shop_id)
    .single()

  const client = (ticket as any).clients
  const phone  = client?.phone

  if (!phone) {
    return Response.json({ error: 'Numéro de téléphone client manquant' }, { status: 422 })
  }

  // Construction du message
  const message = buildMessage(template, {
    first_name:     client?.first_name || client?.full_name?.split(' ')[0] || '',
    device_brand:   ticket.device_brand ?? '',
    shop_name:      shop?.name          ?? '',
    shop_phone:     shop?.phone         ?? '',
    tracking_token: ticket.tracking_token,
    price_estimate: ticket.price_estimate,
  })

  let twilio_sid = null
  let status     = 'sent'

  // Envoi Twilio — si credentials non configurés, on logue sans envoyer
  if (TWILIO_ACCOUNT_SID === 'TO_BE_CONFIGURED') {
    console.log('[send-sms] Twilio non configuré — simulation :', message)
    status = 'simulated'
  } else {
    try {
      twilio_sid = await sendViaTwilio(phone, message)
    } catch (err: any) {
      console.error('[send-sms] Erreur Twilio :', err.message)
      status = 'error'
    }
  }

  // Log dans sms_logs
  await supabase.from('sms_logs').insert({
    ticket_id,
    shop_id:    ticket.shop_id,
    phone,
    template,
    message,
    twilio_sid,
    status,
  })

  return Response.json({ ok: true, status, twilio_sid }, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
})

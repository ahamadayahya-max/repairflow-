import { NextResponse }        from 'next/server'
import { sendEmail }            from '@/lib/notifications/sendEmail'
import { sendSms }              from '@/lib/notifications/sendSms'
import NOTIFICATION_TEMPLATES   from '@/lib/notifications/templates'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Récupère les données complètes d'un ticket (ticket + client + shop)
 * pour construire les variables des templates de notification.
 *
 * @param {string} ticketId
 * @returns {Promise<object|null>}
 */
async function fetchTicketData(ticketId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?id=eq.${ticketId}` +
    `&select=id,status,device_type,device_brand,device_model,tracking_token,` +
    `shop_id,clients!tickets_client_id_fkey(full_name,phone,email),` +
    `shops(name,phone,address,hours)`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const [ticket] = await res.json()
  return ticket ?? null
}

/**
 * POST /api/tickets/[id]/notify
 *
 * Body : {
 *   channel:   'email' | 'sms',
 *   template:  string   — clé du template (ex : 'in_repair', 'ready', 'received'…)
 *   customMsg?: string  — message libre (si template === 'custom')
 *   subject?:  string   — sujet email libre (si template === 'custom')
 * }
 */
export async function POST(request, { params }) {
  const { id } = await params

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body invalide' }, { status: 400 })
  }

  const { channel, template, customMsg = '', subject = '' } = body

  if (!['email', 'sms'].includes(channel)) {
    return NextResponse.json({ error: 'channel doit être "email" ou "sms"' }, { status: 400 })
  }

  // Récupère les données du ticket
  const ticket = await fetchTicketData(id)
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 })
  }

  const client   = ticket.clients
  const shop     = ticket.shops
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://repairflow-app.vercel.app'

  // Pas de données client dans les logs — vérification silencieuse
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (channel === 'email' && !client.email) {
    return NextResponse.json({ error: 'Le client n\'a pas d\'adresse email enregistrée' }, { status: 422 })
  }
  if (channel === 'sms' && !client.phone) {
    return NextResponse.json({ error: 'Le client n\'a pas de numéro de téléphone enregistré' }, { status: 422 })
  }

  // Variables communes pour les templates
  const vars = {
    client_name:    client.full_name?.split(' ')[0] ?? client.full_name ?? 'Client',
    device_type:    ticket.device_type  ?? '',
    device_brand:   ticket.device_brand ?? '',
    device_model:   ticket.device_model ?? '',
    device_label:   [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type,
    tracking_url:   `${appUrl}/track/${ticket.tracking_token}`,
    shop_name:      shop?.name    ?? 'Notre atelier',
    shop_phone:     shop?.phone   ?? '',
    shop_address:   shop?.address ?? '',
    shop_hours:     shop?.hours   ?? '',
    price_estimate: '—',
    price_final:    '—',
    estimated_date: '—',
    review_url:     '#',
  }

  // Message libre (template === 'custom')
  if (template === 'custom') {
    if (!customMsg.trim()) {
      return NextResponse.json({ error: 'Le message personnalisé est vide' }, { status: 422 })
    }

    if (channel === 'sms') {
      const result = await sendSms({ to: client.phone, content: customMsg.trim(), sender: shop?.name?.slice(0, 11) ?? 'ReparFlow' })
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
      return NextResponse.json({ success: true, channel: 'sms' })
    }

    const result = await sendEmail({
      to:      client.email,
      subject: subject.trim() || `Message de ${vars.shop_name}`,
      html:    `<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#374151;">${customMsg.trim().replace(/\n/g, '<br>')}</p>`,
    })
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, channel: 'email' })
  }

  // Template prédéfini
  const tmpl = NOTIFICATION_TEMPLATES[template]
  if (!tmpl) {
    return NextResponse.json({ error: `Template "${template}" introuvable` }, { status: 400 })
  }

  if (channel === 'sms') {
    const smsContent = tmpl.sms(vars)
    const result     = await sendSms({ to: client.phone, content: smsContent, sender: shop?.name?.slice(0, 11) ?? 'ReparFlow' })
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, channel: 'sms' })
  }

  // Email
  const emailSubject = tmpl.emailSubject(vars)
  const emailHtml    = tmpl.emailHtml(vars)
  const result       = await sendEmail({ to: client.email, subject: emailSubject, html: emailHtml })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true, channel: 'email' })
}

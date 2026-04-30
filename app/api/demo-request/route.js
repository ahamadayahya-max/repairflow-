import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/notifications/sendEmail'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
// Email de l'administrateur qui reçoit les demandes de démo
const ADMIN_EMAIL   = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'ahamada.yahya@gmail.com'

/**
 * POST /api/demo-request
 * Enregistre une demande de démo dans Supabase et envoie un email de notification
 * à l'administrateur RepairFlow.
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { prenom, nom_atelier, email, telephone, message } = body

    // Validation des champs obligatoires
    if (!prenom || !nom_atelier || !email || !telephone) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être renseignés.' },
        { status: 400 }
      )
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "L'adresse email fournie n'est pas valide." },
        { status: 400 }
      )
    }
    if (telephone.replace(/\s/g, '').length < 8) {
      return NextResponse.json(
        { error: "Le numéro de téléphone fourni n'est pas valide." },
        { status: 400 }
      )
    }

    // Insertion dans Supabase via service_role (bypass RLS)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/demo_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ prenom, nom_atelier, email, telephone, message }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[demo-request] Supabase insert error:', res.status, text)
      return NextResponse.json(
        { error: "L'envoi a échoué. Veuillez réessayer." },
        { status: 500 }
      )
    }

    // Notification email à l'administrateur — non bloquant
    sendEmail({
      to:      ADMIN_EMAIL,
      subject: `🔔 Nouvelle demande de démo — ${nom_atelier}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;">
          <h2 style="color:#F59E0B;">Nouvelle demande de démo RepairFlow</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#6B7280;width:140px;">Prénom</td><td style="padding:8px 0;font-weight:600;">${prenom}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280;">Atelier</td><td style="padding:8px 0;font-weight:600;">${nom_atelier}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#6B7280;">Téléphone</td><td style="padding:8px 0;"><a href="tel:${telephone}">${telephone}</a></td></tr>
            ${message ? `<tr><td style="padding:8px 0;color:#6B7280;vertical-align:top;">Message</td><td style="padding:8px 0;">${message}</td></tr>` : ''}
          </table>
          <p style="margin-top:24px;color:#9CA3AF;font-size:13px;">
            Demande reçue via repairflow-app.vercel.app — à rappeler sous 24h.
          </p>
        </div>
      `,
    }).catch(err => console.error('[demo-request] Erreur envoi email admin:', err.message))

    return NextResponse.json({ success: true, message: 'Demande envoyée avec succès.' })
  } catch (err) {
    console.error('[demo-request] Unexpected error:', err.message)
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    )
  }
}

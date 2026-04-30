import { NextResponse } from 'next/server'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * POST /api/demo-request
 * Enregistre une demande de démo dans Supabase (table demo_requests).
 * Pas de dépendance à Brevo — fonctionne immédiatement en production.
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

    return NextResponse.json({ success: true, message: 'Demande envoyée avec succès.' })
  } catch (err) {
    console.error('[demo-request] Unexpected error:', err.message)
    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    )
  }
}

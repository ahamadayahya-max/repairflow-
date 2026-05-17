import { NextResponse } from 'next/server'

const CORRECT_PASSWORD = 'ReparFlow2026!'
const COOKIE_NAME      = 'rf_access'
const COOKIE_VALUE     = 'rf_unlocked_2026'

/**
 * POST /api/maintenance-unlock
 * Vérifie le mot de passe de maintenance et pose un cookie sécurisé.
 */
export async function POST(req) {
  const { password } = await req.json()

  if (password !== CORRECT_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

  // Cookie httpOnly + SameSite pour la sécurité
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    // Expire dans 7 jours
    maxAge:   60 * 60 * 24 * 7,
  })

  return res
}

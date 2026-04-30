import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Middleware de maintenance — bloque l'accès à toute l'application.
// Déverrouillage via la page /maintenance avec le mot de passe.
//
// Cookie positionné côté client : rf_access = rf_unlocked_2026
// Mot de passe : RepairFlow2026!
// ---------------------------------------------------------------------------

const COOKIE_NAME  = 'rf_access'
const COOKIE_VALUE = 'rf_unlocked_2026'

// Chemins toujours autorisés (pas de redirect)
const ALWAYS_ALLOWED = [
  '/maintenance',
  '/api/maintenance-unlock',   // route pour poser le cookie
  '/api/auth',                 // reset password
  '/api/demo-request',         // formulaire de démo (public)
  '/track/',                   // page de suivi public (ancienne URL)
  '/suivi/',                   // page de suivi public (URL QR codes)
]

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Laisse passer les assets Next.js et les routes exemptées
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    ALWAYS_ALLOWED.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // Vérifie le cookie d'accès
  const cookie = request.cookies.get(COOKIE_NAME)
  if (cookie?.value === COOKIE_VALUE) {
    return NextResponse.next()
  }

  // Redirige vers la page de maintenance
  const url = request.nextUrl.clone()
  url.pathname = '/maintenance'
  return NextResponse.redirect(url)
}

export const config = {
  // Applique le middleware à toutes les routes sauf fichiers statiques
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}

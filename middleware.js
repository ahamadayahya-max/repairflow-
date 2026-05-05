import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Middleware — mode maintenance actif.
// Toute l'application est verrouillée sauf /maintenance et l'API de déverrouillage.
// Pour désactiver : remplacer le corps de middleware() par return NextResponse.next()
// ---------------------------------------------------------------------------

const COOKIE_NAME  = 'rf_access'
const COOKIE_VALUE = 'rf_unlocked_2026'

// Routes toujours accessibles même en maintenance
const ALWAYS_ALLOWED = [
  '/maintenance',
  '/api/maintenance-unlock',
  '/api/demo-request',
]

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Laisse passer les assets statiques et les routes toujours autorisées
  if (ALWAYS_ALLOWED.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Vérifie le cookie de déverrouillage
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
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}

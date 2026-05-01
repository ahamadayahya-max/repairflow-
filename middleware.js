import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Middleware — maintenance désactivée, site ouvert au public.
// Pour réactiver : décommenter le bloc ci-dessous et redéployer.
// ---------------------------------------------------------------------------

export function middleware(request) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}

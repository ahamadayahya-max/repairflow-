'use client'

import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// Hook useTheme — thème fixé en mode sombre uniquement
// Le mode clair et le mode système ont été supprimés volontairement.
// ---------------------------------------------------------------------------

/**
 * Hook de thème TickeeFlow — retourne toujours 'dark'.
 * @returns {{ theme: 'dark', resolved: 'dark', setTheme: Function }}
 */
export function useTheme() {
  // Applique data-theme="dark" sur <html> au montage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  // setTheme est un no-op — aucune option de changement de thème
  return { theme: 'dark', resolved: 'dark', setTheme: () => {} }
}

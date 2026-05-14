'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Hook useTheme — gestion du thème clair/sombre/système
// Persistance : localStorage (immédiat) + Supabase shops.theme (multi-appareils)
// ---------------------------------------------------------------------------

/**
 * Hook de gestion du thème RepairFlow.
 * @returns {{ theme: 'dark'|'light'|'system', resolved: 'dark'|'light', setTheme: Function }}
 */
export function useTheme() {
  const supabase = getSupabaseClient()

  // Lit le localStorage en premier pour éviter le flash au chargement
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('repairflow-theme') || 'dark'
  })

  // Thème réellement appliqué (résout 'system' → 'dark'|'light')
  const [resolved, setResolved] = useState('dark')

  // ---------------------------------------------------------------------------
  // Applique le data-theme sur <html> à chaque changement
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      setResolved(prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', theme)
      setResolved(theme)
    }
  }, [theme])

  // Écoute les changements de préférence système (uniquement si theme === 'system')
  useEffect(() => {
    if (theme !== 'system') return
    const mq      = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      setResolved(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // ---------------------------------------------------------------------------
  // Charge le thème depuis Supabase au montage (synchronisation multi-appareils)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadTheme() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('shops')
          .select('theme')
          .eq('owner_id', user.id)
          .maybeSingle()
        if (data?.theme && data.theme !== theme) {
          setThemeState(data.theme)
          localStorage.setItem('repairflow-theme', data.theme)
        }
      } catch {
        // Silencieux — le localStorage suffit en cas d'erreur réseau
      }
    }
    loadTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Setter public
  // ---------------------------------------------------------------------------
  async function setTheme(newTheme) {
    setThemeState(newTheme)
    localStorage.setItem('repairflow-theme', newTheme)

    // Sauvegarde en base pour la persistence multi-appareils
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('shops')
          .update({ theme: newTheme })
          .eq('owner_id', user.id)
      }
    } catch {
      // Silencieux — le localStorage suffit
    }
  }

  return { theme, resolved, setTheme }
}

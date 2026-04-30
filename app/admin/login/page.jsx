'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirection transparente vers la vraie page de connexion.
 * Cette route est conservée pour éviter les 404 sur d'anciens liens éventuels.
 */
export default function AdminLoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return null
}

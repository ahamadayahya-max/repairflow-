'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

// Valeur du cookie posée par la route API
const CORRECT_PASSWORD = 'TickeeFlow2026!'

/**
 * Page de maintenance — bloque l'accès à toute l'application.
 * Le bon mot de passe pose un cookie via /api/maintenance-unlock
 * et redirige vers l'accueil.
 */
export default function MaintenancePage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(false)
  const [dots,     setDots]     = useState('.')

  // Animation des points de suspension dans le titre
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600)
    return () => clearInterval(id)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(false)
    setLoading(true)

    if (password !== CORRECT_PASSWORD) {
      setError(true)
      setLoading(false)
      setPassword('')
      return
    }

    // Pose le cookie via la route API (httpOnly, secure)
    await fetch('/api/maintenance-unlock', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })

    // Redirige vers l'application
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                        bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/3 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center">

        {/* Icône animée */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center
                            border border-amber-500/20">
              <Wrench className="w-9 h-9 text-amber-400" />
            </div>
            {/* Indicateur "en cours" */}
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full
                            flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Titre */}
        <h1 className="text-white font-bold text-2xl mb-2">
          En travaux<span className="text-amber-400">{dots}</span>
        </h1>
        <p className="text-gray-500 text-sm mb-2">
          TickeeFlow est en cours de développement.
        </p>
        <p className="text-gray-600 text-xs mb-8">
          Revenez bientôt — l'application sera disponible très prochainement.
        </p>

        {/* Séparateur */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/5" />
          <Lock className="w-3.5 h-3.5 text-gray-700" />
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Formulaire accès admin */}
        <form onSubmit={handleSubmit} className="bg-[#111118] rounded-2xl border border-white/10 p-5">
          <p className="text-xs text-gray-500 mb-3">Accès administrateur</p>

          <div className="relative mb-3">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              placeholder="Mot de passe"
              autoComplete="current-password"
              className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 pr-10 text-sm text-white
                          placeholder-gray-600 outline-none transition-colors
                          ${error
                            ? 'border-red-500/50 bg-red-500/5'
                            : 'border-white/10 focus:border-amber-500/40'
                          }`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-red-500/10
                            border border-red-500/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs">Mot de passe incorrect</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40
                       text-white font-semibold text-sm rounded-lg py-2.5 transition-colors
                       flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</>
              : 'Accéder à l\'application'
            }
          </button>
        </form>

      </div>
    </div>
  )
}

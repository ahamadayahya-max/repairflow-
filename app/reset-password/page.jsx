'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Wrench, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Page de réinitialisation du mot de passe.
 * Accessible via le lien envoyé par email (Supabase injecte le token dans le hash de l'URL).
 * Appelle supabase.auth.updateUser() avec le nouveau mot de passe.
 */
export default function ResetPasswordPage() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [status,    setStatus]    = useState('idle')   // 'idle' | 'success' | 'error'
  const [error,     setError]     = useState(null)
  const [sessionOk, setSessionOk] = useState(false)   // Supabase a bien récupéré la session

  // Supabase gère automatiquement le token dans le hash de l'URL.
  // On écoute l'événement PASSWORD_RECOVERY pour confirmer que la session est active.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionOk(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setStatus('error')
      setLoading(false)
    } else {
      setStatus('success')
      // Redirige vers l'administration après 2 secondes
      setTimeout(() => router.replace('/admin'), 2000)
    }
  }

  const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
    placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/logo-dark.svg" alt="ReparFlow" style={{ height: 48, width: 'auto' }} />
        </div>

        <div className="bg-[#111118] rounded-2xl border border-white/10 p-6">

          {/* ── Succès ── */}
          {status === 'success' ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">Mot de passe mis à jour !</p>
              <p className="text-gray-400 text-sm">
                Vous allez être redirigé vers votre espace administration…
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Nouveau mot de passe</h1>
              <p className="text-gray-500 text-sm mb-6">
                Choisissez un mot de passe sécurisé d'au moins 8 caractères.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Nouveau mot de passe */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={8}
                      className={`${inputClass} pr-10`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmation */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConf ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConf(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Indicateur de correspondance */}
                  {confirm.length > 0 && (
                    <p className={`text-xs mt-1.5 ${password === confirm ? 'text-green-400' : 'text-red-400'}`}>
                      {password === confirm ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-xs">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || password !== confirm || password.length < 8}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white font-semibold text-sm rounded-lg py-2.5 transition-colors
                             flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Mise à jour…' : 'Définir le nouveau mot de passe'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

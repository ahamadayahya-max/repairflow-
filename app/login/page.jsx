'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Wrench, Loader2, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react'

/**
 * Page de connexion avec gestion intégrée du mot de passe oublié.
 * Deux modes : 'login' (formulaire normal) et 'forgot' (envoi du lien de réinitialisation).
 */
export default function LoginPage() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [mode, setMode] = useState('login')  // 'login' | 'forgot'

  // État connexion
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // État mot de passe oublié
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent,  setForgotSent]  = useState(false)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // ── Connexion ──
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      router.replace('/admin')
    }
  }

  // ── Envoi du lien de réinitialisation via notre Route Handler (Brevo) ──
  const handleForgot = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: forgotEmail.trim() }),
      })
    } catch {
      // Silencieux côté client — on affiche toujours le message de confirmation
    }

    setLoading(false)
    setForgotSent(true)
  }

  const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
    placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:bg-white/8 transition-colors`

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/logo-dark.png" alt="ReparFlow" style={{ height: 48, width: 'auto' }} />
        </div>

        <div className="bg-[#111118] rounded-2xl border border-white/10 p-6">

          {/* ── MODE CONNEXION ── */}
          {mode === 'login' && (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Connexion</h1>
              <p className="text-gray-500 text-sm mb-6">Accédez à votre espace administration.</p>

              <form onSubmit={handleLogin} className="space-y-4">

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="atelier@example.com"
                    className={inputClass}
                  />
                </div>

                <div>
                  {/* Label + lien "Mot de passe oublié ?" sur la même ligne */}
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-400">Mot de passe</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setForgotEmail(email)
                        setForgotSent(false)
                        setError(null)
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className={`${inputClass} pr-10`}
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

                {error && (
                  <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50
                             text-white font-semibold text-sm rounded-lg py-2.5 transition-colors
                             flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Connexion…' : 'Se connecter →'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-600 mt-5 pt-4 border-t border-white/5">
                Pas encore de compte ?{' '}
                <Link href="/register"
                  className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                  Essayez gratuitement 14 jours →
                </Link>
              </p>
            </>
          )}

          {/* ── MODE MOT DE PASSE OUBLIÉ ── */}
          {mode === 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => { setMode('login'); setForgotSent(false); setError(null) }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour à la connexion
              </button>

              <h1 className="text-white font-semibold text-lg mb-1">Mot de passe oublié</h1>
              <p className="text-gray-500 text-sm mb-6">
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>

              {forgotSent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-white text-sm font-medium mb-2">Email envoyé !</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Si cet email est associé à un compte, vous recevrez un lien dans quelques minutes.
                    <br />
                    <span className="text-gray-500 mt-1 block">Vérifiez aussi vos spams.</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotSent(false) }}
                    className="mt-5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      placeholder="atelier@example.com"
                      className={inputClass}
                      autoFocus
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50
                               text-white font-semibold text-sm rounded-lg py-2.5 transition-colors
                               flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
                  </button>
                </form>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

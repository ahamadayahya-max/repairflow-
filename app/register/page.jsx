'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Wrench, Loader2, Eye, EyeOff, CheckCircle2, ArrowRight, Shield } from 'lucide-react'

const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

/**
 * Page d'inscription — crée un compte Supabase Auth + un atelier associé.
 * Redirige vers /bienvenue (onboarding) après succès.
 */
export default function RegisterPage() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [shopName,  setShopName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [terms,     setTerms]     = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  // Indicateur de force du mot de passe
  function passwordStrength(pw) {
    let score = 0
    if (pw.length >= 8)  score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
  }
  const strength     = passwordStrength(password)
  const strengthLabel = ['', 'Faible', 'Correct', 'Bon', 'Fort'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-green-400'][strength]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (!shopName.trim()) {
      setError("Le nom de l'atelier est obligatoire.")
      return
    }
    if (!terms) {
      setError("Vous devez accepter les conditions d'utilisation.")
      return
    }

    setLoading(true)

    // 1. Création du compte Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { shop_name: shopName.trim() } },
    })

    if (authErr) {
      setError(authErr.message === 'User already registered'
        ? 'Un compte existe déjà avec cet email. Connectez-vous.'
        : authErr.message)
      setLoading(false)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setError('Erreur lors de la création du compte. Réessayez.')
      setLoading(false)
      return
    }

    // 2. Connexion immédiate si session non ouverte
    if (!authData.session) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr || !signInData.session) {
        setLoading(false)
        setError(`📧 Un email de confirmation a été envoyé à ${email}. Cliquez sur le lien reçu puis connectez-vous.`)
        return
      }
    }

    // 3. Création de l'atelier avec statut onboarding
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: shopErr } = await supabase
      .from('shops')
      .insert({
        owner_id:             userId,
        name:                 shopName.trim(),
        phone:                phone.trim() || null,
        plan:                 'starter',
        subscription_status:  'trial',
        trial_ends_at:        trialEnd,
        onboarding_completed: false,
        onboarding_step:      0,
      })

    if (shopErr) {
      console.error('[register] shop insert error:', shopErr.message)
      // Non bloquant — l'onboarding créera/corrigera si besoin
    }

    // 4. Redirection vers l'onboarding
    router.replace('/bienvenue')
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <Link href="/" className="flex items-center justify-center mb-8">
          <img src="/logo-dark.png" alt="ReparFlow" style={{ height: 48, width: 'auto' }} />
        </Link>

        <div className="bg-[#111118] rounded-2xl border border-white/10 p-6">
          <h1 className="text-white font-bold text-lg mb-1">Créer mon compte gratuitement</h1>
          <p className="text-gray-500 text-sm mb-5">Essai gratuit 14 jours · Sans CB</p>

          {/* Avantages */}
          <ul className="space-y-1.5 mb-6">
            {[
              'Tickets & suivi client inclus',
              'Notifications SMS & email automatiques',
              'Factures PDF + assistant IA',
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Nom de l'atelier */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Nom de votre atelier *
              </label>
              <input
                type="text"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                required
                placeholder="Ex : L'Atelier du Mobile"
                className={inputClass}
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Téléphone *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                placeholder="06 12 34 56 78"
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email professionnel *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="contact@votre-atelier.fr"
                className={inputClass}
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Mot de passe * <span className="text-gray-600">(8 caractères min.)</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Indicateur de force */}
              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors
                        ${i <= strength ? strengthColor : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-500">{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* Confirmer le mot de passe */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Confirmer le mot de passe *
              </label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`${inputClass} pr-10 ${confirm && confirm !== password ? 'border-red-500/40' : ''}`}
                />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirm && confirm !== password && (
                <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            {/* Checkbox CGU */}
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={terms}
                onChange={e => setTerms(e.target.checked)}
                className="mt-0.5 accent-amber-500"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                J'accepte les{' '}
                <span className="text-amber-400 hover:text-amber-300 transition-colors">
                  conditions d'utilisation
                </span>
                {' '}et la{' '}
                <span className="text-amber-400 hover:text-amber-300 transition-colors">
                  politique de confidentialité
                </span>
              </span>
            </label>

            {/* Erreur */}
            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold
                         text-sm rounded-lg py-2.5 transition-colors mt-1"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Création du compte…</>
                : <><ArrowRight className="w-4 h-4" /> Créer mon compte gratuitement →</>
              }
            </button>

            <p className="text-center text-[10px] text-gray-600 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Essai gratuit 14 jours · Sans carte bancaire
            </p>
          </form>

          <p className="text-center text-xs text-gray-600 mt-5 pt-4 border-t border-white/5">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Save, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff, ExternalLink, KeyRound, BadgeCheck, ToggleLeft, ToggleRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Onglet Configuration QualiRépar
// Permet à chaque atelier de configurer sa clé API AgoraPlus sans passer
// par la page Paramètres.
// ---------------------------------------------------------------------------

const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5'

/**
 * Formulaire de configuration du module QualiRépar pour l'atelier courant.
 * @param {{ shopId: string|null, onConfigSaved?: () => void }} props
 */
export default function QRSetup({ shopId, onConfigSaved }) {
  const supabase = getSupabaseClient()

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [testing,     setTesting]     = useState(false)
  const [msg,         setMsg]         = useState(null)

  const [active,      setActive]      = useState(false)
  const [apiKey,      setApiKey]      = useState('')
  const [labelNum,    setLabelNum]    = useState('')
  const [login,       setLogin]       = useState('')
  const [showKey,     setShowKey]     = useState(false)

  // ── Chargement de la config existante ──
  useEffect(() => {
    if (!shopId) return
    supabase
      .from('qualirepar_shop_config')
      .select('active, agoraplus_key_ref, qualirepar_label_num, agoraplus_login')
      .eq('shop_id', shopId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActive(data.active ?? false)
          setApiKey(data.agoraplus_key_ref ?? '')
          setLabelNum(data.qualirepar_label_num ?? '')
          setLogin(data.agoraplus_login ?? '')
        }
        setLoading(false)
      })
  }, [shopId])

  function flash(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 6000)
  }

  // ── Sauvegarde ──
  async function handleSave() {
    if (!shopId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('qualirepar_shop_config')
        .upsert({
          shop_id:              shopId,
          active,
          agoraplus_key_ref:    apiKey.trim()   || null,
          qualirepar_label_num: labelNum.trim() || null,
          agoraplus_login:      login.trim()    || null,
          updated_at:           new Date().toISOString(),
        }, { onConflict: 'shop_id' })

      if (error) throw error
      flash('success', 'Configuration enregistrée ✅')
      onConfigSaved?.()
    } catch (err) {
      flash('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Test de connexion AgoraPlus (appel minimal à l'API) ──
  async function handleTest() {
    if (!apiKey.trim()) {
      flash('error', 'Saisissez d\'abord votre clé API.')
      return
    }
    setTesting(true)
    try {
      // On tente un appel léger (liste des éco-organismes) pour valider la clé
      const res  = await fetch('https://api.agoraplus.com/api/PrintEcoOrganizationList', {
        method:  'POST',
        headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (data.IsValid || Array.isArray(data.ResponseData)) {
        flash('success', '✅ Connexion AgoraPlus OK — clé valide !')
      } else {
        flash('error', `Clé rejetée : ${data.ResponseErrorMessage ?? 'Réponse inattendue'}`)
      }
    } catch (err) {
      flash('error', `Erreur réseau : ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  const isConfigured = !!apiKey.trim()

  return (
    <div className="space-y-5">

      {/* ── Bannière statut ── */}
      {!isConfigured ? (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">Clé API manquante</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Renseignez votre clé API AgoraPlus ci-dessous pour pouvoir soumettre des dossiers
              directement depuis ReparFlow.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-green-500/8 border border-green-500/20 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-green-400 font-semibold text-sm">Connexion AgoraPlus configurée</p>
            <p className="text-green-400/60 text-xs mt-0.5 font-mono truncate">
              {apiKey.slice(0, 8)}{'•'.repeat(Math.min(20, apiKey.length - 8))}
            </p>
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                       bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/20
                       transition-colors disabled:opacity-50"
          >
            {testing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <BadgeCheck className="w-3 h-3" />
            }
            {testing ? 'Test…' : 'Tester'}
          </button>
        </div>
      )}

      {/* ── Message flash ── */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border
          ${msg.type === 'success'
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
          {msg.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle  className="w-4 h-4 flex-shrink-0" />
          }
          {msg.text}
        </div>
      )}

      {/* ── Carte config ── */}
      <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-5">

        {/* Module actif / inactif */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-white text-sm font-semibold">Module QualiRépar actif</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Active la vérification d'éligibilité et la soumission automatique des dossiers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActive(v => !v)}
            className="flex-shrink-0"
            aria-label="Activer/désactiver QualiRépar"
          >
            {active
              ? <ToggleRight className="w-8 h-8 text-green-400" />
              : <ToggleLeft  className="w-8 h-8 text-gray-600"  />
            }
          </button>
        </div>

        <div className="border-t border-white/8" />

        {/* Clé API AgoraPlus */}
        <div>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Clé API AgoraPlus (Bearer token) *
            </span>
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Collez votre clé API ici…"
              className={inputClass + ' pr-10'}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              tabIndex={-1}
              aria-label="Afficher/masquer la clé"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">
            Disponible dans votre espace AgoraPlus → Compte → API / Intégrations.
          </p>
        </div>

        {/* Login AgoraPlus */}
        <div>
          <label className={labelClass}>Identifiant AgoraPlus (email)</label>
          <input
            type="email"
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="contact@votreatelier.fr"
            className={inputClass}
            autoComplete="off"
          />
        </div>

        {/* Numéro de label */}
        <div>
          <label className={labelClass}>
            Numéro de label QualiRépar
            <span className="text-gray-600 font-normal ml-1">(optionnel)</span>
          </label>
          <input
            type="text"
            value={labelNum}
            onChange={e => setLabelNum(e.target.value)}
            placeholder="Ex : QR-2024-XXXXX"
            className={inputClass}
          />
        </div>

        {/* Boutons */}
        <div className="flex gap-3 flex-wrap pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !shopId}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-lg transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
              : <><Save className="w-4 h-4" /> Enregistrer</>
            }
          </button>

          {isConfigured && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10
                         border border-white/10 text-gray-300 text-sm font-semibold rounded-lg
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Test…</>
                : <><BadgeCheck className="w-4 h-4" /> Tester la connexion</>
              }
            </button>
          )}
        </div>
      </div>

      {/* ── Où trouver la clé ── */}
      <div className="bg-[#111118] border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-white text-sm font-semibold">Où trouver ma clé API ?</h3>
        <ol className="space-y-3 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold
                             flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Connectez-vous à la plateforme de votre éco-organisme (Ecologic ou Ecosystem)
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold
                             flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Allez dans <strong className="text-gray-300">Mon compte → API / Intégrations</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold
                             flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            Copiez votre <strong className="text-gray-300">Bearer token</strong> et collez-le ici
          </li>
        </ol>

        <div className="flex flex-wrap gap-2 pt-1">
          <a href="https://www.e-reparateur.eco/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                       bg-green-500/8 border border-green-500/20 text-green-400
                       hover:bg-green-500/15 transition-colors">
            🌱 Accéder à Ecologic <ExternalLink className="w-3 h-3" />
          </a>
          <a href="https://portail-reparateurs.ecosystem.eco/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                       bg-blue-500/8 border border-blue-500/20 text-blue-400
                       hover:bg-blue-500/15 transition-colors">
            ♻️ Accéder à Ecosystem <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Settings, Save, Loader2, CheckCircle2, Store,
  Phone, MapPin, Clock, AlertCircle, Mail, Link2,
  ImagePlus, X, Printer, Leaf, Eye, EyeOff,
} from 'lucide-react'

const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors`

const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5'

/**
 * Page de configuration de l'atelier.
 * Gère la création (INSERT) et la mise à jour (UPDATE) de la fiche shop,
 * ainsi que l'upload du logo vers Supabase Storage (bucket shops-assets).
 */
export default function SettingsPage() {
  const supabase = getSupabaseClient()
  const logoInputRef = useRef(null)

  const [shopId,      setShopId]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [msg,         setMsg]         = useState(null)

  // ── QualiRépar ──
  const [qrActive,      setQrActive]      = useState(false)
  const [qrApiKey,      setQrApiKey]      = useState('')
  const [qrLabelNum,    setQrLabelNum]    = useState('')
  const [qrSaving,      setQrSaving]      = useState(false)
  const [qrMsg,         setQrMsg]         = useState(null)
  const [showApiKey,    setShowApiKey]    = useState(false)

  const [form, setForm] = useState({
    name:     '',
    phone:    '',
    email:    '',
    address:  '',
    hours:    '',
    logo_url: '',
    slug:     '',
  })

  // ── Chargement au montage ──
  useEffect(() => {
    async function loadShop() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shop } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (shop) {
        setShopId(shop.id)
        setForm({
          name:     shop.name     ?? '',
          phone:    shop.phone    ?? '',
          email:    shop.email    ?? '',
          address:  shop.address  ?? '',
          hours:    shop.hours    ?? '',
          logo_url: shop.logo_url ?? '',
          slug:     shop.slug     ?? '',
        })

        // Charge la config QualiRépar de l'atelier
        const { data: qrConfig } = await supabase
          .from('qualirepar_shop_config')
          .select('active, agoraplus_key_ref, qualirepar_label_num')
          .eq('shop_id', shop.id)
          .maybeSingle()

        if (qrConfig) {
          setQrActive(qrConfig.active ?? false)
          setQrApiKey(qrConfig.agoraplus_key_ref ?? '')
          setQrLabelNum(qrConfig.qualirepar_label_num ?? '')
        }
      }
      // Pas d'alerte si shop absent — l'utilisateur peut le créer via ce formulaire
      setLoading(false)
    }
    loadShop()
  }, [])

  // ── Upload du logo vers Supabase Storage ──
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifie le type et la taille (max 2 Mo)
    if (!file.type.startsWith('image/')) {
      showMsg('error', 'Seules les images sont acceptées.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showMsg('error', 'Le logo ne doit pas dépasser 2 Mo.')
      return
    }

    setUploading(true)
    try {
      // Utilise l'id existant ou un UUID temporaire pour nommer le fichier
      const id   = shopId ?? crypto.randomUUID()
      const ext  = file.name.split('.').pop()
      const path = `logos/${id}/logo.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('shops-assets')
        .upload(path, file, { upsert: true })

      if (uploadErr) throw uploadErr

      const { data } = supabase.storage
        .from('shops-assets')
        .getPublicUrl(path)

      setForm(f => ({ ...f, logo_url: data.publicUrl }))
    } catch (err) {
      showMsg('error', 'Erreur upload logo : ' + err.message)
    } finally {
      setUploading(false)
      // Réinitialise l'input pour permettre de re-sélectionner le même fichier
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  // ── Sauvegarde : upsert (UPDATE si shop existe, INSERT sinon) ──
  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    setMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      if (shopId) {
        // Mise à jour de l'atelier existant
        const { error } = await supabase
          .from('shops')
          .update({
            name:       form.name.trim(),
            phone:      form.phone.trim()    || null,
            email:      form.email.trim()    || null,
            address:    form.address.trim()  || null,
            hours:      form.hours.trim()    || null,
            logo_url:   form.logo_url.trim() || null,
            slug:       form.slug.trim()     || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shopId)
          .eq('owner_id', user.id)

        if (error) throw error
      } else {
        // Création d'un nouvel atelier pour ce compte
        const { data: newShop, error } = await supabase
          .from('shops')
          .insert({
            owner_id: user.id,
            name:     form.name.trim(),
            phone:    form.phone.trim()    || null,
            email:    form.email.trim()    || null,
            address:  form.address.trim()  || null,
            hours:    form.hours.trim()    || null,
            logo_url: form.logo_url.trim() || null,
            slug:     form.slug.trim()     || null,
            plan:     'free',
          })
          .select('id')
          .single()

        if (error) throw error
        setShopId(newShop.id)
      }

      showMsg('success', 'Informations mises à jour ✅')
    } catch (err) {
      console.error('[settings] save error:', err.message)
      showMsg('error', err.message ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  function showMsg(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 5000)
  }

  // ── Sauvegarde de la config QualiRépar ──
  async function handleSaveQR() {
    if (!shopId) return
    setQrSaving(true)
    setQrMsg(null)
    try {
      const { error } = await supabase
        .from('qualirepar_shop_config')
        .upsert({
          shop_id:               shopId,
          active:                qrActive,
          agoraplus_key_ref:     qrApiKey.trim() || null,
          qualirepar_label_num:  qrLabelNum.trim() || null,
          updated_at:            new Date().toISOString(),
        }, { onConflict: 'shop_id' })

      if (error) throw error
      setQrMsg({ type: 'success', text: 'Configuration QualiRépar enregistrée ✅' })
      setTimeout(() => setQrMsg(null), 5000)
    } catch (err) {
      setQrMsg({ type: 'error', text: err.message })
    } finally {
      setQrSaving(false)
    }
  }

  function field(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Écran de chargement ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* En-tête */}
      <div>
        <h1 className="text-white font-bold text-xl">Paramètres</h1>
        <p className="text-gray-500 text-sm mt-0.5">Informations de votre atelier</p>
      </div>

      {/* Message flash */}
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

      {/* ── Formulaire atelier ── */}
      <div className="bg-[#111118] rounded-xl border border-white/10 p-6 space-y-5">

        {/* Logo */}
        <div>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5" /> Logo de l'atelier
            </span>
          </label>

          <div className="flex items-center gap-4">
            {/* Aperçu du logo */}
            {form.logo_url ? (
              <div className="relative group w-16 h-16 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => field('logo_url', '')}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                             flex items-center justify-center transition-opacity"
                  title="Supprimer le logo"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl border border-white/10 border-dashed
                              bg-white/3 flex items-center justify-center flex-shrink-0">
                <Store className="w-6 h-6 text-gray-600" />
              </div>
            )}

            {/* Bouton upload */}
            <div className="flex-1">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label htmlFor="logo-upload"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  cursor-pointer transition-colors border
                  ${uploading
                    ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Upload…</>
                  : <><ImagePlus className="w-4 h-4" /> Choisir un logo</>
                }
              </label>
              <p className="text-xs text-gray-600 mt-1.5">JPG, PNG, WebP — max 2 Mo</p>
            </div>
          </div>

          {/* URL manuelle si besoin */}
          <div className="mt-3">
            <input
              type="url"
              value={form.logo_url}
              onChange={e => field('logo_url', e.target.value)}
              placeholder="https://… (ou uploader ci-dessus)"
              className={inputClass}
            />
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" /> Nom de l'atelier *
            </span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => field('name', e.target.value)}
            placeholder="Ex : L'Atelier du Mobile"
            className={inputClass}
          />
        </div>

        {/* Téléphone + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Téléphone
              </span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => field('phone', e.target.value)}
              placeholder="06 12 34 56 78"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email professionnel
              </span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => field('email', e.target.value)}
              placeholder="contact@monatelier.fr"
              className={inputClass}
            />
          </div>
        </div>

        {/* Adresse */}
        <div>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Adresse complète
            </span>
          </label>
          <input
            type="text"
            value={form.address}
            onChange={e => field('address', e.target.value)}
            placeholder="12 rue de la Paix, 75001 Paris"
            className={inputClass}
          />
        </div>

        {/* Horaires */}
        <div>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Horaires d'ouverture
            </span>
          </label>
          <input
            type="text"
            value={form.hours}
            onChange={e => field('hours', e.target.value)}
            placeholder="Mar-Sam 9h-19h"
            className={inputClass}
          />
          <p className="text-xs text-gray-600 mt-1.5">
            Ces horaires apparaissent dans les emails envoyés à vos clients.
          </p>
        </div>

        {/* Slug */}
        <div>
          <label className={labelClass}>
            <span className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Identifiant unique (slug)
            </span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-sm flex-shrink-0">tickeeflow.app/</span>
            <input
              type="text"
              value={form.slug}
              onChange={e => field('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="i-mobile-toulouse"
              className={inputClass}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5">
            Lettres minuscules, chiffres et tirets uniquement.
          </p>
        </div>

        {/* Bouton sauvegarder */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || saving || uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-lg transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
              : <><Save className="w-4 h-4" /> Enregistrer les modifications</>
            }
          </button>
        </div>
      </div>

      {/* ── Section imprimante thermique ── */}
      <div className="bg-[#111118] rounded-xl border border-white/10 p-6">
        <h2 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
          <Printer className="w-4 h-4 text-amber-400" />
          Imprimante thermique 58mm
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Configuration Excelvan USB (ou compatible) pour l&apos;impression des bons de dépôt.
        </p>

        {/* Instructions de configuration — à réaliser une seule fois */}
        <div className="text-xs text-gray-400 bg-white/3 border border-white/10 rounded-lg p-4">
          <div className="font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
            ⚙️ Configuration requise une seule fois
          </div>
          <ol className="space-y-1.5 list-decimal list-inside text-gray-500">
            <li>Installez le driver Excelvan (CD fourni ou site fabricant)</li>
            <li>Branchez l&apos;imprimante en USB et attendez l&apos;installation automatique</li>
            <li>
              Définissez-la comme imprimante par défaut :<br />
              <span className="font-mono text-xs text-gray-600">
                Panneau de configuration → Périphériques → Clic droit Excelvan → Définir par défaut
              </span>
            </li>
            <li>Chargez le papier thermique 58mm (face brillante vers le haut)</li>
            <li>
              Autorisez les popups dans Chrome :<br />
              <span className="font-mono text-xs text-gray-600">
                Paramètres Chrome → Confidentialité → Fenêtres pop-up → Autoriser ce site
              </span>
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t border-white/5 text-gray-600">
            Le bouton <span className="font-semibold text-gray-400">🖨️ Ticket thermique</span> apparaît
            sur chaque ticket et dans la modale après création.
            La fenêtre d&apos;impression s&apos;ouvre automatiquement — cliquez OK pour imprimer.
          </div>
        </div>
      </div>

      {/* ── Section QualiRépar ── */}
      <div className="bg-[#111118] rounded-xl border border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-400" />
            Bonus QualiRépar
          </h2>
          {/* Activation / désactivation du module */}
          <button
            type="button"
            onClick={() => setQrActive(v => !v)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 focus:outline-none
              ${qrActive ? 'bg-green-500' : 'bg-white/20'}`}
            role="switch"
            aria-checked={qrActive}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
              transition-transform duration-200 ${qrActive ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        <p className="text-xs text-gray-500 -mt-2">
          Connectez votre compte AgoraPlus pour soumettre automatiquement les dossiers de remboursement
          QualiRépar depuis chaque ticket.
        </p>

        {/* Message flash QualiRépar */}
        {qrMsg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border
            ${qrMsg.type === 'success'
              ? 'bg-green-400/10 border-green-400/20 text-green-400'
              : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
            {qrMsg.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle  className="w-4 h-4 flex-shrink-0" />
            }
            {qrMsg.text}
          </div>
        )}

        {/* Champ Clé API AgoraPlus */}
        <div>
          <label className={labelClass}>
            Clé API AgoraPlus
            <span className="text-gray-600 font-normal ml-1">(Bearer token)</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={qrApiKey}
              onChange={e => setQrApiKey(e.target.value)}
              placeholder="Collez votre clé API ici…"
              className={inputClass + ' pr-10'}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              tabIndex={-1}
            >
              {showApiKey
                ? <EyeOff className="w-4 h-4" />
                : <Eye    className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">
            Trouvez cette clé dans votre espace AgoraPlus → API / Intégrations.
          </p>
        </div>

        {/* Numéro de label QualiRépar */}
        <div>
          <label className={labelClass}>
            Numéro de label QualiRépar
            <span className="text-gray-600 font-normal ml-1">(optionnel)</span>
          </label>
          <input
            type="text"
            value={qrLabelNum}
            onChange={e => setQrLabelNum(e.target.value)}
            placeholder="Ex : QR-2024-XXXXX"
            className={inputClass}
          />
        </div>

        {/* Bouton sauvegarder */}
        <div className="pt-1">
          <button
            onClick={handleSaveQR}
            disabled={qrSaving || !shopId}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500
                       text-white text-sm font-semibold rounded-lg transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {qrSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
              : <><Save className="w-4 h-4" /> Enregistrer la config QualiRépar</>
            }
          </button>
        </div>
      </div>

      {/* ── Section compte ── */}
      <div className="bg-[#111118] rounded-xl border border-white/10 p-6">
        <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-400" />
          Compte
        </h2>
        <p className="text-xs text-gray-500">
          Pour modifier votre adresse email ou mot de passe, contactez le support TickeeFlow.
        </p>
      </div>

    </div>
  )
}

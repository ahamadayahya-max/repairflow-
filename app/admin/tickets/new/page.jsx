'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Loader2, CheckCircle2, Search,
  Smartphone, ExternalLink, Plus, Trash2, Euro,
} from 'lucide-react'
import Link from 'next/link'
import DevicePicker from '@/components/admin/DevicePicker'
import BrandDropdown from '@/components/admin/BrandDropdown'
import ModelDropdown from '@/components/admin/ModelDropdown'
import PartSearchDropdown from '@/components/admin/PartSearchDropdown'
import FactureIndicator from '@/components/admin/FactureIndicator'

const DEVICE_TYPES = [
  { value: 'smartphone', label: '📱 Smartphone' },
  { value: 'tablet',     label: '📟 Tablette'   },
  { value: 'laptop',     label: '💻 Ordinateur' },
  { value: 'console',    label: '🎮 Console'    },
  { value: 'tv',         label: '📺 Télévision' },
  { value: 'appliance',  label: '🏠 Ménager'    },
  { value: 'other',      label: '🔧 Autre'      },
]

const URGENCY = [
  { value: 'low',    label: 'Faible',  color: 'text-gray-400' },
  { value: 'normal', label: 'Normale', color: 'text-blue-400' },
  { value: 'high',   label: 'Haute',   color: 'text-red-400'  },
]

const inputClass = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
  placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors`

const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5'

/**
 * Formulaire de création d'un ticket avec sélecteur d'appareil iFixit.
 * Étape 1 : informations client (téléphone → recherche d'un client existant)
 * Étape 2 : sélection de l'appareil, description du problème, prix et pièces
 */
export default function NewTicketPage() {
  const router   = useRouter()
  const supabase = getSupabaseClient()

  // Étape : 'client' | 'ticket' | 'success'
  const [step, setStep] = useState('client')

  // ── Données client ──
  const [phone,       setPhone]       = useState('')
  const [fullName,    setFullName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [address,     setAddress]     = useState('')
  const [clientId,    setClientId]    = useState(null)
  const [clientFound, setClientFound] = useState(false)
  const [searching,   setSearching]   = useState(false)

  // ── Données appareil ──
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [deviceType,     setDeviceType]     = useState('smartphone')
  const [brand,          setBrand]          = useState('')
  const [model,          setModel]          = useState('')

  // ── Données ticket ──
  const [issue,   setIssue]   = useState('')
  const [urgency, setUrgency] = useState('normal')
  const [readyAt, setReadyAt] = useState('')

  // ── Prix ──
  const [priceEstimate, setPriceEstimate] = useState('')
  const [priceFinal,    setPriceFinal]    = useState('')
  const [depositAmount, setDepositAmount] = useState('')

  // ── Pièces sélectionnées : [{ part, quantity, unitPrice }] ──
  const [selectedParts, setSelectedParts] = useState([])
  // Shop ID chargé lors de la soumission — on en a besoin pour PartSearchDropdown
  const [shopId, setShopId] = useState(null)

  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState(null)
  const [ticketId,      setTicketId]      = useState(null)
  const [createdTicket, setCreatedTicket] = useState(null)
  const [shopData,      setShopData]      = useState(null)
  const [printLoading,  setPrintLoading]  = useState(false)

  // ── Recherche d'un client existant par téléphone ──
  async function handlePhoneSearch() {
    if (phone.trim().length < 8) return
    setSearching(true)
    setClientFound(false)
    setClientId(null)
    setFullName('')
    setEmail('')

    const { data } = await supabase
      .from('clients')
      .select('id, full_name, email, address')
      .eq('phone', phone.trim())
      .maybeSingle()

    if (data) {
      setClientId(data.id)
      setFullName(data.full_name ?? '')
      setEmail(data.email ?? '')
      setAddress(data.address ?? '')
      setClientFound(true)
    }
    setSearching(false)
  }

  // ── Charge le shop_id dès que l'étape 2 s'affiche (nécessaire pour PartSearchDropdown) ──
  async function ensureShopId() {
    if (shopId) return shopId
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: shop } = await supabase
      .from('shops').select('id').eq('owner_id', user.id).single()
    if (shop) { setShopId(shop.id); return shop.id }
    return null
  }

  // ── Sélection d'appareil via iFixit (DevicePicker) ──
  function handleDeviceSelect(device) {
    setSelectedDevice(device)
    if (device) {
      setDeviceType(device.deviceType ?? 'other')
      const inferredBrand = device.subcategory?.split(' ')[0] ?? ''
      setBrand(inferredBrand)
      setModel(device.name ?? '')
    }
  }

  // ── Sélection de modèle via ModelDropdown (met à jour le device complet) ──
  function handleModelIfixitSelect(device) {
    setSelectedDevice({
      id:          device.id,
      name:        device.name,
      category:    device.category    ?? null,
      subcategory: device.subcategory ?? null,
      imageUrl:    device.image_url   ?? null,
      deviceType:  deviceType,
    })
  }

  // ── Ajout d'une pièce à la liste ──
  function handlePartSelect(part) {
    // Vérifie si la pièce est déjà dans la liste
    const existing = selectedParts.findIndex(sp => sp.part.id === part.id)
    if (existing !== -1) {
      // Incrémente la quantité si déjà présente
      setSelectedParts(prev => prev.map((sp, i) =>
        i === existing ? { ...sp, quantity: sp.quantity + 1 } : sp
      ))
    } else {
      setSelectedParts(prev => [...prev, {
        part,
        quantity:  1,
        unitPrice: part.unit_price ?? 0,
      }])
    }
  }

  // ── Modification de la quantité d'une pièce ──
  function handlePartQtyChange(idx, qty) {
    const val = Math.max(1, parseInt(qty) || 1)
    setSelectedParts(prev => prev.map((sp, i) =>
      i === idx ? { ...sp, quantity: val } : sp
    ))
  }

  // ── Modification du prix unitaire d'une pièce ──
  function handlePartPriceChange(idx, price) {
    const val = parseFloat(price) || 0
    setSelectedParts(prev => prev.map((sp, i) =>
      i === idx ? { ...sp, unitPrice: val } : sp
    ))
  }

  // ── Suppression d'une pièce ──
  function handlePartRemove(idx) {
    setSelectedParts(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Étape 1 : valider le client ──
  async function handleClientNext(e) {
    e.preventDefault()
    setError(null)
    if (!phone.trim() || !fullName.trim()) {
      setError('Le téléphone et le nom sont obligatoires.')
      return
    }
    await ensureShopId()
    setStep('ticket')
  }

  // ── Étape 2 : créer le ticket ──
  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!issue.trim() || issue.trim().length < 10) {
      setError('La description du problème doit faire au moins 10 caractères.')
      return
    }

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: shop }     = await supabase
        .from('shops').select('id, name, phone, address, email, logo_url').eq('owner_id', user.id).single()

      if (!shop) throw new Error('Atelier introuvable.')
      setShopData(shop)

      // Crée ou réutilise le client
      let finalClientId = clientId
      if (!finalClientId) {
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert({
            shop_id:   shop.id,
            full_name: fullName.trim(),
            phone:     phone.trim(),
            email:     email.trim() || null,
            address:   address.trim() || null,
          })
          .select('id')
          .single()
        if (cErr) throw new Error('Impossible de créer le client : ' + cErr.message)
        finalClientId = newClient.id
      }

      // Calcule le coût total des pièces
      const partsCostTotal = selectedParts.reduce(
        (sum, sp) => sum + sp.unitPrice * sp.quantity, 0
      )

      // Construit le payload du ticket
      const ticketPayload = {
        shop_id:            shop.id,
        client_id:          finalClientId,
        tracking_token:     crypto.randomUUID().replace(/-/g, ''),
        status:             'pending',
        device_type:        deviceType,
        device_brand:       brand.trim() || null,
        device_model:       model.trim() || null,
        issue_desc:         issue.trim(),
        received_at:        new Date().toISOString(),
        estimated_ready_at: readyAt || null,
        intake_channel:     'manual',
        // Prix
        price_estimate:     priceEstimate ? parseFloat(priceEstimate) : null,
        price_final:        priceFinal    ? parseFloat(priceFinal)    : null,
        deposit_amount:     depositAmount ? parseFloat(depositAmount) : null,
        parts_cost:         partsCostTotal || null,
        // Champs iFixit (présents uniquement si appareil sélectionné via picker)
        ifixit_device_id:   selectedDevice?.id          ?? null,
        ifixit_device_name: selectedDevice?.name        ?? null,
        ifixit_category:    selectedDevice?.category    ?? null,
        ifixit_subcategory: selectedDevice?.subcategory ?? null,
        ifixit_image_url:   selectedDevice?.imageUrl    ?? null,
      }

      const { data: ticket, error: tErr } = await supabase
        .from('tickets')
        .insert(ticketPayload)
        .select('id, tracking_token')
        .single()

      if (tErr) throw new Error('Impossible de créer le ticket : ' + tErr.message)

      // Associe les pièces au ticket et décrémente le stock
      if (selectedParts.length > 0) {
        const partsRows = selectedParts.map(sp => ({
          ticket_id:  ticket.id,
          part_id:    sp.part.id,
          quantity:   sp.quantity,
          unit_price: sp.unitPrice,
        }))

        const { error: pErr } = await supabase
          .from('ticket_parts')
          .insert(partsRows)

        if (pErr) {
          // Non bloquant : le ticket est créé, on signale juste l'erreur pièces
          console.error('[ticket_parts] insert error:', pErr.message)
        } else {
          // Décrémente le stock pour chaque pièce
          for (const sp of selectedParts) {
            await supabase.rpc('decrement_part_stock', {
              p_part_id: sp.part.id,
              p_qty:     sp.quantity,
            })
          }
        }
      }

      setTicketId(ticket.id)
      // Construit un objet complet pour la génération du bon de dépôt PDF
      setCreatedTicket({
        ...ticketPayload,
        id:              ticket.id,
        tracking_token:  ticket.tracking_token,
        clients: {
          full_name:  fullName.trim(),
          first_name: fullName.trim().split(' ')[0] ?? '',
          last_name:  fullName.trim().split(' ').slice(1).join(' ') || null,
          phone:      phone.trim(),
          email:      email.trim() || null,
        },
      })
      setStep('success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Génère et imprime le bon de dépôt PDF ──
  async function handlePrintBon() {
    if (!createdTicket) return
    setPrintLoading(true)
    try {
      const [{ TicketReceiptPDF }, { pdf }, { createElement }, QRCode] = await Promise.all([
        import('@/components/admin/pdf/TicketReceiptPDF'),
        import('@react-pdf/renderer'),
        import('react'),
        import('qrcode').then(m => m.default),
      ])
      const trackingUrl = `https://repairflow-app.vercel.app/suivi/${createdTicket.tracking_token}`
      const qrDataUrl   = await QRCode.toDataURL(trackingUrl, { width: 200, margin: 1 })
      const blob        = await pdf(
        createElement(TicketReceiptPDF, { ticket: createdTicket, shop: shopData ?? {}, qrCodeDataUrl: qrDataUrl })
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.onload = () => {
          win.print()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
        }
      }
    } catch (err) {
      console.error('[impression bon]', err)
    } finally {
      setPrintLoading(false)
    }
  }

  // ── Télécharge le bon de dépôt en PDF ──
  async function handleDownloadBon() {
    if (!createdTicket) return
    setPrintLoading(true)
    try {
      const [{ TicketReceiptPDF }, { pdf }, { createElement }, QRCode] = await Promise.all([
        import('@/components/admin/pdf/TicketReceiptPDF'),
        import('@react-pdf/renderer'),
        import('react'),
        import('qrcode').then(m => m.default),
      ])
      const trackingUrl = `https://repairflow-app.vercel.app/suivi/${createdTicket.tracking_token}`
      const qrDataUrl   = await QRCode.toDataURL(trackingUrl, { width: 200, margin: 1 })
      const blob        = await pdf(
        createElement(TicketReceiptPDF, { ticket: createdTicket, shop: shopData ?? {}, qrCodeDataUrl: qrDataUrl })
      ).toBlob()
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.download = `bon-depot-${createdTicket.id?.slice(0, 8) ?? 'ticket'}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 3000)
    } catch (err) {
      console.error('[téléchargement bon]', err)
    } finally {
      setPrintLoading(false)
    }
  }

  // ── Réinitialisation complète du formulaire ──
  function resetForm() {
    setStep('client')
    setPhone(''); setFullName(''); setEmail(''); setAddress('')
    setClientId(null); setClientFound(false)
    setSelectedDevice(null)
    setDeviceType('smartphone'); setBrand(''); setModel('')
    setIssue(''); setUrgency('normal'); setReadyAt('')
    setPriceEstimate(''); setPriceFinal(''); setDepositAmount('')
    setSelectedParts([])
    setTicketId(null); setError(null)
  }

  // ── Valeurs dérivées pour FactureIndicator ──
  const indicatorPriceEstimate = priceEstimate ? parseFloat(priceEstimate) : null
  const indicatorPriceFinal    = priceFinal    ? parseFloat(priceFinal)    : null

  // ── Écran de succès ──
  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-green-400/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Ticket créé !</h2>
        <p className="text-gray-400 text-sm mb-8">
          Le client <strong className="text-white">{fullName}</strong> a été enregistré
          et son ticket de réparation est ouvert.
        </p>

        {/* Bon de dépôt */}
        <div className="bg-[#111118] border border-white/10 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Bon de dépôt
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handlePrintBon}
              disabled={printLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {printLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <span>🖨️</span>
              }
              Imprimer le bon
            </button>
            <button
              onClick={handleDownloadBon}
              disabled={printLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-gray-300 text-sm font-semibold rounded-lg transition-colors"
            >
              {printLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <span>⬇️</span>
              }
              Télécharger PDF
            </button>
          </div>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href={`/admin/tickets/${ticketId}`}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Voir le ticket
          </Link>
          <button
            onClick={resetForm}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm font-semibold rounded-lg transition-colors"
          >
            Nouveau ticket
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/tickets"
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-white font-bold text-xl">Nouveau ticket</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {step === 'client' ? 'Étape 1 / 2 — Informations client' : 'Étape 2 / 2 — Appareil, problème & prix'}
          </p>
        </div>
      </div>

      {/* Indicateur d'étapes */}
      <div className="flex items-center gap-2 mb-6">
        {['Client', 'Appareil'].map((label, i) => {
          const active = (i === 0 && step === 'client') || (i === 1 && step === 'ticket')
          const done   = (i === 0 && step === 'ticket')
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${done   ? 'bg-green-500 text-white'
                : active ? 'bg-amber-500 text-white'
                         : 'bg-white/10 text-gray-500'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
              {i < 1 && <div className="w-8 h-px bg-white/10 mx-1" />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── ÉTAPE 1 : CLIENT ── */}
      {step === 'client' && (
        <form onSubmit={handleClientNext} className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">

          {/* Recherche par téléphone */}
          <div>
            <label className={labelClass}>Téléphone *</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setClientFound(false); setClientId(null) }}
                placeholder="+33 6 12 34 56 78"
                required
                className={inputClass}
              />
              <button
                type="button"
                onClick={handlePhoneSearch}
                disabled={searching || phone.trim().length < 8}
                className="flex-shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                           text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
                title="Rechercher le client"
              >
                {searching
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />
                }
              </button>
            </div>
            {clientFound && (
              <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Client existant trouvé et pré-rempli
              </p>
            )}
          </div>

          {/* Nom complet */}
          <div>
            <label className={labelClass}>Nom complet *</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jean Dupont"
              required
              className={inputClass}
            />
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>Email <span className="text-gray-600">(optionnel)</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jean@exemple.fr"
              className={inputClass}
            />
          </div>

          {/* Adresse */}
          <div>
            <label className={labelClass}>Adresse <span className="text-gray-600">(optionnel)</span></label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="12 rue de la Paix, 75001 Paris"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            Continuer →
          </button>
        </form>
      )}

      {/* ── ÉTAPE 2 : APPAREIL ── */}
      {step === 'ticket' && (
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Bloc appareil & problème ── */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">

            {/* Récap client */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg border border-white/10">
              <div>
                <p className="text-white text-sm font-medium">{fullName}</p>
                <p className="text-gray-500 text-xs">{phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep('client')}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Modifier
              </button>
            </div>

            {/* Sélecteur d'appareil iFixit */}
            <div>
              <label className={labelClass}>
                Appareil iFixit
                <span className="text-gray-600 font-normal ml-1">(recommandé)</span>
              </label>
              <DevicePicker value={selectedDevice} onChange={handleDeviceSelect} />
            </div>

            {/* Type d'appareil */}
            <div>
              <label className={labelClass}>
                Type d'appareil *
                {selectedDevice && (
                  <span className="text-gray-600 font-normal ml-1">(détecté automatiquement)</span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DEVICE_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDeviceType(value)}
                    className={`px-3 py-2 rounded-lg text-sm text-left border transition-colors
                      ${deviceType === value
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Marque + Modèle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Marque</label>
                <BrandDropdown
                  value={brand || null}
                  onChange={v => setBrand(v ?? '')}
                  placeholder="Apple, Samsung…"
                />
              </div>
              <div>
                <label className={labelClass}>Modèle</label>
                <ModelDropdown
                  brand={brand || null}
                  value={model || null}
                  onChange={v => setModel(v ?? '')}
                  onIfixitSelect={handleModelIfixitSelect}
                  placeholder="iPhone 15, S24…"
                />
              </div>
            </div>

            {/* Description du problème */}
            <div>
              <label className={labelClass}>Description du problème *</label>
              <textarea
                value={issue}
                onChange={e => setIssue(e.target.value)}
                rows={3}
                placeholder="Décrivez le problème signalé par le client (min. 10 caractères)…"
                required
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Urgence */}
            <div>
              <label className={labelClass}>Urgence</label>
              <div className="flex gap-2">
                {URGENCY.map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUrgency(value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                      ${urgency === value
                        ? `bg-white/10 border-white/20 ${color}`
                        : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/8'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date estimée */}
            <div>
              <label className={labelClass}>Prêt estimé <span className="text-gray-600">(optionnel)</span></label>
              <input
                type="date"
                value={readyAt}
                onChange={e => setReadyAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>

          {/* ── Bloc Prix & Pièces ── */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-5 space-y-4">

            {/* En-tête section */}
            <div className="flex items-center gap-2 pb-1 border-b border-white/8">
              <Euro className="w-4 h-4 text-amber-400" />
              <h2 className="text-white font-semibold text-sm">Prix & Pièces</h2>
              <span className="text-gray-600 text-xs font-normal">(optionnel)</span>
            </div>

            {/* Champs prix */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Devis (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceEstimate}
                  onChange={e => setPriceEstimate(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Prix final (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceFinal}
                  onChange={e => setPriceFinal(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Acompte (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Recherche de pièces */}
            <div>
              <label className={labelClass}>Ajouter des pièces</label>
              <PartSearchDropdown
                onSelect={handlePartSelect}
                filterShopId={shopId}
                placeholder="Rechercher une pièce dans le stock…"
              />
            </div>

            {/* Liste des pièces sélectionnées */}
            {selectedParts.length > 0 && (
              <div className="space-y-2">
                {selectedParts.map((sp, idx) => (
                  <div key={idx}
                    className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg">

                    {/* Nom de la pièce */}
                    <span className="flex-1 text-sm text-gray-200 truncate min-w-0">
                      {sp.part.part_name}
                    </span>

                    {/* Quantité */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-500">Qté</span>
                      <input
                        type="number"
                        min="1"
                        value={sp.quantity}
                        onChange={e => handlePartQtyChange(idx, e.target.value)}
                        className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm
                                   text-white text-center focus:outline-none focus:border-amber-500/40"
                      />
                    </div>

                    {/* Prix unitaire */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-500">P.U.</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sp.unitPrice}
                        onChange={e => handlePartPriceChange(idx, e.target.value)}
                        className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm
                                   text-white text-right focus:outline-none focus:border-amber-500/40"
                      />
                      <span className="text-xs text-gray-500">€</span>
                    </div>

                    {/* Total ligne */}
                    <span className="text-sm font-medium text-amber-300 shrink-0 w-16 text-right">
                      {(sp.unitPrice * sp.quantity).toFixed(2)} €
                    </span>

                    {/* Supprimer */}
                    <button
                      type="button"
                      onClick={() => handlePartRemove(idx)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                      title="Retirer la pièce"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Indicateur de facture */}
            <FactureIndicator
              priceEstimate={indicatorPriceEstimate}
              priceFinal={indicatorPriceFinal}
              selectedParts={selectedParts}
            />
          </div>

          {/* ── Boutons de navigation ── */}
          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={() => setStep('client')}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10
                         text-gray-300 font-semibold text-sm rounded-lg transition-colors"
            >
              ← Retour
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50
                         text-white font-semibold text-sm rounded-lg transition-colors
                         flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Création…' : 'Créer le ticket'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

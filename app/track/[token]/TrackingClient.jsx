'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wrench,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  XCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STEPS = ['Reçu', 'Diagnostic', 'En réparation', 'Prêt', 'Récupéré']

/**
 * Mappe le statut réel Supabase (pending|in_repair|ready|delivered)
 * vers l'index 0-4 du stepper.
 * @param {string} status
 * @returns {number}
 */
function getStepIndex(status) {
  return (
    {
      pending:   0,
      in_repair: 2,
      ready:     3,
      delivered: 4,
    }[status] ?? 0
  )
}

const STATUS_MESSAGES = {
  pending:
    'Votre appareil a bien été reçu. Nous allons prendre en charge votre réparation.',
  in_repair:
    "Votre appareil est en cours de réparation. Nous vous prévenons dès qu'il est prêt.",
  ready:
    "Votre appareil est prêt ! Venez le récupérer à l'atelier.",
  delivered:
    "Réparation terminée. Merci de nous avoir fait confiance !",
}

const DEVICE_TYPE_LABELS = {
  smartphone: 'Smartphone',
  tablet:     'Tablette',
  laptop:     'Ordinateur portable',
  console:    'Console',
  smartwatch: 'Montre connectée',
  other:      'Appareil',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formate une date ISO en français : "lundi 14 avril 2026" */
function formatDate(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  }).format(new Date(iso))
}

/** Affiche le temps écoulé depuis le dernier refresh */
function formatElapsed(s) {
  if (s < 60) return `il y a ${s} seconde${s > 1 ? 's' : ''}`
  const m = Math.floor(s / 60)
  return `il y a ${m} minute${m > 1 ? 's' : ''}`
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

/**
 * Stepper linéaire 5 étapes.
 * @param {{ currentStep: number }} props
 */
function Stepper({ currentStep }) {
  const progress = (currentStep / (STEPS.length - 1)) * 100

  return (
    <div className="w-full">
      <div className="relative flex items-start justify-between">
        {/* Ligne de fond */}
        <div className="absolute top-4 inset-x-0 h-0.5 bg-gray-200" />
        {/* Ligne de progression */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-amber-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />

        {STEPS.map((label, i) => {
          const done   = i < currentStep
          const active = i === currentStep
          return (
            <div key={label} className="relative z-10 flex flex-col items-center flex-1">
              <div
                className={[
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                  done
                    ? 'bg-green-500 border-green-500 text-white'
                    : active
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-white border-gray-300 text-gray-300',
                ].join(' ')}
              >
                {done ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>
              <p
                className={[
                  'mt-2 text-xs text-center font-medium leading-tight',
                  done
                    ? 'text-green-600'
                    : active
                    ? 'text-amber-600'
                    : 'text-gray-400',
                ].join(' ')}
              >
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Bandeau affiché à la place du stepper si le dossier est annulé. */
function CancelledBanner() {
  return (
    <div className="flex items-start gap-3 bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
      <XCircle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-gray-700">Dossier clôturé</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Ce dossier a été annulé. Contactez l&apos;atelier pour plus
          d&apos;informations.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

/**
 * Partie cliente de la page de suivi.
 * Gère le polling automatique (router.refresh toutes les 60s) et l'affichage.
 *
 * @param {{
 *   ticket: {
 *     tracking_token: string,
 *     status: 'pending'|'in_repair'|'ready'|'delivered',
 *     device_type: string,
 *     device_brand: string|null,
 *     device_model: string|null,
 *     issue_description: string|null,
 *     received_at: string|null,
 *     estimated_ready_at: string|null,
 *   },
 *   shop: {
 *     name?: string,
 *     phone?: string,
 *     address?: string,
 *     hours?: string,
 *     logo_url?: string,
 *   },
 *   photos?: Array<{ id: string, url: string, thumbnail_url: string, type: 'before'|'after', taken_at: string }>,
 * }} props
 */
export default function TrackingClient({ ticket, shop, photos = [] }) {
  const router  = useRouter()
  const [elapsed,  setElapsed]  = useState(0)
  const [lightbox, setLightbox] = useState(null)  // URL photo agrandie ou null

  // Rafraîchissement automatique toutes les 60 s
  // router.refresh() relance le Server Component sans rechargement complet
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      router.refresh()
      setElapsed(0)
    }, 60_000)

    const elapsedTimer = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1_000)

    return () => {
      clearInterval(refreshTimer)
      clearInterval(elapsedTimer)
    }
  }, [router])

  const {
    tracking_token,
    status,
    device_type,
    device_brand,
    device_model,
    received_at,
    estimated_ready_at,
  } = ticket

  const isCancelled   = status === 'cancelled'
  const currentStep   = getStepIndex(status)
  const statusMessage = STATUS_MESSAGES[status] ?? null
  const deviceLabel   = [device_brand, device_model].filter(Boolean).join(' ') || 'Appareil'
  const typeLabel     = DEVICE_TYPE_LABELS[device_type] ?? 'Appareil'
  const shopName      = shop.name ?? 'Votre atelier'
  const mapsUrl       = shop.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`
    : null

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center px-4 py-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-col items-center mb-8">
        {shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.logo_url}
            alt={shopName}
            className="h-10 object-contain mb-2"
          />
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-5 h-5 text-amber-500" />
            <span className="text-gray-900 font-bold text-xl tracking-tight">
              {shopName}
            </span>
          </div>
        )}
        <p className="text-gray-500 text-sm">Suivi de réparation</p>
      </header>

      {/* ── Card principale ────────────────────────────────────── */}
      <main className="w-full max-w-[480px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Titre appareil + dates */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-gray-900 font-bold text-lg leading-tight">
                {deviceLabel}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                Réf. {tracking_token}
              </p>
            </div>
            <span className="shrink-0 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-medium px-2.5 py-1 rounded-full">
              {typeLabel}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Déposé le</span>
              <span className="text-gray-800 font-medium">
                {received_at ? formatDate(received_at) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Récupération estimée</span>
              <span className="text-gray-800 font-medium">
                {estimated_ready_at
                  ? formatDate(estimated_ready_at)
                  : 'En cours d\'évaluation'}
              </span>
            </div>
          </div>
        </div>

        {/* Stepper / bandeau annulé */}
        <div className="px-6 py-6 border-b border-gray-100">
          {isCancelled ? <CancelledBanner /> : <Stepper currentStep={currentStep} />}
        </div>

        {/* Message de statut */}
        {statusMessage && !isCancelled && (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <p className="text-amber-800 text-sm leading-relaxed">
                {statusMessage}
              </p>
            </div>
          </div>
        )}

        {/* ── Photos avant/après (visibles dès que la réparation est en cours) ── */}
        {['in_repair', 'ready', 'delivered'].includes(status) && photos.length > 0 && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              📸 Photos de votre réparation
            </h2>

            {/* Grille 2 colonnes — avant à gauche, après à droite */}
            <div className="grid grid-cols-2 gap-2">
              {/* Photos "avant" */}
              {photos.filter(p => p.type === 'before').map(photo => (
                <div key={photo.id} className="space-y-1">
                  <button
                    onClick={() => setLightbox(photo.url)}
                    className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100
                               border border-gray-200 hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url ?? photo.url}
                      alt="Avant réparation"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold
                                     bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                      Avant
                    </span>
                  </button>
                </div>
              ))}

              {/* Photos "après" */}
              {photos.filter(p => p.type === 'after').map(photo => (
                <div key={photo.id} className="space-y-1">
                  <button
                    onClick={() => setLightbox(photo.url)}
                    className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100
                               border border-gray-200 hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url ?? photo.url}
                      alt="Après réparation"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold
                                     bg-green-600/80 text-white px-1.5 py-0.5 rounded-full">
                      Après
                    </span>
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-2 text-center">
              Appuyez sur une photo pour l&apos;agrandir
            </p>
          </div>
        )}

        {/* CTA "Venir récupérer" si prêt */}
        {status === 'ready' && mapsUrl && (
          <div className="px-6 py-4 border-b border-gray-100">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold text-sm rounded-xl py-3.5 transition-colors shadow-sm shadow-amber-200"
            >
              <MapPin className="w-4 h-4" />
              Venir récupérer mon appareil
            </a>
          </div>
        )}

        {/* Footer atelier */}
        <div className="px-6 py-5 bg-gray-50 space-y-2">
          <p className="text-gray-800 font-semibold text-sm">{shopName}</p>

          {shop.address && (
            <div className="flex items-start gap-2 text-gray-500 text-xs">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
              <span>{shop.address}</span>
            </div>
          )}

          {shop.hours && (
            <div className="flex items-start gap-2 text-gray-500 text-xs">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
              <span>{shop.hours}</span>
            </div>
          )}

          {shop.phone && (
            <div className="flex items-center gap-2 text-xs pt-2 border-t border-gray-200 mt-1">
              <Phone className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span className="text-gray-500">
                Un problème ? Appelez-nous :{' '}
                <a
                  href={`tel:${shop.phone.replace(/\s/g, '')}`}
                  className="text-amber-600 font-medium hover:underline"
                >
                  {shop.phone}
                </a>
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Indicateur de fraîcheur */}
      <p className="mt-5 text-gray-400 text-xs">
        Mis à jour {formatElapsed(elapsed)} · actualisation automatique
      </p>

      {/* ── Lightbox photo ── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* Bouton fermer */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20
                       text-white text-xl flex items-center justify-center
                       hover:bg-white/30 transition-colors"
            aria-label="Fermer"
          >
            ×
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Photo agrandie"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  )
}

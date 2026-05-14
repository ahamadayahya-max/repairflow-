'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { uploadTicketPhoto, deleteTicketPhoto } from '@/lib/utils/photoStorage'
import {
  Camera, ImagePlus, Loader2, Trash2, ZoomIn,
  Download, X, AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Config des types de photos
// ---------------------------------------------------------------------------

const PHOTO_TYPES = [
  { value: 'before',     label: 'Avant réparation',  emoji: '📸' },
  { value: 'after',      label: 'Après réparation',  emoji: '✅' },
  { value: 'damage',     label: 'Dommage constaté',  emoji: '🔍' },
  { value: 'part',       label: 'Pièce utilisée',    emoji: '🔩' },
  { value: 'qualirepar', label: 'Preuve QualiRépar',  emoji: '🏷️' },
  { value: 'invoice',    label: 'Facture',            emoji: '🧾' },
  { value: 'other',      label: 'Autre',              emoji: '📁' },
]

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

/**
 * Galerie photos pour un ticket, utilisable en mode complet ou QualiRépar uniquement.
 *
 * @param {{
 *   ticketId:  string,
 *   shopId:    string,
 *   mode?:     'full' | 'qualirepar',
 *   onCountChange?: (count: number) => void,
 * }} props
 */
export default function PhotoGallery({ ticketId, shopId, mode = 'full', onCountChange }) {
  const supabase = getSupabaseClient()
  const [photos,     setPhotos]     = useState([])
  const [uploading,  setUploading]  = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [activeType, setActiveType] = useState(mode === 'qualirepar' ? 'qualirepar' : 'before')
  const [lightbox,   setLightbox]   = useState(null)   // URL ou null
  const [flashMsg,   setFlashMsg]   = useState(null)
  const [deleting,   setDeleting]   = useState(null)   // photo id en cours de suppression

  // ---------------------------------------------------------------------------
  // Chargement des photos
  // ---------------------------------------------------------------------------

  const loadPhotos = useCallback(async () => {
    let q = supabase
      .from('ticket_photos')
      .select('id, url, thumbnail_url, type, label, taken_at, size_bytes')
      .eq('ticket_id', ticketId)
      .order('taken_at', { ascending: false })

    if (mode === 'qualirepar') q = q.eq('type', 'qualirepar')

    const { data } = await q
    const list = data ?? []
    setPhotos(list)
    onCountChange?.(list.length)
  }, [ticketId, mode])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  // ---------------------------------------------------------------------------
  // Flash temporaire
  // ---------------------------------------------------------------------------

  function flash(type, text) {
    setFlashMsg({ type, text })
    setTimeout(() => setFlashMsg(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Upload de fichiers
  // ---------------------------------------------------------------------------

  async function handleFiles(fileList, type) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    setUploading(true)
    setProgress(0)

    let uploaded = 0
    let errors   = 0

    for (const file of files) {
      // Validation type
      if (!file.type.startsWith('image/')) {
        flash('error', `${file.name} : fichier non supporté`)
        errors++
        continue
      }
      // Validation taille (10 Mo)
      if (file.size > 10 * 1024 * 1024) {
        flash('error', `${file.name} : fichier trop lourd (max 10 Mo)`)
        errors++
        continue
      }

      try {
        setProgress(Math.round((uploaded / files.length) * 60))

        const { url, thumbnailUrl } = await uploadTicketPhoto(
          file, ticketId, shopId, type, supabase
        )

        setProgress(Math.round(((uploaded + 0.7) / files.length) * 100))

        const typeInfo = PHOTO_TYPES.find(t => t.value === type)
        await supabase.from('ticket_photos').insert({
          ticket_id:     ticketId,
          shop_id:       shopId,
          url,
          thumbnail_url: thumbnailUrl,
          type,
          label:         typeInfo?.label ?? type,
          size_bytes:    file.size,
          mime_type:     file.type,
        })

        uploaded++
        setProgress(Math.round((uploaded / files.length) * 100))
      } catch (err) {
        errors++
        flash('error', `Erreur upload : ${err.message}`)
      }
    }

    await loadPhotos()
    setUploading(false)
    setProgress(0)

    // Les inputs sont réinitialisés directement dans leur onChange
    if (uploaded > 0 && errors === 0) {
      flash('success', `${uploaded} photo${uploaded > 1 ? 's' : ''} ajoutée${uploaded > 1 ? 's' : ''}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Suppression
  // ---------------------------------------------------------------------------

  async function handleDelete(photo) {
    setDeleting(photo.id)
    try {
      await deleteTicketPhoto(photo.url, photo.id, supabase)
      await loadPhotos()
    } catch (err) {
      flash('error', `Suppression impossible : ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Données groupées
  // ---------------------------------------------------------------------------

  const grouped = photos.reduce((acc, p) => {
    if (!acc[p.type]) acc[p.type] = []
    acc[p.type].push(p)
    return acc
  }, {})

  const displayTypes = mode === 'qualirepar'
    ? PHOTO_TYPES.filter(t => t.value === 'qualirepar')
    : PHOTO_TYPES

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">

      {/* ── Barre d'upload ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Sélecteur de type (mode full uniquement) */}
        {mode === 'full' && (
          <select
            value={activeType}
            onChange={e => setActiveType(e.target.value)}
            disabled={uploading}
            className="bg-white/5 border border-white/10 text-gray-300 text-xs rounded-lg
                       px-3 py-2 focus:outline-none focus:border-amber-500/50 transition-colors
                       disabled:opacity-50"
          >
            {PHOTO_TYPES.map(t => (
              <option key={t.value} value={t.value} className="bg-[#111118]">
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
        )}

        {/* Bouton caméra — ouvre la caméra sur mobile, sélecteur sur desktop.
            NB : on utilise un <label> pour éviter le blocage iOS Safari sur les
            inputs cachés avec display:none (le .click() programmatique est bloqué). */}
        <label
          className={`flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400
                      text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer
                      ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Camera className="w-3.5 h-3.5" />
          Photo
          {/* capture="environment" ouvre la caméra directement sur mobile */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => { handleFiles(e.target.files, activeType); e.target.value = '' }}
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
          />
        </label>

        {/* Bouton galerie — sélection depuis la bibliothèque (multi-fichiers) */}
        <label
          className={`flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10
                      border border-white/10 text-gray-300 text-xs font-semibold
                      rounded-lg transition-colors cursor-pointer
                      ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <ImagePlus className="w-3.5 h-3.5" />
          Galerie
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => { handleFiles(e.target.files, activeType); e.target.value = '' }}
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
          />
        </label>

        {/* Compteur */}
        <span className="ml-auto text-xs text-gray-600">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Barre de progression ── */}
      {uploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Upload en cours…
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Flash message ── */}
      {flashMsg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border
          ${flashMsg.type === 'success'
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-red-400/10  border-red-400/20  text-red-400'}`}>
          {flashMsg.type === 'error'
            ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            : <span>✅</span>}
          {flashMsg.text}
        </div>
      )}

      {/* ── Galerie groupée par type ── */}
      {displayTypes.map(typeInfo => {
        const typePhotos = grouped[typeInfo.value] ?? []

        // En mode full, masque les catégories vides pour garder l'interface propre
        if (mode === 'full' && typePhotos.length === 0) return null

        return (
          <div key={typeInfo.value} className="space-y-2">
            {/* En-tête catégorie */}
            {mode === 'full' && (
              <div className="flex items-center gap-2">
                <span className="text-sm">{typeInfo.emoji}</span>
                <span className="text-xs font-medium text-gray-400">{typeInfo.label}</span>
                <span className="text-xs text-gray-700 font-mono">({typePhotos.length})</span>
              </div>
            )}

            {/* Zone vide — invite à prendre une photo (label pour compatibilité iOS Safari) */}
            {typePhotos.length === 0 ? (
              <label
                className={`w-full border-2 border-dashed border-white/10 hover:border-amber-500/40
                           rounded-xl p-6 text-center transition-colors group block cursor-pointer
                           ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    setActiveType(mode === 'qualirepar' ? 'qualirepar' : typeInfo.value)
                    handleFiles(e.target.files, mode === 'qualirepar' ? 'qualirepar' : typeInfo.value)
                    e.target.value = ''
                  }}
                  style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
                />
                <Camera className="w-6 h-6 text-gray-700 group-hover:text-amber-500 mx-auto mb-2 transition-colors" />
                <p className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                  {mode === 'qualirepar'
                    ? 'Prenez une photo pour le dossier QualiRépar'
                    : `Ajouter une photo "${typeInfo.label}"`}
                </p>
              </label>
            ) : (
              /* Grille de photos */
              <div className="grid grid-cols-3 gap-1.5">
                {typePhotos.map(photo => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden
                               bg-white/5 cursor-pointer"
                    onClick={() => setLightbox(photo.url)}
                  >
                    {/* Miniature */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url ?? photo.url}
                      alt={photo.label ?? typeInfo.label}
                      className="w-full h-full object-cover transition-transform duration-200
                                 group-hover:scale-105"
                    />

                    {/* Overlay actions au hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40
                                    transition-all flex items-center justify-center gap-1
                                    opacity-0 group-hover:opacity-100">
                      <button
                        onClick={e => { e.stopPropagation(); setLightbox(photo.url) }}
                        className="p-1.5 rounded-lg bg-white/90 text-gray-900 hover:bg-white
                                   transition-colors"
                        title="Agrandir"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(photo) }}
                        disabled={deleting === photo.id}
                        className="p-1.5 rounded-lg bg-red-500/90 text-white hover:bg-red-500
                                   transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deleting === photo.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />
                        }
                      </button>
                    </div>

                    {/* Date au bas */}
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white
                                    text-[9px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100
                                    transition-opacity">
                      {new Date(photo.taken_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short',
                      })}
                    </div>
                  </div>
                ))}

                {/* Bouton d'ajout rapide dans la grille (label pour iOS Safari) */}
                <label
                  className={`aspect-square rounded-lg border-2 border-dashed border-white/10
                             hover:border-amber-500/40 flex flex-col items-center justify-center
                             gap-1 text-gray-600 hover:text-amber-400 transition-colors cursor-pointer
                             ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      setActiveType(typeInfo.value)
                      handleFiles(e.target.files, typeInfo.value)
                      e.target.value = ''
                    }}
                    style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
                  />
                  <span className="text-lg">+</span>
                  <span className="text-[9px]">Ajouter</span>
                </label>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* Bouton fermer */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20
                       text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image principale */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Photo agrandie"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {/* Bouton téléchargement */}
          <a
            href={lightbox}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2
                       bg-white/15 hover:bg-white/25 text-white text-sm font-medium
                       rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger
          </a>
        </div>
      )}
    </div>
  )
}

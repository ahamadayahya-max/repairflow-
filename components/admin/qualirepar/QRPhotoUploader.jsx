'use client'

import { useState, useRef, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { uploadTicketPhoto } from '@/lib/utils/photoStorage'
import { Camera, Images, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Upload photos QualiRépar avec prévisualisation avant envoi
// ---------------------------------------------------------------------------

const REQUIRED_TYPES = [
  { v: 'before',  l: 'Avant réparation', i: '📸', req: true  },
  { v: 'after',   l: 'Après réparation', i: '✅', req: true  },
  { v: 'part',    l: 'Pièce remplacée',  i: '🔩', req: false },
  { v: 'invoice', l: 'Facture signée',   i: '🧾', req: true  },
]

/**
 * Composant upload photos pour le dossier QualiRépar.
 * Affiche une prévisualisation avant l'envoi effectif vers Supabase Storage.
 *
 * @param {{
 *   ticketId: string,
 *   shopId: string,
 *   onPhotosChange?: (count: number) => void,
 * }} props
 */
export default function QRPhotoUploader({ ticketId, shopId, onPhotosChange }) {
  const supabase   = getSupabaseClient()
  const cameraRef  = useRef(null)
  const galleryRef = useRef(null)

  const [previews,    setPreviews]    = useState([])   // { id, file, type, typeLabel, previewUrl, status }
  const [uploading,   setUploading]   = useState(false)
  const [activeType,  setActiveType]  = useState('before')
  const [flashMsg,    setFlashMsg]    = useState(null)

  function flash(type, text) {
    setFlashMsg({ type, text })
    setTimeout(() => setFlashMsg(null), 4000)
  }

  // Ajoute des fichiers à la file de prévisualisation
  const addToPreviews = useCallback((files, type) => {
    if (!files || files.length === 0) return
    const typeInfo = REQUIRED_TYPES.find(t => t.v === type)
    const newItems = Array.from(files)
      .filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
      .map(file => ({
        id:         Math.random().toString(36).slice(2),
        file,
        type,
        typeLabel:  typeInfo?.l ?? type,
        previewUrl: URL.createObjectURL(file),
        status:     'pending',
      }))
    if (newItems.length < Array.from(files).length) {
      flash('error', 'Certains fichiers ignorés (format non supporté ou > 10 Mo)')
    }
    setPreviews(prev => [...prev, ...newItems])
  }, [])

  // Retire un élément de la prévisualisation
  function removePreview(id) {
    setPreviews(prev => {
      const item = prev.find(p => p.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }

  // Upload tous les éléments en statut "pending"
  async function uploadAll() {
    const pending = previews.filter(p => p.status === 'pending')
    if (pending.length === 0) return
    setUploading(true)

    let doneCount  = previews.filter(p => p.status === 'done').length
    let errorCount = 0

    for (const item of pending) {
      setPreviews(prev => prev.map(p =>
        p.id === item.id ? { ...p, status: 'uploading' } : p
      ))
      try {
        const { url, thumbnailUrl } = await uploadTicketPhoto(
          item.file, ticketId, shopId, item.type, supabase
        )
        await supabase.from('ticket_photos').insert({
          ticket_id:     ticketId,
          shop_id:       shopId,
          url,
          thumbnail_url: thumbnailUrl,
          type:          item.type,
          label:         item.typeLabel,
          size_bytes:    item.file.size,
          mime_type:     item.file.type,
        })
        setPreviews(prev => prev.map(p =>
          p.id === item.id ? { ...p, status: 'done', url } : p
        ))
        doneCount++
      } catch (err) {
        setPreviews(prev => prev.map(p =>
          p.id === item.id ? { ...p, status: 'error' } : p
        ))
        errorCount++
      }
    }

    setUploading(false)
    onPhotosChange?.(doneCount)
    if (errorCount === 0) flash('success', `${pending.length} photo${pending.length > 1 ? 's' : ''} envoyée${pending.length > 1 ? 's' : ''}`)
    else flash('error', `${errorCount} photo${errorCount > 1 ? 's' : ''} en erreur`)
  }

  const pendingCount = previews.filter(p => p.status === 'pending').length
  const doneCount    = previews.filter(p => p.status === 'done').length

  return (
    <div className="space-y-4">

      {/* ── Sélecteur de type actif ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {REQUIRED_TYPES.map(type => {
          const done    = previews.some(p => p.type === type.v && p.status === 'done')
          const pending = previews.some(p => p.type === type.v && p.status === 'pending')
          const isActive = activeType === type.v
          return (
            <button
              key={type.v}
              type="button"
              onClick={() => setActiveType(type.v)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs
                          font-medium transition-all
                          ${done
                            ? 'border-green-500/50 bg-green-500/8 text-green-400'
                            : pending
                            ? 'border-amber-500/50 bg-amber-500/8 text-amber-400'
                            : isActive
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-dashed border-white/10 text-gray-600 hover:border-white/20 hover:text-gray-400'}`}
            >
              <span className="text-xl">{type.i}</span>
              <span className="text-center leading-tight">{type.l}</span>
              {type.req && !done && (
                <span className="text-[9px] text-red-400">* requis</span>
              )}
              {done && (
                <span className="text-[9px] text-green-400 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> OK
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Boutons capture ── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl
                     bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold text-sm
                     transition-colors disabled:opacity-40 shadow-md shadow-amber-500/20"
        >
          <Camera className="w-5 h-5" />
          📷 Prendre une photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl
                     bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300
                     font-semibold text-sm transition-colors disabled:opacity-40"
        >
          <Images className="w-5 h-5" />
          Galerie
        </button>
      </div>

      {/* Inputs cachés */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          addToPreviews(e.target.files, activeType)
          if (cameraRef.current) cameraRef.current.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          addToPreviews(e.target.files, activeType)
          if (galleryRef.current) galleryRef.current.value = ''
        }}
      />

      {/* ── Flash message ── */}
      {flashMsg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border
          ${flashMsg.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {flashMsg.type === 'success'
            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
          {flashMsg.text}
        </div>
      )}

      {/* ── Grille de prévisualisation ── */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400">
              Prévisualisation — {previews.length} photo{previews.length > 1 ? 's' : ''}
            </p>
            {pendingCount > 0 && (
              <span className="text-xs text-amber-400">{pendingCount} en attente d'envoi</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {previews.map(item => (
              <div
                key={item.id}
                className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={item.typeLabel}
                  className="w-full h-full object-cover"
                />

                {/* Overlay statut */}
                <div className={`absolute inset-0 flex items-center justify-center
                  ${item.status === 'uploading' ? 'bg-black/50'
                    : item.status === 'done'     ? 'bg-green-500/20'
                    : item.status === 'error'    ? 'bg-red-500/20'
                    : 'bg-transparent'}`}>
                  {item.status === 'uploading' && (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  )}
                  {item.status === 'done' && (
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Label type */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                  <p className="text-white text-[9px] font-medium">{item.typeLabel}</p>
                </div>

                {/* Bouton supprimer (pending uniquement) */}
                {item.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => removePreview(item.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500
                               text-white flex items-center justify-center
                               opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Bouton valider et envoyer */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={uploadAll}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-green-600 hover:bg-green-500 text-white font-bold text-sm
                         transition-colors disabled:opacity-50"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
                : <>✅ Valider et envoyer {pendingCount} photo{pendingCount > 1 ? 's' : ''}</>}
            </button>
          )}

          {/* Récap photos envoyées */}
          {doneCount > 0 && pendingCount === 0 && !uploading && (
            <div className="flex items-center gap-2 text-sm text-green-400
                            bg-green-500/8 border border-green-500/20 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{doneCount} photo{doneCount > 1 ? 's' : ''} ajoutée{doneCount > 1 ? 's' : ''} au dossier</span>
            </div>
          )}
        </div>
      )}

      {/* Aide si aucune photo */}
      {previews.length === 0 && (
        <p className="text-xs text-gray-600 text-center py-2">
          Sélectionnez un type de photo ci-dessus, puis appuyez sur{' '}
          <strong className="text-amber-500/80">📷 Prendre une photo</strong> ou choisissez depuis votre galerie.
        </p>
      )}
    </div>
  )
}

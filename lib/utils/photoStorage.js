/**
 * Utilitaires d'upload et de gestion des photos de tickets.
 * Gère la compression canvas, l'upload vers Supabase Storage
 * et la suppression depuis la base + Storage.
 */

export const PHOTO_BUCKET = 'ticket-photos'

// ---------------------------------------------------------------------------
// Compression canvas
// ---------------------------------------------------------------------------

/**
 * Compresse une image côté navigateur via un canvas.
 * @param {File} file - Le fichier image original
 * @param {number} maxWidth - Largeur maximale en pixels
 * @param {number} quality - Qualité JPEG (0-1)
 * @returns {Promise<Blob>}
 */
export function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const ratio    = Math.min(maxWidth / img.width, 1)
      const canvas   = document.createElement('canvas')
      canvas.width   = Math.round(img.width  * ratio)
      canvas.height  = Math.round(img.height * ratio)

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression échouée')),
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Impossible de charger l\'image'))
    }

    img.src = objectUrl
  })
}

// ---------------------------------------------------------------------------
// Upload d'une photo de ticket
// ---------------------------------------------------------------------------

/**
 * Compresse et upload une photo vers Supabase Storage.
 * Génère aussi une miniature (300px) pour l'affichage en grille.
 *
 * @param {File} file - Fichier image à uploader
 * @param {string} ticketId - UUID du ticket
 * @param {string} shopId - UUID de l'atelier
 * @param {string} type - Type de photo (before|after|damage|part|qualirepar|invoice|other)
 * @param {object} supabase - Client Supabase initialisé
 * @returns {Promise<{ url: string, thumbnailUrl: string }>}
 */
export async function uploadTicketPhoto(file, ticketId, shopId, type, supabase) {
  const ext       = file.type === 'image/png' ? 'png' : 'jpg'
  const timestamp = Date.now()
  const path      = `${shopId}/${ticketId}/${type}/${timestamp}.${ext}`
  const thumbPath = `${shopId}/${ticketId}/${type}/${timestamp}_thumb.${ext}`

  // Compresse l'image principale (max 1200px, qualité 85%)
  const compressed = await compressImage(file, 1200, 0.85)

  // Upload image principale
  const { error: uploadErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

  if (uploadErr) throw new Error(`Upload échoué : ${uploadErr.message}`)

  // Génère l'URL publique
  const { data: urlData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(path)

  // Compresse la miniature (max 300px, qualité 70%)
  try {
    const thumb = await compressImage(file, 300, 0.70)
    await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: false })
  } catch {
    // La miniature est optionnelle — on continue sans elle
  }

  const { data: thumbData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(thumbPath)

  return {
    url:          urlData.publicUrl,
    thumbnailUrl: thumbData.publicUrl,
  }
}

// ---------------------------------------------------------------------------
// Suppression d'une photo
// ---------------------------------------------------------------------------

/**
 * Supprime une photo du Storage Supabase et de la table ticket_photos.
 *
 * @param {string} url - URL publique de la photo
 * @param {string} photoId - UUID de la ligne dans ticket_photos
 * @param {object} supabase - Client Supabase initialisé
 * @returns {Promise<void>}
 */
export async function deleteTicketPhoto(url, photoId, supabase) {
  // Extrait le chemin depuis l'URL publique
  const marker = `${PHOTO_BUCKET}/`
  const idx    = url.indexOf(marker)
  if (idx !== -1) {
    const filePath  = url.slice(idx + marker.length)
    const thumbPath = filePath.replace(/\.(jpg|jpeg|png|webp)$/i, '_thumb.$1')

    // Supprime les deux fichiers en parallèle (sans bloquer sur erreur miniature)
    await Promise.allSettled([
      supabase.storage.from(PHOTO_BUCKET).remove([filePath]),
      supabase.storage.from(PHOTO_BUCKET).remove([thumbPath]),
    ])
  }

  // Supprime la ligne en base
  await supabase.from('ticket_photos').delete().eq('id', photoId)
}

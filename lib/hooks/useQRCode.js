import { useEffect, useState } from 'react'

/**
 * Génère un QR code en data URL à partir d'une URL.
 * @param {string} url
 * @returns {string} dataUrl PNG en base64
 */
export function useQRCode(url) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!url) return
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(url, {
        width: 160, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(setDataUrl).catch(console.error)
    })
  }, [url])

  return dataUrl
}

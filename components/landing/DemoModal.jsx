'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Modale de demande de démo.
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
export default function DemoModal({ isOpen, onClose }) {
  const [form, setForm] = useState({
    prenom: '',
    nom_atelier: '',
    email: '',
    telephone: '',
    message: '',
  })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Une erreur est survenue.')
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch {
      setErrorMsg('Impossible de joindre le serveur. Veuillez réessayer.')
      setStatus('error')
    }
  }

  const inputClass =
    'w-full bg-[#08080F] border border-white/10 rounded-lg px-4 py-3 text-[#F1F0ED] placeholder-[#4B5563] focus:outline-none focus:border-amber-500/50 transition-colors text-sm'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Carte modale */}
      <div
        className="relative bg-[#111118] border border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#F1F0ED] transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-[#F1F0ED] mb-1">Demander une démo</h2>
        <p className="text-[#9CA3AF] text-sm mb-6">
          On vous rappelle sous 24h pour une démo personnalisée, gratuite et sans engagement.
        </p>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-amber-400 text-2xl">✓</span>
            </div>
            <p className="text-[#F1F0ED] font-semibold mb-2">Demande envoyée !</p>
            <p className="text-[#9CA3AF] text-sm">
              Nous vous contactons sous 24h pour organiser votre démo.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1.5">Prénom *</label>
                <input
                  name="prenom"
                  value={form.prenom}
                  onChange={handleChange}
                  required
                  placeholder="Jean"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1.5">Nom de l'atelier *</label>
                <input
                  name="nom_atelier"
                  value={form.nom_atelier}
                  onChange={handleChange}
                  required
                  placeholder="L'Atelier du Mobile"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#9CA3AF] mb-1.5">Email professionnel *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="jean@monatelier.fr"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs text-[#9CA3AF] mb-1.5">Téléphone *</label>
              <input
                name="telephone"
                type="tel"
                value={form.telephone}
                onChange={handleChange}
                required
                placeholder="+33 6 12 34 56 78"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs text-[#9CA3AF] mb-1.5">
                Message <span className="text-[#4B5563]">(optionnel)</span>
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={3}
                placeholder="Dites-nous en plus sur votre atelier ou vos besoins..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-3 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'Envoi en cours…' : 'Demander ma démo gratuite'}
            </button>

            <p className="text-center text-xs text-[#4B5563]">
              Aucun engagement · Réponse sous 24h
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

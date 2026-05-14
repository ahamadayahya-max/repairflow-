'use client'

import { useEffect } from 'react'
import { AlertTriangle, Archive, Trash2 } from 'lucide-react'

/**
 * Dialog de confirmation réutilisable pour les actions irréversibles.
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 *   icon?: 'warning' | 'archive' | 'delete',
 *   loading?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel  = 'Annuler',
  danger       = false,
  icon         = 'warning',
  loading      = false,
  onConfirm,
  onCancel,
}) {
  // Fermeture sur Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const ICONS = {
    warning: <AlertTriangle className="w-6 h-6 text-amber-400" />,
    archive: <Archive className="w-6 h-6 text-orange-400" />,
    delete:  <Trash2 className="w-6 h-6 text-red-400" />,
  }

  const confirmBtnCls = danger
    ? 'flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50'
    : 'flex-1 bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50'

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10"
        style={{ background: '#111118' }}
      >
        {/* Icône */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
            {ICONS[icon] ?? ICONS.warning}
          </div>
        </div>

        {/* Texte */}
        <h3 className="text-base font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed">{message}</p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={confirmBtnCls}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                En cours…
              </span>
            ) : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300
                       font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

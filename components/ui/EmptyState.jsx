'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

/**
 * État vide avec icône, message et call-to-action.
 * @param {{
 *   icon: React.ReactNode,
 *   title: string,
 *   description?: string,
 *   actionLabel?: string,
 *   actionHref?: string,
 *   onAction?: () => void,
 *   compact?: boolean,
 * }} props
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact = false,
}) {
  const py = compact ? 'py-10' : 'py-16'

  return (
    <div className={`flex flex-col items-center justify-center ${py} text-center px-4`}>
      {/* Icône dans un cercle */}
      <div className="w-14 h-14 rounded-2xl bg-white/4 flex items-center justify-center mb-4 border border-white/8">
        {icon}
      </div>

      <p className="text-sm font-semibold text-gray-300 mb-1">{title}</p>

      {description && (
        <p className="text-xs text-gray-600 max-w-xs mb-4">{description}</p>
      )}

      {/* Bouton d'action */}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400
                       text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}

'use client'

// ---------------------------------------------------------------------------
// Badge statut QualiRépar — réutilisable partout dans l'app
// ---------------------------------------------------------------------------

const CONFIG = {
  non_eligible:     { label: 'Non éligible',      bg: 'bg-gray-400/10',    color: 'text-gray-400',    icon: '○'  },
  eligible:         { label: 'À soumettre',        bg: 'bg-amber-400/10',   color: 'text-amber-400',   icon: '◎'  },
  support_pending:  { label: 'SMS client envoyé',  bg: 'bg-blue-400/10',    color: 'text-blue-400',    icon: '⏳' },
  support_accepted: { label: 'Validé',             bg: 'bg-green-400/10',   color: 'text-green-400',   icon: '✓'  },
  support_refused:  { label: 'Refusé client',      bg: 'bg-red-400/10',     color: 'text-red-400',     icon: '✕'  },
  claim_submitted:  { label: 'Dossier soumis',     bg: 'bg-blue-400/10',    color: 'text-blue-400',    icon: '📤' },
  claim_accepted:   { label: 'Dossier accepté',    bg: 'bg-green-400/10',   color: 'text-green-400',   icon: '✅' },
  claim_refused:    { label: 'Dossier refusé',     bg: 'bg-red-400/10',     color: 'text-red-400',     icon: '❌' },
  paid:             { label: 'Remboursé',          bg: 'bg-emerald-400/10', color: 'text-emerald-400', icon: '💰' },
}

/**
 * Badge statut QualiRépar.
 * @param {{ status: string, size?: 'sm'|'md' }} props
 */
export default function QRStatusBadge({ status, size = 'md' }) {
  const c = CONFIG[status] ?? CONFIG.non_eligible
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full
      ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}
      ${c.bg} ${c.color}`}>
      {c.icon} {c.label}
    </span>
  )
}

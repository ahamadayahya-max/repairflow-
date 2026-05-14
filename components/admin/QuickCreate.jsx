'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Ticket, Users, FileText, Receipt, CalendarDays, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Actions de création rapide
// ---------------------------------------------------------------------------
const ACTIONS = [
  {
    label: 'Nouveau ticket',
    icon: Ticket,
    href: '/admin/tickets/new',
    shortcut: 'T',
    color: 'text-blue-400',
  },
  {
    label: 'Nouveau client',
    icon: Users,
    href: '/admin/clients/new',
    shortcut: 'C',
    color: 'text-green-400',
  },
  {
    label: 'Nouveau devis',
    icon: FileText,
    href: '/admin/devis/nouveau',
    shortcut: 'D',
    color: 'text-purple-400',
  },
  {
    label: 'Nouvelle facture',
    icon: Receipt,
    href: '/admin/factures/nouvelle',
    shortcut: 'F',
    color: 'text-amber-400',
  },
  {
    label: 'Nouveau RDV',
    icon: CalendarDays,
    href: '/admin/agenda',
    shortcut: 'R',
    color: 'text-pink-400',
  },
]

/**
 * Bouton "+" avec dropdown de création rapide.
 * Raccourcis clavier affichés dans le menu.
 */
export default function QuickCreate() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Ferme au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Raccourcis clavier (Alt + lettre)
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return
      const action = ACTIONS.find(a => a.shortcut.toLowerCase() === e.key.toLowerCase())
      if (action) {
        e.preventDefault()
        router.push(action.href)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [router])

  const navigate = (href) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bouton + */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400
                   text-white text-sm font-semibold transition-colors"
        title="Création rapide"
      >
        {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        <span className="hidden sm:inline">Nouveau</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#1A1A27] border border-white/15
                        rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          {ACTIONS.map(({ label, icon: Icon, href, shortcut, color }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left
                         hover:bg-white/5 transition-colors group"
            >
              <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center
                               flex-shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <span className="flex-1 text-sm text-gray-300 group-hover:text-white transition-colors">
                {label}
              </span>
              {/* Raccourci Alt+lettre */}
              <span className="text-[10px] text-gray-700 font-mono">Alt+{shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

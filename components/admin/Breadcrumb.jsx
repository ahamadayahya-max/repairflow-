'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Map des segments statiques
// ---------------------------------------------------------------------------
const SEGMENT_MAP = {
  overview:     "Vue d'ensemble",
  tickets:      'Tickets',
  new:          'Nouveau ticket',
  clients:      'Clients',
  parts:        'Stock & Pièces',
  agenda:       'Agenda',
  devis:        'Devis',
  nouveau:      'Nouveau devis',
  factures:     'Factures',
  nouvelle:     'Nouvelle facture',
  comptabilite: 'Comptabilité',
  qualirepar:   'QualiRépar',
  conformite:   'Conformité label',
  settings:     'Paramètres',
  techniciens:  'Techniciens',
  commandes:    'Commandes',
  notifications:'Notifications',
}

// UUID regex pour détecter les segments dynamiques
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Breadcrumb dynamique basé sur l'URL courante.
 * Charge le libellé d'une ressource (ticket, client, facture, devis) si le segment est un UUID.
 */
export default function Breadcrumb() {
  const pathname = usePathname()
  const supabase = getSupabaseClient()

  // Labels chargés dynamiquement pour les segments UUID : { [uuid]: string }
  const [dynamicLabels, setDynamicLabels] = useState({})

  // Segments sans le préfixe /admin
  const segments = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)

  // ---------------------------------------------------------------------------
  // Chargement du libellé de la ressource si le chemin contient un UUID
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadLabel = async () => {
      // On cherche un UUID dans les segments
      const uuidIdx = segments.findIndex(s => UUID_RE.test(s))
      if (uuidIdx < 0) return

      const uuid   = segments[uuidIdx]
      const parent = segments[uuidIdx - 1]  // ex: 'tickets', 'clients', 'factures', 'devis'

      if (dynamicLabels[uuid]) return // déjà chargé

      let label = null

      try {
        if (parent === 'tickets') {
          const { data } = await supabase
            .from('tickets').select('ticket_number, device_brand, device_model').eq('id', uuid).maybeSingle()
          if (data) label = data.ticket_number ? `#${data.ticket_number}` : [data.device_brand, data.device_model].filter(Boolean).join(' ') || uuid.slice(0, 8)
        } else if (parent === 'clients') {
          const { data } = await supabase
            .from('clients').select('full_name').eq('id', uuid).maybeSingle()
          if (data) label = data.full_name
        } else if (parent === 'factures') {
          const { data } = await supabase
            .from('invoices').select('invoice_number').eq('id', uuid).maybeSingle()
          if (data) label = `Facture ${data.invoice_number}`
        } else if (parent === 'devis') {
          const { data } = await supabase
            .from('quotes').select('quote_number').eq('id', uuid).maybeSingle()
          if (data) label = `Devis ${data.quote_number}`
        } else if (parent === 'commandes') {
          const { data } = await supabase
            .from('purchase_orders').select('order_number').eq('id', uuid).maybeSingle()
          if (data) label = `Commande ${data.order_number}`
        }
      } catch (_) {
        // Silencieux
      }

      if (label) {
        setDynamicLabels(prev => ({ ...prev, [uuid]: label }))
      }
    }

    loadLabel()
  }, [pathname])

  // ---------------------------------------------------------------------------
  // Construction des miettes de pain
  // ---------------------------------------------------------------------------
  const crumbs = []

  // Racine admin
  crumbs.push({ label: 'Admin', href: '/admin' })

  let path = '/admin'
  segments.forEach((seg, idx) => {
    path += `/${seg}`
    const isLast = idx === segments.length - 1
    let label

    if (UUID_RE.test(seg)) {
      label = dynamicLabels[seg] ?? seg.slice(0, 8) + '…'
    } else {
      label = SEGMENT_MAP[seg] ?? seg
    }

    crumbs.push({ label, href: path, isLast })
  })

  // Si on est exactement sur /admin, on n'affiche rien (page dashboard)
  if (segments.length === 0) {
    return <span className="text-sm font-medium text-white">Tableau de bord</span>
  }

  return (
    <nav className="flex items-center gap-1 min-w-0" aria-label="Fil d'Ariane">
      {crumbs.map((crumb, idx) => (
        <span key={crumb.href} className="flex items-center gap-1 min-w-0">
          {idx > 0 && (
            <span className="text-gray-600 flex-shrink-0 text-sm">›</span>
          )}
          {crumb.isLast ? (
            <span className="text-sm font-medium text-white truncate max-w-[200px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-sm text-gray-500 hover:text-gray-300 truncate max-w-[120px]
                         transition-colors flex-shrink-0"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

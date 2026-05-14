'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Smartphone, Laptop, Tablet, Tv, Package } from 'lucide-react'

/**
 * Ligne de ticket animée avec indicateur de statut et barre de progression.
 * @param {{
 *   ticket: {
 *     id: string,
 *     status: 'pending'|'in_repair'|'ready'|'delivered',
 *     device_type: string,
 *     device_brand: string,
 *     device_model: string,
 *     clients: { full_name: string } | null,
 *     received_at: string,
 *   },
 *   index: number,
 * }} props
 */
export default function FuturisticTicketRow({ ticket, index }) {
  const STATUS = {
    pending:   { label: 'En attente',    color: '#f59e0b', progress: 25 },
    in_repair: { label: 'En réparation', color: '#3b82f6', progress: 60 },
    ready:     { label: 'Prêt',          color: '#10b981', progress: 90 },
    delivered: { label: 'Livré',         color: '#6b7280', progress: 100 },
  }

  const ICONS = { smartphone: Smartphone, tablet: Tablet, laptop: Laptop, tv: Tv }

  const cfg  = STATUS[ticket.status] ?? STATUS.pending
  const Icon = ICONS[ticket.device_type] ?? Package
  const device = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type

  const date = ticket.received_at
    ? new Date(ticket.received_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    : '—'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
    >
      <Link
        href={`/admin/tickets/${ticket.id}`}
        className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-transparent
                   hover:border-white/10 hover:bg-white/[0.03] transition-all duration-200"
      >
        {/* Indicateur de statut */}
        <div
          className="w-1.5 h-10 rounded-full flex-shrink-0"
          style={{
            background: cfg.color,
            boxShadow: `0 0 8px ${cfg.color}60`,
          }}
        />

        {/* Icône appareil */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.color + '15', border: `1px solid ${cfg.color}25` }}
        >
          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-white font-medium truncate">
              {ticket.clients?.full_name ?? '—'}
            </p>
            <span className="text-xs text-gray-600 flex-shrink-0">{date}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-500 truncate">{device}</p>
          </div>

          {/* Barre de progression */}
          <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: cfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${cfg.progress}%` }}
              transition={{ duration: 0.8, delay: index * 0.06 + 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Badge statut */}
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            color: cfg.color,
            background: cfg.color + '18',
            border: `1px solid ${cfg.color}30`,
          }}
        >
          {cfg.label}
        </span>
      </Link>
    </motion.div>
  )
}

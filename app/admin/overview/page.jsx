'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Wrench, ArrowRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Modules de la plateforme
// ---------------------------------------------------------------------------

const MODULES = [
  {
    id:     'tickets',
    label:  'Tickets',
    emoji:  '🎫',
    color:  '#14B8A6',
    bg:     'rgba(20,184,166,0.15)',
    status: 'actif',
    href:   '/admin/tickets',
    desc:   'Créez et suivez les réparations. Chaque ticket trace le cycle de vie complet d\'un appareil, des pièces utilisées aux notifications client automatiques.',
  },
  {
    id:     'clients',
    label:  'CRM Clients',
    emoji:  '👥',
    color:  '#3B82F6',
    bg:     'rgba(59,130,246,0.15)',
    status: 'actif',
    href:   '/admin/clients',
    desc:   'Base de données clients unifiée. Retrouvez l\'historique de réparations, les coordonnées et les préférences de chaque client en un coup d\'œil.',
  },
  {
    id:     'parts',
    label:  'Stock',
    emoji:  '📦',
    color:  '#A855F7',
    bg:     'rgba(168,85,247,0.15)',
    status: 'actif',
    href:   '/admin/parts',
    desc:   'Gérez votre inventaire de pièces détachées, suivez les niveaux de stock et recevez des alertes de réapprovisionnement avant la rupture.',
  },
  {
    id:     'dashboard',
    label:  'Dashboard',
    emoji:  '📊',
    color:  '#60A5FA',
    bg:     'rgba(96,165,250,0.15)',
    status: 'actif',
    href:   '/admin',
    desc:   'Tableau de bord temps réel avec KPIs, graphiques de volume hebdomadaire et alertes de stock. Vue synthétique de votre activité quotidienne.',
  },
  {
    id:     'agenda',
    label:  'Agenda',
    emoji:  '📅',
    color:  '#F59E0B',
    bg:     'rgba(245,158,11,0.15)',
    status: 'actif',
    href:   '/admin/agenda',
    desc:   'Planifiez les rendez-vous de dépose et de récupération d\'appareils. Glisser-déposer, rappels SMS automatiques et vue hebdomadaire intégrée.',
  },
  {
    id:     'devis',
    label:  'Devis',
    emoji:  '📄',
    color:  '#F97316',
    bg:     'rgba(249,115,22,0.15)',
    status: 'actif',
    href:   '/admin/devis',
    desc:   'Générez des devis professionnels en quelques clics et convertissez-les directement en factures d\'un simple bouton.',
  },
  {
    id:     'factures',
    label:  'Factures',
    emoji:  '🧾',
    color:  '#22C55E',
    bg:     'rgba(34,197,94,0.15)',
    status: 'actif',
    href:   '/admin/factures',
    desc:   'Créez et envoyez des factures conformes à la législation. Suivi des paiements et export comptable intégré pour votre expert-comptable.',
  },
  {
    id:     'qualirepar',
    label:  'QualiRépar',
    emoji:  '🔁',
    color:  '#EC4899',
    bg:     'rgba(236,72,153,0.15)',
    status: 'en-cours',
    href:   '/admin/qualirepar',
    desc:   'Conformité au label QualiRépar. Suivi des critères de qualité de réparation et génération automatique des rapports de certification.',
  },
]

const STATUS_CONFIG = {
  'actif':         { label: 'Actif',          color: 'text-green-400', bg: 'bg-green-400/10'  },
  'en-cours':      { label: 'En cours',        color: 'text-amber-400', bg: 'bg-amber-400/10'  },
  'a-implementer': { label: 'À implémenter',   color: 'text-gray-400',  bg: 'bg-gray-400/10'   },
}

// ---------------------------------------------------------------------------
// Page Vue d'ensemble — diagramme orbital
// ---------------------------------------------------------------------------

/**
 * Page d'accueil visuelle avec diagramme orbital des modules RepairFlow.
 */
export default function OverviewPage() {
  const containerRef = useRef(null)
  const [dims,     setDims]     = useState({ w: 600, h: 500 })
  const [selected, setSelected] = useState(null)

  // Recalcule les dimensions à chaque redimensionnement du conteneur
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    setDims({ w: el.offsetWidth, h: el.offsetHeight })

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = dims
  const cx     = w / 2
  const cy     = h / 2
  const radius = Math.min(w, h) * 0.38
  const n      = MODULES.length
  // Rayon des nœuds adaptatif — entre 28 et 44 px
  const nodeR  = Math.max(28, Math.min(44, Math.min(w, h) * 0.075))
  // Rayon du nœud central
  const centerR = nodeR * 1.4

  function getPos(i) {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  }

  const selectedModule = MODULES.find(m => m.id === selected) ?? null

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div>
        <h1 className="text-white font-bold text-xl">Vue d'ensemble</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Plateforme RepairFlow — modules et intégrations
        </p>
      </div>

      {/* ── Diagramme orbital ── */}
      <div
        ref={containerRef}
        className="relative w-full bg-[#111118] rounded-2xl border border-white/10 overflow-hidden select-none"
        style={{ height: '520px' }}
        onClick={() => setSelected(null)}
      >

        {/* Halo ambiant du centre */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width:  radius * 2,
            height: radius * 2,
            left:   cx - radius,
            top:    cy - radius,
            background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
          }}
        />

        {/* Lignes SVG — dashed au repos, solide si actif */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={w}
          height={h}
        >
          {MODULES.map((mod, i) => {
            const { x, y } = getPos(i)
            const isActive  = mod.id === selected
            // Raccourcit la ligne pour ne pas entrer dans le nœud
            const dx      = x - cx
            const dy      = y - cy
            const len     = Math.sqrt(dx * dx + dy * dy) || 1
            const x1Off   = cx + (dx / len) * centerR
            const y1Off   = cy + (dy / len) * centerR
            const x2Off   = x  - (dx / len) * nodeR
            const y2Off   = y  - (dy / len) * nodeR
            return (
              <line
                key={mod.id}
                x1={x1Off} y1={y1Off}
                x2={x2Off} y2={y2Off}
                stroke={isActive ? mod.color : 'rgba(255,255,255,0.1)'}
                strokeWidth={isActive ? 1.5 : 1}
                strokeDasharray={isActive ? undefined : '5 4'}
                style={{ transition: 'stroke 0.25s, stroke-width 0.25s' }}
              />
            )
          })}
        </svg>

        {/* ── Nœud central ── */}
        <button
          className="absolute flex flex-col items-center justify-center rounded-full
                     bg-[#1A1A28] border-2 transition-colors cursor-pointer"
          style={{
            width:       centerR * 2,
            height:      centerR * 2,
            left:        cx - centerR,
            top:         cy - centerR,
            borderColor: selected ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)',
            boxShadow:   '0 0 32px rgba(245,158,11,0.08)',
          }}
          onClick={e => { e.stopPropagation(); setSelected(null) }}
        >
          <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center mb-0.5">
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-white font-bold" style={{ fontSize: Math.max(9, nodeR * 0.28) }}>
            RepairFlow
          </span>
          <span className="text-gray-500" style={{ fontSize: Math.max(7, nodeR * 0.21) }}>
            Plateforme
          </span>
        </button>

        {/* ── Nœuds des modules ── */}
        {MODULES.map((mod, i) => {
          const { x, y } = getPos(i)
          const isActive  = mod.id === selected
          const emojiSize = Math.max(14, nodeR * 0.6)
          const labelSize = Math.max(8, nodeR * 0.27)

          return (
            <button
              key={mod.id}
              onClick={e => { e.stopPropagation(); setSelected(isActive ? null : mod.id) }}
              className="absolute flex flex-col items-center justify-center rounded-full
                         transition-all duration-200 cursor-pointer"
              style={{
                width:      nodeR * 2,
                height:     nodeR * 2,
                left:       x - nodeR,
                top:        y - nodeR,
                background: isActive ? mod.bg : 'rgba(255,255,255,0.04)',
                border:     `2px solid ${isActive ? mod.color : 'rgba(255,255,255,0.1)'}`,
                boxShadow:  isActive ? `0 0 18px ${mod.color}44` : 'none',
                transform:  isActive ? 'scale(1.12)' : 'scale(1)',
              }}
              title={mod.label}
            >
              <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{mod.emoji}</span>
              <span
                className="font-medium text-center leading-tight mt-0.5 px-1"
                style={{
                  fontSize:  labelSize,
                  color:     isActive ? mod.color : '#9CA3AF',
                  maxWidth:  nodeR * 2.2,
                  overflow:  'hidden',
                  display:   '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {mod.label}
              </span>
            </button>
          )
        })}

        {/* Légende statuts en bas à droite */}
        <div className="absolute bottom-3 right-4 flex items-center gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
              <span className="text-[10px] text-gray-600">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panneau de détail ── */}
      {selectedModule ? (
        <div
          className="bg-[#111118] rounded-xl border p-5"
          style={{ borderColor: selectedModule.color + '40' }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              {/* Icône module */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                style={{ background: selectedModule.bg }}
              >
                {selectedModule.emoji}
              </div>
              {/* Titre + badge + description */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h2 className="text-white font-semibold text-base">{selectedModule.label}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                      ${STATUS_CONFIG[selectedModule.status].bg}
                      ${STATUS_CONFIG[selectedModule.status].color}`}
                  >
                    {STATUS_CONFIG[selectedModule.status].label}
                  </span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
                  {selectedModule.desc}
                </p>
              </div>
            </div>

            {/* Bouton d'accès (uniquement pour les modules actifs) */}
            {selectedModule.status === 'actif' && selectedModule.href !== '#' && (
              <Link
                href={selectedModule.href}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                           flex-shrink-0 transition-opacity hover:opacity-80"
                style={{
                  background:  selectedModule.bg,
                  color:       selectedModule.color,
                  border:      `1px solid ${selectedModule.color}40`,
                }}
              >
                Ouvrir
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="text-gray-600 text-sm">Cliquez sur un module pour en savoir plus</p>
        </div>
      )}

    </div>
  )
}

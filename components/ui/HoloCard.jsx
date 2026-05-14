'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'

/**
 * Carte KPI holographique avec effet tilt 3D et compteur animé.
 * @param {{
 *   title: string,
 *   value: number | string,
 *   suffix?: string,
 *   icon: React.ReactNode,
 *   gradient: string,
 *   glowColor: string,
 *   trend?: { value: number, label: string },
 *   delay?: number,
 * }} props
 */
export default function HoloCard({
  title,
  value,
  suffix = '',
  icon,
  gradient,
  glowColor,
  trend,
  delay = 0,
}) {
  const cardRef = useRef(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [hovered, setHovered] = useState(false)

  const { ref: inViewRef, inView } = useInView({ triggerOnce: true, threshold: 0.2 })

  const isNumeric = typeof value === 'number'

  // Calcul de l'effet tilt selon la position de la souris
  function handleMouseMove(e) {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width  - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    setTilt({ rotateX: -y * 8, rotateY: x * 8 })
  }

  function handleMouseLeave() {
    setTilt({ rotateX: 0, rotateY: 0 })
    setHovered(false)
  }

  return (
    <motion.div
      ref={inViewRef}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      style={{ perspective: 800 }}
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        animate={{
          rotateX: tilt.rotateX,
          rotateY: tilt.rotateY,
          scale: hovered ? 1.03 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative overflow-hidden rounded-2xl border cursor-default"
        style={{
          background: 'rgba(17,17,24,0.85)',
          borderColor: hovered ? glowColor + '60' : 'rgba(255,255,255,0.08)',
          boxShadow: hovered
            ? `0 0 30px 0 ${glowColor}30, 0 8px 32px rgba(0,0,0,0.4)`
            : '0 4px 24px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Reflet holographique */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: hovered ? 1 : 0 }}
          style={{
            background: `radial-gradient(ellipse at ${50 + tilt.rotateY * 3}% ${50 - tilt.rotateX * 3}%, ${glowColor}18 0%, transparent 70%)`,
          }}
        />

        {/* Barre de dégradé en haut */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: gradient }}
        />

        <div className="relative p-5 z-10">
          {/* En-tête icône + titre */}
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: glowColor + '20', border: `1px solid ${glowColor}30` }}
            >
              {icon}
            </div>
            {trend && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  trend.value >= 0
                    ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20'
                    : 'text-red-400 bg-red-400/10 border border-red-400/20'
                }`}
              >
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </span>
            )}
          </div>

          {/* Valeur principale */}
          <div className="mb-1">
            {isNumeric ? (
              <span className="text-3xl font-bold text-white tabular-nums">
                {inView ? (
                  <CountUp
                    end={value}
                    duration={1.5}
                    delay={delay}
                    separator=" "
                    suffix={suffix}
                  />
                ) : '0'}
              </span>
            ) : (
              <span className="text-3xl font-bold text-white">{value}{suffix}</span>
            )}
          </div>

          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{title}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

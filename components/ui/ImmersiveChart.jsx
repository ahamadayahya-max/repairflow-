'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

/**
 * Graphique immersif avec fond glassmorphism et animation d'entrée.
 * Doit être importé via next/dynamic avec ssr:false.
 * @param {{
 *   data: Array<{ name: string, [key: string]: number }>,
 *   dataKey: string,
 *   color?: string,
 *   title?: string,
 *   subtitle?: string,
 * }} props
 */
export default function ImmersiveChart({
  data,
  dataKey,
  color = '#f59e0b',
  title,
  subtitle,
}) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  // Tooltip personnalisé
  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div
        className="px-3 py-2 rounded-xl border text-sm"
        style={{
          background: 'rgba(17,17,24,0.95)',
          borderColor: color + '40',
          backdropFilter: 'blur(12px)',
          boxShadow: `0 4px 20px ${color}20`,
        }}
      >
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="font-bold" style={{ color }}>{payload[0].value}</p>
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative rounded-2xl border overflow-hidden p-5"
      style={{
        background: 'rgba(17,17,24,0.85)',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Halo de fond */}
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none opacity-10 blur-3xl"
        style={{ background: color, transform: 'translate(30%, -30%)' }}
      />

      {/* En-tête */}
      {(title || subtitle) && (
        <div className="mb-5 relative z-10">
          {title && <h3 className="text-white font-semibold text-base">{title}</h3>}
          {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Graphique */}
      <div className="relative z-10" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: '#111118', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

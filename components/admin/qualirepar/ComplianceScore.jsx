'use client'

// ---------------------------------------------------------------------------
// Jauge circulaire du score global de conformité QualiRépar
// + barres de progression par catégorie
// ---------------------------------------------------------------------------

const CATS = [
  { key: 'formation',     label: 'Formation',     icon: '🎓' },
  { key: 'materiel',      label: 'Matériel',       icon: '🔧' },
  { key: 'qualite',       label: 'Qualité',        icon: '⭐' },
  { key: 'transparence',  label: 'Transparence',   icon: '📋' },
  { key: 'environnement', label: 'Environnement',  icon: '♻️' },
]

function scoreColor(v) {
  if (v >= 80) return '#10B981'
  if (v >= 60) return '#F59E0B'
  return '#EF4444'
}

/**
 * Affiche la jauge circulaire et les barres de score par catégorie.
 * @param {{ score: object|null }} props
 */
export default function ComplianceScore({ score }) {
  const global = Number(score?.score_global ?? 0)
  const color  = scoreColor(global)

  return (
    <div className="bg-[#111118] border border-white/10 rounded-xl p-5">

      {/* Jauge circulaire SVG */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
            {/* Fond */}
            <circle cx="18" cy="18" r="15.9"
              fill="none" stroke="#ffffff0f" strokeWidth="3" />
            {/* Arc de progression */}
            <circle cx="18" cy="18" r="15.9"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${global} 100`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          {/* Valeur centrale */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color }}>{global}</span>
            <span className="text-xs text-gray-600">/100</span>
          </div>
        </div>

        <p className="text-white font-semibold text-sm mt-2 text-center">Score de conformité</p>
        <p className="text-xs text-gray-500 text-center mt-0.5">
          {global >= 80
            ? '🟢 Excellent — Label obtenu'
            : global >= 60
            ? '🟡 En progression'
            : '🔴 Actions requises'}
        </p>
      </div>

      {/* Barres par catégorie */}
      <div className="space-y-2.5">
        {CATS.map(cat => {
          const s = Number(score?.categories?.[cat.key]?.score ?? 0)
          const c = scoreColor(s)
          return (
            <div key={cat.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">{cat.icon} {cat.label}</span>
                <span className="font-mono font-semibold text-gray-300">{s}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${s}%`, backgroundColor: c }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

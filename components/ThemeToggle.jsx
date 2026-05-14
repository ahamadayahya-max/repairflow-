'use client'

import { useTheme } from '@/hooks/useTheme'

// ---------------------------------------------------------------------------
// Composants de bascule de thème
// ---------------------------------------------------------------------------

/**
 * Toggle compact pour la sidebar — bascule entre sombre et clair en un clic.
 */
export function ThemeToggleCompact() {
  const { resolved, setTheme } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl
                 transition-colors duration-200 hover:bg-white/5 group"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base select-none">{isDark ? '🌙' : '☀️'}</span>
        <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
          {isDark ? 'Mode sombre' : 'Mode clair'}
        </span>
      </div>

      {/* Switch animé */}
      <div
        className="relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-300"
        style={{ background: isDark ? 'rgba(245,158,11,0.2)' : '#F59E0B' }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300"
          style={{ left: isDark ? '2px' : '22px' }}
        />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Sélecteur complet 3 options — pour la page Paramètres
// ---------------------------------------------------------------------------

const OPTIONS = [
  {
    value: 'dark',
    icon:  '🌙',
    label: 'Sombre',
    desc:  'Idéal en atelier ou la nuit',
    preview: (
      <div className="w-full h-full flex" style={{ background: '#0d0d1a' }}>
        <div className="w-8 h-full" style={{ background: '#080810' }} />
        <div className="flex-1 p-1.5 space-y-1">
          <div className="h-1.5 rounded" style={{ background: '#161628', width: '70%' }} />
          <div className="h-1.5 rounded" style={{ background: '#161628', width: '50%' }} />
          <div className="h-1.5 rounded" style={{ background: '#F59E0B', width: '40%' }} />
        </div>
      </div>
    ),
  },
  {
    value: 'light',
    icon:  '☀️',
    label: 'Clair',
    desc:  'Idéal en journée',
    preview: (
      <div className="w-full h-full flex" style={{ background: '#F8FAFC' }}>
        <div className="w-8 h-full" style={{ background: '#FFFFFF', borderRight: '1px solid #E2E8F0' }} />
        <div className="flex-1 p-1.5 space-y-1">
          <div className="h-1.5 rounded" style={{ background: '#E2E8F0', width: '70%' }} />
          <div className="h-1.5 rounded" style={{ background: '#E2E8F0', width: '50%' }} />
          <div className="h-1.5 rounded" style={{ background: '#D97706', width: '40%' }} />
        </div>
      </div>
    ),
  },
  {
    value: 'system',
    icon:  '💻',
    label: 'Automatique',
    desc:  'Suit votre appareil',
    preview: (
      <div className="w-full h-full flex">
        <div className="w-1/2 h-full flex" style={{ background: '#0d0d1a' }}>
          <div className="w-4 h-full" style={{ background: '#080810' }} />
          <div className="flex-1 p-1 space-y-1">
            <div className="h-1 rounded" style={{ background: '#161628' }} />
            <div className="h-1 rounded" style={{ background: '#F59E0B', width: '60%' }} />
          </div>
        </div>
        <div className="w-1/2 h-full flex" style={{ background: '#F8FAFC' }}>
          <div className="w-4 h-full" style={{ background: '#FFF', borderRight: '1px solid #E2E8F0' }} />
          <div className="flex-1 p-1 space-y-1">
            <div className="h-1 rounded" style={{ background: '#E2E8F0' }} />
            <div className="h-1 rounded" style={{ background: '#D97706', width: '60%' }} />
          </div>
        </div>
      </div>
    ),
  },
]

/**
 * Sélecteur visuel 3 options (sombre / clair / automatique).
 * À placer dans la page Paramètres.
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map(opt => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200"
            style={{
              borderColor: active ? '#F59E0B' : 'rgba(255,255,255,0.1)',
              background:  active ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
            }}
          >
            {/* Miniature */}
            <div className="w-full h-14 rounded-xl overflow-hidden border"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {opt.preview}
            </div>

            {/* Icône + Label */}
            <div className="text-center">
              <div className="text-xl mb-0.5">{opt.icon}</div>
              <div className="text-xs font-semibold"
                style={{ color: active ? '#F59E0B' : '#e2e8f0' }}>
                {opt.label}
              </div>
              <div className="text-[10px] mt-0.5 text-gray-500">{opt.desc}</div>
            </div>

            {/* Indicateur actif */}
            {active && (
              <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center
                              text-black text-[10px] font-bold">
                ✓
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

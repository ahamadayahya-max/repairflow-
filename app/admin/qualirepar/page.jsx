'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import QRGuide             from '@/components/admin/qualirepar/QRGuide'
import QRTicketsList       from '@/components/admin/qualirepar/QRTicketsList'
import QREligibilityChecker from '@/components/admin/qualirepar/QREligibilityChecker'
import QRSetup             from '@/components/admin/qualirepar/QRSetup'

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'guide',    label: 'Mode d\'emploi', icon: '📖' },
  { id: 'dossiers', label: 'Mes dossiers',   icon: '📋' },
  { id: 'checker',  label: 'Vérif. rapide',  icon: '🔍' },
  { id: 'config',   label: 'Configuration',  icon: '⚙️'  },
]

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, icon, sub, highlight }) {
  return (
    <div className={`rounded-xl border p-4 text-center
      ${highlight
        ? 'bg-amber-500/8 border-amber-500/20'
        : 'bg-[#111118] border-white/8'}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

/**
 * Page Bonus QualiRépar — 4 onglets : mode d'emploi, dossiers, vérif rapide, configuration.
 */
export default function QualiReparPage() {
  const supabase = getSupabaseClient()

  const [tab,        setTab]        = useState('guide')
  const [stats,      setStats]      = useState(null)
  const [shop,       setShop]       = useState(null)
  const [shopId,     setShopId]     = useState(null)
  const [configured, setConfigured] = useState(true)   // pas de bannière avant le chargement
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name, qualirepar_label_num')
        .eq('owner_id', user.id)
        .single()

      if (shopData) {
        setShop(shopData)
        setShopId(shopData.id)

        // Vérifie si la clé API est renseignée
        const { data: qrCfg } = await supabase
          .from('qualirepar_shop_config')
          .select('active, agoraplus_key_ref')
          .eq('shop_id', shopData.id)
          .maybeSingle()

        setConfigured(!!(qrCfg?.agoraplus_key_ref))
      }

      const { data: statsData } = await supabase.rpc('get_qualirepar_dashboard')
      if (statsData) setStats(statsData)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Bannière clé manquante ── */}
      {!configured && (
        <button
          type="button"
          onClick={() => setTab('config')}
          className="w-full flex items-center gap-3 bg-amber-500/10 border-2 border-amber-500/30
                     border-dashed rounded-xl p-4 text-left hover:bg-amber-500/15 transition-colors"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 font-semibold text-sm">Configuration requise</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Votre clé API AgoraPlus n'est pas encore renseignée — la soumission des dossiers
              est désactivée. Cliquez ici pour configurer.
            </p>
          </div>
          <span className="text-amber-400 text-xs font-semibold flex-shrink-0">Configurer →</span>
        </button>
      )}

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20
                          border border-amber-500/20 flex items-center justify-center text-2xl">
            🔁
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Bonus QualiRépar</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Gérez vos remboursements bonus réparation simplement
            </p>
          </div>
        </div>

        {/* Badge label si renseigné */}
        {shop?.qualirepar_label_num && (
          <div className="bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-2.5 text-center">
            <div className="text-xs text-green-400 font-semibold">✅ Labellisé QualiRépar</div>
            <div className="text-xs text-green-500/70 font-mono mt-0.5">{shop.qualirepar_label_num}</div>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon="✅" label="Tickets éligibles"
            value={stats.total_eligible ?? 0}
            sub="Depuis le début"
          />
          <KpiCard
            icon="⏳" label="À soumettre"
            value={stats.en_attente_soumission ?? 0}
            highlight={(stats.en_attente_soumission ?? 0) > 0}
            sub="En attente"
          />
          <KpiCard
            icon="📤" label="En cours"
            value={stats.claim_submitted ?? 0}
            sub="Chez l'éco-organisme"
          />
          <KpiCard
            icon="💰" label="Remboursé"
            value={`${stats.montant_total_percu ?? 0} €`}
            sub="Total perçu"
          />
        </div>
      )}

      {/* ── Liens rapides plateformes ── */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-600 self-center mr-1">Plateformes :</span>
        <a
          href="https://www.e-reparateur.eco/"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-green-500/8 border border-green-500/20 text-green-400
                     hover:bg-green-500/15 transition-colors"
        >
          🌱 Ecologic <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://portail-reparateurs.ecosystem.eco/"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-blue-500/8 border border-blue-500/20 text-blue-400
                     hover:bg-blue-500/15 transition-colors"
        >
          ♻️ Ecosystem <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://www.label-qualirepar.fr/remboursement-bonus/"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-white/5 border border-white/10 text-gray-400
                     hover:bg-white/10 transition-colors"
        >
          Module aiguillage <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* ── Onglets ── */}
      <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3
                        rounded-lg text-sm font-medium transition-all relative
                        ${tab === t.id
                          ? 'bg-amber-500 text-gray-900 shadow-sm'
                          : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span className="hidden sm:inline">{t.icon}</span>
            {t.label}
            {/* Point rouge si config manquante */}
            {t.id === 'config' && !configured && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full
                               border-2 border-[#0F0F1A]" />
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu onglets ── */}
      {tab === 'guide'    && <QRGuide />}
      {tab === 'dossiers' && <QRTicketsList />}
      {tab === 'checker'  && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Vérifiez rapidement si un appareil est éligible au bonus QualiRépar
            avant de créer un ticket.
          </p>
          <QREligibilityChecker />
        </div>
      )}
      {tab === 'config' && (
        <QRSetup
          shopId={shopId}
          onConfigSaved={() => setConfigured(true)}
        />
      )}

    </div>
  )
}

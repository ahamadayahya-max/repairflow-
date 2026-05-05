'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Leaf, Loader2, RefreshCw, FileBarChart2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
import ComplianceScore from '@/components/admin/qualirepar/ComplianceScore'
import CriteriaCard    from '@/components/admin/qualirepar/CriteriaCard'
import ReportsList     from '@/components/admin/qualirepar/ReportsList'

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

const CATEGORIES = {
  formation:     { label: 'Formation',     icon: '🎓' },
  materiel:      { label: 'Matériel',      icon: '🔧' },
  qualite:       { label: 'Qualité',       icon: '⭐' },
  transparence:  { label: 'Transparence',  icon: '📋' },
  environnement: { label: 'Environnement', icon: '♻️' },
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

/**
 * Module Conformité QualiRépar — suivi des critères de qualité
 * et génération automatique des rapports de certification.
 */
export default function ConformitePage() {
  const supabase = getSupabaseClient()

  const [shopId,     setShopId]     = useState(null)
  const [score,      setScore]      = useState(null)
  const [criteria,   setCriteria]   = useState([])
  const [compliance, setCompliance] = useState([])
  const [reports,    setReports]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [actionMsg,  setActionMsg]  = useState(null)
  const [generating, setGenerating] = useState(null) // null | 'quarterly' | 'annual'
  const [verifying,  setVerifying]  = useState(false)

  // ── Chargement de toutes les données ──
  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) { setLoading(false); return }
    setShopId(shop.id)

    const [scoreRes, critRes, compRes, repRes] = await Promise.all([
      supabase.rpc('get_qualirepar_compliance_score'),
      supabase.from('qualirepar_criteria').select('*').order('category').order('id'),
      supabase.from('qualirepar_compliance').select('*').eq('shop_id', shop.id),
      supabase.from('qualirepar_reports').select('*').eq('shop_id', shop.id)
        .order('generated_at', { ascending: false }),
    ])

    setScore(scoreRes.data)
    setCriteria(critRes.data ?? [])
    setCompliance(compRes.data ?? [])
    setReports(repRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Flash message temporaire ──
  function flash(type, text) {
    setActionMsg({ type, text })
    setTimeout(() => setActionMsg(null), 5000)
  }

  // ── Vérification automatique ──
  async function handleAutoVerify() {
    if (!shopId) return
    setVerifying(true)
    const { error } = await supabase.rpc('auto_verify_compliance', { p_shop_id: shopId })
    if (error) {
      flash('error', 'Erreur lors de la vérification automatique.')
    } else {
      await loadAll()
      flash('success', '✅ Vérification automatique effectuée')
    }
    setVerifying(false)
  }

  // ── Génération de rapport ──
  async function handleGenerateReport(type) {
    setGenerating(type)
    const { data: reportId, error } = await supabase.rpc('generate_qualirepar_report', { p_type: type })
    if (error) {
      flash('error', 'Erreur lors de la génération du rapport.')
    } else {
      await loadAll()
      flash('success', `📄 Rapport ${type === 'quarterly' ? 'trimestriel' : 'annuel'} généré`)
    }
    setGenerating(null)
  }

  // ── Téléchargement PDF rapport ──
  async function handleDownloadReport(report) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: shop } = await supabase
        .from('shops').select('*').eq('owner_id', user.id).single()

      const { data: comp } = await supabase
        .from('qualirepar_compliance').select('*').eq('shop_id', shop.id)

      const [{ ReportPDF }, { pdf }, { createElement }] = await Promise.all([
        import('@/components/admin/qualirepar/ReportPDF'),
        import('@react-pdf/renderer'),
        import('react'),
      ])

      const blob = await pdf(
        createElement(ReportPDF, { report, shop, criteria, compliance: comp ?? [] })
      ).toBlob()

      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.download = `rapport-qualirepar-${report.report_type}-${report.period_start}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 3000)
    } catch (err) {
      console.error('[rapport PDF]', err)
      flash('error', 'Erreur lors de la génération du PDF.')
    }
  }

  // ── Groupe les critères par catégorie avec leur état de conformité ──
  const grouped = criteria.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push({
      ...c,
      _compliance: compliance.find(cp => cp.criteria_id === c.id) ?? null,
    })
    return acc
  }, {})

  // ── Chargement ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  const eligible = score?.eligible_label

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl">Conformité QualiRépar</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Suivi des critères de qualité et génération des rapports de certification
          </p>
        </div>
      </div>

      {/* ── Flash message ── */}
      {actionMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border
          ${actionMsg.type === 'success'
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
          {actionMsg.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* ── Corps principal : 2 colonnes ── */}
      <div className="flex gap-5 items-start">

        {/* ── COLONNE GAUCHE : Score + Actions + Stats + Rapports ── */}
        <div className="w-80 flex-shrink-0 space-y-4">

          {/* Score jauge */}
          <ComplianceScore score={score} />

          {/* Badge éligibilité */}
          {eligible ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-green-400 font-bold text-sm">Éligible au label QualiRépar</p>
              <p className="text-green-600 text-xs mt-1">Tous les critères obligatoires sont validés</p>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl mb-1">⚠️</p>
              <p className="text-amber-400 font-bold text-sm">Non éligible pour l'instant</p>
              <p className="text-amber-600 text-xs mt-1">Des critères obligatoires restent à valider</p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="space-y-2">
            <button
              onClick={handleAutoVerify}
              disabled={verifying}
              className="w-full flex items-center justify-center gap-2 px-4 py-3
                         bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm
                         rounded-xl transition-colors disabled:opacity-50"
            >
              {verifying
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</>
                : <><RefreshCw className="w-4 h-4" /> Vérifier automatiquement</>
              }
            </button>

            <button
              onClick={() => handleGenerateReport('quarterly')}
              disabled={!!generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                         bg-white/5 hover:bg-white/10 border border-white/10
                         text-gray-300 font-semibold text-sm rounded-xl
                         transition-colors disabled:opacity-50"
            >
              {generating === 'quarterly'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération…</>
                : <><FileBarChart2 className="w-4 h-4" /> Rapport trimestriel</>
              }
            </button>

            <button
              onClick={() => handleGenerateReport('annual')}
              disabled={!!generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                         bg-white/5 hover:bg-white/10 border border-white/10
                         text-gray-300 font-semibold text-sm rounded-xl
                         transition-colors disabled:opacity-50"
            >
              {generating === 'annual'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération…</>
                : <><FileText className="w-4 h-4" /> Rapport annuel</>
              }
            </button>
          </div>

          {/* Stats tickets 6 mois */}
          {score?.stats_tickets && (
            <div className="bg-[#111118] border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Statistiques — 6 mois
              </p>
              {[
                { label: 'Total réparations',    value: score.stats_tickets.total,       color: 'text-gray-300' },
                { label: 'Éligibles QualiRépar', value: score.stats_tickets.qr_eligible, color: 'text-amber-400' },
                { label: 'Dossiers soumis',      value: score.stats_tickets.qr_soumis,   color: 'text-blue-400' },
                { label: 'Montant bonus total',  value: `${Number(score.stats_tickets.montant_qr ?? 0).toFixed(2)} €`, color: 'text-green-400' },
                {
                  label: 'Taux de succès',
                  value: `${score.stats_tickets.taux_succes ?? 0}%`,
                  color: Number(score.stats_tickets.taux_succes ?? 0) >= 80 ? 'text-green-400' : 'text-red-400',
                },
              ].map(s => (
                <div key={s.label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{s.label}</span>
                  <span className={`font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Historique rapports */}
          <ReportsList reports={reports} onDownload={handleDownloadReport} />
        </div>

        {/* ── COLONNE DROITE : Critères par catégorie ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {Object.entries(CATEGORIES).map(([cat, meta]) => {
            const items     = grouped[cat] ?? []
            const catScore  = score?.categories?.[cat]
            const conformes = catScore?.conformes ?? 0
            const total     = catScore?.total ?? items.length
            const manquants = catScore?.manquants_obligatoires ?? 0

            return (
              <div key={cat}>
                {/* En-tête catégorie */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{meta.icon}</span>
                  <h3 className="text-white font-bold text-base">{meta.label}</h3>
                  {manquants > 0 && (
                    <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                      {manquants} obligatoire{manquants > 1 ? 's' : ''} manquant{manquants > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-600 font-mono">
                    {conformes}/{total}
                  </span>
                </div>

                {/* Cartes des critères */}
                <div className="space-y-2">
                  {items.map(c => (
                    <CriteriaCard
                      key={c.id}
                      criteria={c}
                      compliance={c._compliance}
                      shopId={shopId}
                      onUpdate={loadAll}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

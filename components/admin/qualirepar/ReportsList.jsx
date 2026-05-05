'use client'

import { FileText, Download, CheckCircle2, Clock, Send } from 'lucide-react'

// ---------------------------------------------------------------------------
// Config visuelle par statut de rapport
// ---------------------------------------------------------------------------

const REPORT_STATUS = {
  draft:      { label: 'Brouillon',  color: 'text-gray-500',   bg: 'bg-gray-500/10'   },
  ready:      { label: 'Prêt',       color: 'text-amber-400',  bg: 'bg-amber-400/10'  },
  submitted:  { label: 'Soumis',     color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
  certified:  { label: 'Certifié',   color: 'text-green-400',  bg: 'bg-green-400/10'  },
}

const REPORT_TYPE_LABELS = {
  annual:    'Rapport annuel',
  quarterly: 'Bilan trimestriel',
  audit:     'Rapport d\'audit',
  renewal:   'Dossier renouvellement',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtPeriod(start, end) {
  const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${s} → ${e}`
}

/**
 * Historique des rapports de conformité générés.
 * @param {{ reports: object[], onDownload: (report: object) => void }} props
 */
export default function ReportsList({ reports, onDownload }) {
  if (!reports || reports.length === 0) {
    return (
      <div className="bg-[#111118] border border-white/10 rounded-xl p-5 text-center">
        <FileText className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">Aucun rapport généré</p>
        <p className="text-xs text-gray-700 mt-1">
          Cliquez sur « Générer » pour créer votre premier rapport.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Rapports générés
        </span>
        <span className="ml-auto text-xs text-gray-600">{reports.length}</span>
      </div>

      <div className="divide-y divide-white/5">
        {reports.map(r => {
          const st  = REPORT_STATUS[r.status] ?? REPORT_STATUS.draft
          const lbl = REPORT_TYPE_LABELS[r.report_type] ?? r.report_type

          return (
            <div key={r.id}
              className="px-4 py-3 flex items-center gap-3 hover:bg-white/3 transition-colors">
              {/* Icône statut */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                {r.status === 'certified'
                  ? <CheckCircle2 className={`w-3.5 h-3.5 ${st.color}`} />
                  : r.status === 'submitted'
                  ? <Send className={`w-3.5 h-3.5 ${st.color}`} />
                  : <Clock className={`w-3.5 h-3.5 ${st.color}`} />
                }
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{lbl}</p>
                <p className="text-[10px] text-gray-600 truncate">
                  {fmtPeriod(r.period_start, r.period_end)}
                </p>
              </div>

              {/* Score + badge + download */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {r.score_total != null && (
                  <span className="text-xs font-bold text-amber-400">
                    {r.score_total}%
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>
                  {st.label}
                </span>
                <button
                  onClick={() => onDownload(r)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500
                             hover:text-amber-400 transition-colors"
                  title="Télécharger PDF"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

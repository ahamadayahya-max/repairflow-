'use client'

import { useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  Leaf, CheckCircle2, XCircle, Clock, Send, Upload,
  Loader2, AlertCircle, ChevronDown, Euro, FileText, RefreshCw
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Config statuts QualiRépar
// ---------------------------------------------------------------------------

const QR_STATUS_CONFIG = {
  non_eligible:     { label: 'Non éligible',           color: 'text-gray-400',    bg: 'bg-gray-400/10',    border: 'border-gray-400/20',    icon: XCircle      },
  eligible:         { label: 'Éligible — à soumettre', color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20',   icon: CheckCircle2 },
  support_pending:  { label: 'Validation client…',     color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20',    icon: Clock        },
  support_accepted: { label: 'Validé par client',      color: 'text-indigo-400',  bg: 'bg-indigo-400/10',  border: 'border-indigo-400/20',  icon: CheckCircle2 },
  support_refused:  { label: 'Refusé par client',      color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20',     icon: XCircle      },
  claim_submitted:  { label: 'Dossier soumis',         color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20',    icon: Send         },
  claim_accepted:   { label: 'Dossier accepté',        color: 'text-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/20',   icon: CheckCircle2 },
  claim_refused:    { label: 'Dossier refusé',         color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20',     icon: XCircle      },
  paid:             { label: 'Remboursé 💰',           color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', icon: CheckCircle2 },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Panneau QualiRépar intégré dans la page détail ticket.
 * Gère vérification éligibilité + soumission dossier AgoraPlus.
 *
 * @param {{
 *   ticketId:              string,
 *   shopId:                string,
 *   qualirepar_status?:    string,
 *   qr_eligible?:          boolean,
 *   qr_montant?:           number,
 *   qr_eco_org?:           string,
 *   qr_claim_id?:          number,
 *   qr_support_request_id?: number,
 *   qr_invoice_url?:       string,
 *   qr_soumis_at?:         string,
 *   qr_paid_at?:           string,
 *   qr_error_message?:     string,
 *   qr_imei?:              string,
 *   qr_symptom_code?:      string,
 *   qr_repair_code?:       string,
 *   device_type?:          string,
 *   device_brand?:         string,
 *   onStatusChange?:       (s: string) => void,
 * }} props
 */
export default function QualiReparPanel({
  ticketId,
  shopId,
  qualirepar_status:  initialStatus   = 'non_eligible',
  qr_eligible:        initialEligible = false,
  qr_montant:         initialMontant  = null,
  qr_eco_org:         initialEcoOrg   = null,
  qr_claim_id:        initialClaimId  = null,
  qr_support_request_id: initialSupportId = null,
  qr_invoice_url:     initialInvUrl   = null,
  qr_soumis_at:       initialSoumisAt = null,
  qr_paid_at:         initialPaidAt   = null,
  qr_error_message:   initialErrMsg   = null,
  qr_imei:            initialImei     = '',
  qr_symptom_code:    initialSymptom  = '',
  qr_repair_code:     initialRepair   = '',
  device_type,
  device_brand,
  onStatusChange,
}) {
  const supabase = getSupabaseClient()

  const [status,      setStatus]      = useState(initialStatus)
  const [montant,     setMontant]     = useState(initialMontant)
  const [ecoOrg,      setEcoOrg]      = useState(initialEcoOrg)
  const [claimId,     setClaimId]     = useState(initialClaimId)
  const [supportId,   setSupportId]   = useState(initialSupportId)
  const [invoiceUrl,  setInvoiceUrl]  = useState(initialInvUrl)
  const [soumisAt,    setSoumisAt]    = useState(initialSoumisAt)
  const [paidAt,      setPaidAt]      = useState(initialPaidAt)
  const [errMsg,      setErrMsg]      = useState(initialErrMsg)

  const [imei,        setImei]        = useState(initialImei ?? '')
  const [symptomCode, setSymptomCode] = useState(initialSymptom ?? '')
  const [repairCode,  setRepairCode]  = useState(initialRepair ?? '')
  const [invoiceFile, setInvoiceFile] = useState(null)

  const [checking,   setChecking]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [expanded,   setExpanded]   = useState(true)

  const statusCfg = QR_STATUS_CONFIG[status] ?? QR_STATUS_CONFIG.non_eligible

  // ── Flash message (auto-disparaît après 6s) ────────────────────────────
  const flash = useCallback((type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 6000)
  }, [])

  const updateStatus = useCallback((newStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // ── ÉTAPE 1 : Vérifier l'éligibilité ──────────────────────────────────
  const handleCheck = useCallback(async () => {
    setChecking(true)
    setMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('qualirepar-check', {
        body: { ticket_id: ticketId },
      })
      if (error) throw new Error(error.message)

      if (!data?.eligible) {
        flash('error', data?.reason ?? 'Ticket non éligible au bonus QualiRépar')
        updateStatus('non_eligible')
        return
      }

      setMontant(data.montant)
      setEcoOrg(data.eco_org)
      updateStatus('eligible')
      flash('success', `✅ Éligible — bonus de ${data.montant} € (${data.eco_org})`)
    } catch (err) {
      flash('error', `Erreur : ${err.message}`)
    } finally {
      setChecking(false)
    }
  }, [ticketId, supabase, flash, updateStatus])

  // ── ÉTAPE 2 : Soumettre le dossier ────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setMsg(null)
    try {
      // Sauvegarde IMEI + codes avant envoi
      await supabase
        .from('tickets')
        .update({
          qr_imei:         imei        || null,
          qr_symptom_code: symptomCode || null,
          qr_repair_code:  repairCode  || null,
        })
        .eq('id', ticketId)

      let invoiceBase64 = null
      let invoiceMime   = 'application/pdf'
      if (invoiceFile) {
        invoiceBase64 = await fileToBase64(invoiceFile)
        invoiceMime   = invoiceFile.type || 'application/pdf'
      }

      const { data, error } = await supabase.functions.invoke('qualirepar-submit', {
        body: {
          ticket_id:           ticketId,
          invoice_file_base64: invoiceBase64,
          invoice_mime_type:   invoiceMime,
        },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Erreur soumission')

      setClaimId(data.claim_id)
      setSupportId(data.support_request_id)
      if (data.invoice_url) setInvoiceUrl(data.invoice_url)
      setSoumisAt(new Date().toISOString())
      setInvoiceFile(null)
      updateStatus('claim_submitted')
      flash('success', `📤 Dossier soumis — Réf. #${data.claim_id} — Remboursement sous 15 jours`)
    } catch (err) {
      flash('error', `Erreur AgoraPlus : ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }, [ticketId, imei, symptomCode, repairCode, invoiceFile, supabase, flash, updateStatus])

  const canCheck  = status === 'non_eligible'
  const canSubmit = status === 'eligible' || status === 'support_accepted'

  return (
    <div className="bg-[#111118] rounded-xl border border-white/10 overflow-hidden">

      {/* En-tête cliquable */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-green-400" />
          </div>
          <span className="text-sm font-semibold text-white">Bonus QualiRépar</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border
            ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
            <statusCfg.icon className="w-3 h-3" />
            {statusCfg.label}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Corps */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">

          {/* Montant bonus */}
          {montant && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/15">
              <Euro className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-400">−{montant} € de bonus</p>
                {ecoOrg && <p className="text-xs text-gray-500 capitalize">Éco-organisme : {ecoOrg}</p>}
              </div>
            </div>
          )}

          {/* Erreur AgoraPlus */}
          {errMsg && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-red-400/10 border border-red-400/20 text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {errMsg}
            </div>
          )}

          {/* Flash message */}
          {msg && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs border
              ${msg.type === 'success'
                ? 'bg-green-400/10 border-green-400/20 text-green-400'
                : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
              {msg.type === 'success'
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                : <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              {msg.text}
            </div>
          )}

          {/* ── Vérifier éligibilité ── */}
          {canCheck && (
            <button
              onClick={handleCheck}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold
                         bg-amber-500 hover:bg-amber-400 text-white transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</>
                : <><RefreshCw className="w-4 h-4" /> Vérifier l'éligibilité</>}
            </button>
          )}

          {/* ── Formulaire soumission ── */}
          {canSubmit && (
            <div className="space-y-2.5">
              <p className="text-xs text-gray-500">Complétez les informations puis soumettez le dossier à AgoraPlus.</p>

              <input
                type="text"
                value={imei}
                onChange={e => setImei(e.target.value)}
                placeholder="IMEI ou numéro de série (optionnel)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                           placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <input
                type="text"
                value={symptomCode}
                onChange={e => setSymptomCode(e.target.value)}
                placeholder="Code symptôme AgoraPlus (optionnel)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                           placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <input
                type="text"
                value={repairCode}
                onChange={e => setRepairCode(e.target.value)}
                placeholder="Code réparation AgoraPlus (optionnel)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                           placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />

              {/* Upload facture */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Facture PDF signée (optionnel)</label>
                <label className="flex items-center gap-2 w-full cursor-pointer px-3 py-2 rounded-lg
                                  bg-white/5 border border-white/10 border-dashed hover:bg-white/8 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-400 truncate">
                    {invoiceFile ? invoiceFile.name : 'Cliquer pour choisir un fichier…'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={e => setInvoiceFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold
                           bg-green-600 hover:bg-green-500 text-white transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Soumission en cours…</>
                  : <><Send className="w-4 h-4" /> Soumettre le dossier QualiRépar</>}
              </button>
            </div>
          )}

          {/* ── États informatifs ── */}
          {status === 'support_pending' && (
            <div className="text-sm text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-lg p-3 text-center space-y-1">
              <p>⏳ SMS de validation envoyé au client</p>
              {supportId && <p className="text-xs text-blue-300">Réf. demande : #{supportId}</p>}
            </div>
          )}

          {status === 'claim_submitted' && (
            <div className="text-sm bg-blue-400/10 border border-blue-400/20 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-blue-400">📤 Dossier soumis à {ecoOrg ?? '—'}</p>
              {claimId  && <p className="text-xs text-gray-400">Réf. dossier : #{claimId}</p>}
              {soumisAt && <p className="text-xs text-gray-400">Soumis le : {formatDate(soumisAt)}</p>}
              <p className="text-xs text-blue-300 font-medium">Remboursement prévu sous 15 jours</p>
            </div>
          )}

          {status === 'paid' && (
            <div className="text-sm bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-emerald-400">💰 Remboursé — {montant} €</p>
              {paidAt && <p className="text-xs text-gray-400">Reçu le : {formatDate(paidAt)}</p>}
            </div>
          )}

          {['claim_accepted', 'support_refused', 'claim_refused'].includes(status) && (
            <div className={`text-xs rounded-lg p-3 text-center
              ${status === 'claim_accepted'
                ? 'bg-green-400/10 border border-green-400/20 text-green-400'
                : 'bg-red-400/10 border border-red-400/20 text-red-400'}`}>
              {status === 'claim_accepted'  && '✅ Dossier accepté — remboursement en cours'}
              {status === 'support_refused' && '❌ Le client a refusé la validation SMS'}
              {status === 'claim_refused'   && '❌ Dossier refusé par AgoraPlus'}
            </div>
          )}

          {/* Lien facture */}
          {invoiceUrl && (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Voir la facture soumise →
            </a>
          )}

        </div>
      )}
    </div>
  )
}

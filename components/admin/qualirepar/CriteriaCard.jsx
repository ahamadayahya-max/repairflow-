'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Config visuelle par statut
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  conforme:     { label: 'Conforme',     border: 'border-green-500/30',  bg: 'bg-green-500/5',  badge: 'bg-green-500/15 text-green-400',  icon: '✅' },
  non_conforme: { label: 'Non conforme', border: 'border-red-500/30',    bg: 'bg-red-500/5',    badge: 'bg-red-500/15 text-red-400',      icon: '❌' },
  en_cours:     { label: 'En cours',     border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  badge: 'bg-amber-500/15 text-amber-400',  icon: '⏳' },
  non_verifie:  { label: 'À vérifier',   border: 'border-white/10',      bg: 'bg-white/3',      badge: 'bg-white/10 text-gray-500',       icon: '○' },
}

/**
 * Carte individuelle d'un critère de conformité QualiRépar.
 * Permet la mise à jour manuelle du statut, de la preuve et des notes.
 * @param {{ criteria: object, compliance: object|null, shopId: string, onUpdate: () => void }} props
 */
export default function CriteriaCard({ criteria, compliance, shopId, onUpdate }) {
  const supabase = getSupabaseClient()

  const [editing,  setEditing]  = useState(false)
  const [status,   setStatus]   = useState(compliance?.status ?? 'non_verifie')
  const [evidence, setEvidence] = useState(compliance?.evidence ?? '')
  const [notes,    setNotes]    = useState(compliance?.notes ?? '')
  const [saving,   setSaving]   = useState(false)

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.non_verifie

  async function save() {
    if (!shopId) return
    setSaving(true)
    await supabase
      .from('qualirepar_compliance')
      .upsert({
        shop_id:     shopId,
        criteria_id: criteria.id,
        status,
        evidence:    evidence.trim() || null,
        notes:       notes.trim()    || null,
        verified_at: new Date().toISOString(),
        verified_by: 'manual',
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'shop_id,criteria_id' })
    setSaving(false)
    setEditing(false)
    onUpdate()
  }

  return (
    <div className={`border rounded-xl p-4 transition-all ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{cfg.icon}</span>

        <div className="flex-1 min-w-0">
          {/* En-tête critère */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-100">
                {criteria.label}
              </span>
              {criteria.mandatory && (
                <span className="ml-2 text-[10px] text-red-400 font-medium">* obligatoire</span>
              )}
              {criteria.description && (
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {criteria.description}
                </p>
              )}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-semibold ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>

          {/* Preuve existante */}
          {compliance?.evidence && !editing && (
            <div className={`mt-2 text-xs rounded-lg px-2.5 py-1.5 leading-relaxed
              ${compliance.verified_by === 'auto'
                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                : 'bg-white/5 text-gray-400 border border-white/10'}`}>
              {compliance.verified_by === 'auto' ? '🤖 Auto : ' : '📎 '}
              {compliance.evidence}
            </div>
          )}

          {/* Notes internes */}
          {compliance?.notes && !editing && (
            <p className="mt-1.5 text-xs text-gray-600 italic">
              Note : {compliance.notes}
            </p>
          )}

          {/* Formulaire d'édition */}
          {editing ? (
            <div className="mt-3 space-y-2">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-[#0F0F1A] border border-white/10 text-sm text-white
                           rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/40"
              >
                <option value="conforme">✅ Conforme</option>
                <option value="non_conforme">❌ Non conforme</option>
                <option value="en_cours">⏳ En cours</option>
                <option value="non_verifie">○ À vérifier</option>
              </select>
              <input
                type="text"
                placeholder="Preuve / justificatif (ex : attestation Qualiopi 2024)"
                value={evidence}
                onChange={e => setEvidence(e.target.value)}
                className="w-full bg-[#0F0F1A] border border-white/10 text-sm text-white
                           rounded-lg px-2.5 py-1.5 placeholder-gray-600
                           focus:outline-none focus:border-amber-500/40"
              />
              <textarea
                placeholder="Notes internes (facultatif)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#0F0F1A] border border-white/10 text-sm text-white
                           rounded-lg px-2.5 py-1.5 placeholder-gray-600 resize-none
                           focus:outline-none focus:border-amber-500/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5
                             bg-amber-500 hover:bg-amber-400 text-white text-xs
                             font-semibold py-2 rounded-lg transition-colors
                             disabled:opacity-50"
                >
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde…</>
                    : 'Enregistrer'
                  }
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setStatus(compliance?.status ?? 'non_verifie')
                    setEvidence(compliance?.evidence ?? '')
                    setNotes(compliance?.notes ?? '')
                  }}
                  className="px-3 bg-white/5 hover:bg-white/10 border border-white/10
                             text-gray-400 text-xs rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 text-xs text-gray-600 hover:text-amber-400 transition-colors underline underline-offset-2"
            >
              {compliance ? 'Modifier' : 'Renseigner'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

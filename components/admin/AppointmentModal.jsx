'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { X, Save, Loader2, Check, Ban } from 'lucide-react'
import { format, addMinutes } from 'date-fns'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { value: 'drop_off',   label: 'Dépôt',       icon: '📥', color: '#F59E0B' },
  { value: 'repair',     label: 'Réparation',   icon: '🔧', color: '#4F8EF7' },
  { value: 'diagnostic', label: 'Diagnostic',   icon: '🔍', color: '#8B5CF6' },
  { value: 'pickup',     label: 'Récupération', icon: '📤', color: '#10B981' },
  { value: 'callback',   label: 'Rappel',       icon: '📞', color: '#F97316' },
]

const DURATIONS = [
  { label: '15 min', value: 15  },
  { label: '30 min', value: 30  },
  { label: '1h',     value: 60  },
  { label: '1h30',   value: 90  },
  { label: '2h',     value: 120 },
]

function getColorByType(type) {
  return TYPE_OPTIONS.find(t => t.value === type)?.color ?? '#6B7280'
}

function getDefaultTitle(type, clientName) {
  const map = {
    drop_off:   `Dépôt — ${clientName}`,
    pickup:     `Récupération — ${clientName}`,
    repair:     `Réparation — ${clientName}`,
    diagnostic: `Diagnostic — ${clientName}`,
    callback:   `Rappel — ${clientName}`,
  }
  return map[type] ?? clientName
}

const INPUT_CLS = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white
  text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition-colors`

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Modale de création / édition d'un rendez-vous agenda.
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSuccess: () => void,
 *   shopId: string,
 *   appointment?: object,
 *   defaultStart?: Date,
 *   defaultEnd?: Date,
 *   defaultClientId?: string,
 *   defaultTicketId?: string,
 * }} props
 */
export default function AppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  shopId,
  appointment,
  defaultStart,
  defaultEnd,
  defaultClientId,
  defaultTicketId,
}) {
  const supabase = getSupabaseClient()

  const [saving,   setSaving]   = useState(false)
  const [clients,  setClients]  = useState([])
  const [tickets,  setTickets]  = useState([])

  // Valeurs du formulaire
  const [type,      setType]      = useState('repair')
  const [clientId,  setClientId]  = useState('')
  const [ticketId,  setTicketId]  = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [duration,  setDuration]  = useState(60)
  const [notes,     setNotes]     = useState('')
  const [status,    setStatus]    = useState('scheduled')

  // ---------------------------------------------------------------------------
  // Init depuis les props
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return
    if (appointment) {
      const s      = new Date(appointment.start_at)
      const e      = new Date(appointment.end_at)
      const diffMn = Math.round((e - s) / 60000)
      setType(appointment.type || 'repair')
      setClientId(appointment.client_id || '')
      setTicketId(appointment.ticket_id || '')
      setStartDate(format(s, 'yyyy-MM-dd'))
      setStartTime(format(s, 'HH:mm'))
      setDuration(diffMn > 0 ? diffMn : 60)
      setNotes(appointment.notes || '')
      setStatus(appointment.status || 'scheduled')
    } else {
      const s     = defaultStart ?? new Date()
      const e     = defaultEnd   ?? addMinutes(s, 60)
      const diff  = Math.round((e - s) / 60000)
      setType('repair')
      setClientId(defaultClientId || '')
      setTicketId(defaultTicketId || '')
      setStartDate(format(s, 'yyyy-MM-dd'))
      setStartTime(format(s, 'HH:mm'))
      setDuration(diff > 0 ? diff : 60)
      setNotes('')
      setStatus('scheduled')
    }
  }, [isOpen, appointment, defaultStart, defaultEnd, defaultClientId, defaultTicketId])

  // Charge les clients
  useEffect(() => {
    if (!shopId || !isOpen) return
    supabase.from('clients').select('id, full_name').eq('shop_id', shopId).order('full_name')
      .then(({ data }) => setClients(data || []))
  }, [shopId, isOpen])

  // Charge les tickets du client sélectionné
  useEffect(() => {
    if (!clientId) { setTickets([]); return }
    supabase.from('tickets')
      .select('id, device_brand, device_model, status')
      .eq('client_id', clientId)
      .in('status', ['pending', 'in_repair', 'ready'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setTickets(data || []))
  }, [clientId])

  // ---------------------------------------------------------------------------
  // Sauvegarde
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!shopId || !startDate || !startTime) return
    setSaving(true)
    try {
      const startAt  = new Date(`${startDate}T${startTime}`)
      const endAt    = addMinutes(startAt, duration)
      const client   = clients.find(c => c.id === clientId)
      const title    = client
        ? getDefaultTitle(type, client.full_name)
        : TYPE_OPTIONS.find(t => t.value === type)?.label ?? type

      const payload = {
        shop_id:   shopId,
        ticket_id: ticketId || null,
        client_id: clientId || null,
        title,
        type,
        status,
        start_at:  startAt.toISOString(),
        end_at:    endAt.toISOString(),
        notes:     notes.trim() || null,
        color:     getColorByType(type),
      }

      if (appointment?.id) {
        await supabase.from('appointments').update(payload).eq('id', appointment.id)
      } else {
        await supabase.from('appointments').insert(payload)
      }

      // Met à jour estimated_ready_at sur le ticket si type = repair
      if (ticketId && type === 'repair') {
        await supabase.from('tickets')
          .update({ estimated_ready_at: endAt.toISOString() })
          .eq('id', ticketId)
      }

      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }, [shopId, startDate, startTime, duration, type, clientId, ticketId, notes, status, appointment, clients])

  const handleStatusChange = async (newStatus) => {
    if (!appointment?.id) return
    await supabase.from('appointments').update({ status: newStatus }).eq('id', appointment.id)
    onSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#111118] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-base">
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {TYPE_OPTIONS.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-xs font-medium transition-colors
                    ${type === t.value
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-white/10 bg-white/3 text-gray-400 hover:bg-white/6 hover:text-gray-200'}`}>
                  <span className="text-base">{t.icon}</span>
                  <span className="leading-tight text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={INPUT_CLS}>
              <option value="">— Sans client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          {/* Ticket lié */}
          {clientId && tickets.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Ticket lié</label>
              <select value={ticketId} onChange={e => setTicketId(e.target.value)} className={INPUT_CLS}>
                <option value="">— Aucun ticket —</option>
                {tickets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.device_brand} {t.device_model} · {t.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date et heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Heure</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">Durée</label>
            <div className="flex gap-1.5 flex-wrap">
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${duration === d.value
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-white/3 border-white/10 text-gray-400 hover:bg-white/6'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Instructions particulières…"
              className={INPUT_CLS + ' resize-none'} />
          </div>

          {/* Statut (si édition) */}
          {appointment && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={INPUT_CLS}>
                <option value="scheduled">Planifié</option>
                <option value="confirmed">Confirmé</option>
                <option value="in_progress">En cours</option>
                <option value="done">Terminé</option>
                <option value="cancelled">Annulé</option>
                <option value="no_show">No-show</option>
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-3 flex-wrap">
          {appointment && (
            <>
              <button onClick={() => handleStatusChange('done')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-500/10
                           border border-green-500/20 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors">
                <Check className="w-3.5 h-3.5" /> Terminé
              </button>
              <button onClick={() => handleStatusChange('no_show')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-500/10
                           border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                <Ban className="w-3.5 h-3.5" /> No-show
              </button>
            </>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white
                         bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarPlus, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS = {
  drop_off:   '📥',
  pickup:     '📤',
  repair:     '🔧',
  diagnostic: '🔍',
  callback:   '📞',
}

const STATUS_LABEL = {
  scheduled:   { label: 'Planifié',   cls: 'text-gray-400'  },
  confirmed:   { label: 'Confirmé',   cls: 'text-blue-400'  },
  in_progress: { label: 'En cours',   cls: 'text-amber-400' },
  done:        { label: 'Terminé',    cls: 'text-green-400' },
  cancelled:   { label: 'Annulé',     cls: 'text-red-400'   },
  no_show:     { label: 'No-show',    cls: 'text-red-400'   },
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Panneau latéral gauche de l'agenda : stats du jour, tickets sans créneau,
 * liste des RDV aujourd'hui.
 * @param {{
 *   shopId: string,
 *   refreshKey: number,
 *   onNewAppointment: (defaults: object) => void,
 *   onOpenAppointment: (appointment: object) => void,
 * }} props
 */
export default function TodayPanel({ shopId, refreshKey, onNewAppointment, onOpenAppointment }) {
  const supabase = getSupabaseClient()

  const [stats,       setStats]       = useState(null)
  const [todayAppts,  setTodayAppts]  = useState([])
  const [unscheduled, setUnscheduled] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!shopId) return
    load()
  }, [shopId, refreshKey])

  async function load() {
    setLoading(true)
    const now        = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    const [statsRes, apptRes, scheduledRes] = await Promise.all([
      supabase.rpc('get_today_agenda'),
      supabase
        .from('appointments')
        .select('id, title, type, status, start_at, client_id, clients(full_name)')
        .eq('shop_id', shopId)
        .gte('start_at', todayStart)
        .lt('start_at', todayEnd)
        .order('start_at'),
      supabase
        .from('appointments')
        .select('ticket_id')
        .eq('shop_id', shopId)
        .not('ticket_id', 'is', null)
        .in('status', ['scheduled', 'confirmed', 'in_progress']),
    ])

    setStats(statsRes.data)
    setTodayAppts(apptRes.data || [])

    // Tickets sans créneau actif
    const scheduledIds = (scheduledRes.data || [])
      .map(a => a.ticket_id).filter(Boolean)

    let q = supabase
      .from('tickets')
      .select('id, device_brand, device_model, status, client_id, clients(full_name)')
      .eq('shop_id', shopId)
      .in('status', ['pending', 'in_repair'])
      .order('created_at')
      .limit(8)

    if (scheduledIds.length > 0) {
      q = q.not('id', 'in', `(${scheduledIds.join(',')})`)
    }

    const { data: unschData } = await q
    setUnscheduled(unschData || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Date et compteur */}
      <div>
        <p className="text-white font-bold text-sm capitalize">
          {format(new Date(), 'EEEE d MMMM', { locale: fr })}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">
          {stats?.total || 0} rendez-vous aujourd'hui
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { l: 'Total',     v: stats?.total     || 0, c: 'text-white'      },
          { l: 'Confirmés', v: stats?.confirmed  || 0, c: 'text-blue-400'  },
          { l: 'Terminés',  v: stats?.done       || 0, c: 'text-green-400' },
          { l: 'No-show',   v: stats?.no_show    || 0, c: 'text-red-400'   },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-white/3 rounded-lg p-2.5 text-center">
            <p className={`text-xl font-bold tabular-nums ${c}`}>{v}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Tickets sans créneau */}
      {unscheduled.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Sans créneau</p>
          <div className="space-y-1.5">
            {unscheduled.map(t => (
              <div key={t.id}
                className="flex items-center justify-between gap-2 bg-white/3 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-300 truncate">
                    {t.device_brand} {t.device_model}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {t.clients?.full_name || '—'}
                  </p>
                </div>
                <button
                  onClick={() => onNewAppointment({ ticketId: t.id, clientId: t.client_id })}
                  title="Planifier un RDV"
                  className="flex-shrink-0 p-1.5 bg-amber-500/10 hover:bg-amber-500/20
                             text-amber-400 rounded-lg transition-colors">
                  <CalendarPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RDV du jour */}
      {todayAppts.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Aujourd'hui</p>
          <div className="space-y-1.5">
            {todayAppts.map(a => {
              const st = STATUS_LABEL[a.status] ?? STATUS_LABEL.scheduled
              return (
                <button key={a.id} onClick={() => onOpenAppointment(a)}
                  className="w-full flex items-start gap-2.5 bg-white/3 hover:bg-white/6
                             rounded-lg px-3 py-2 text-left transition-colors">
                  <span className="flex-shrink-0 text-sm mt-0.5">
                    {TYPE_ICONS[a.type] || '📅'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-300 truncate">
                      {a.clients?.full_name || a.title}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {format(new Date(a.start_at), 'HH:mm')}
                      {' · '}
                      <span className={st.cls}>{st.label}</span>
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {todayAppts.length === 0 && unscheduled.length === 0 && (
        <p className="text-center text-gray-600 text-xs py-6">
          Aucun rendez-vous aujourd'hui
        </p>
      )}
    </div>
  )
}

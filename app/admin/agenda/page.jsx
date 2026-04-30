'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Calendar, Settings, Plus, Loader2 } from 'lucide-react'
import TodayPanel from '@/components/admin/TodayPanel'
import AppointmentModal from '@/components/admin/AppointmentModal'

// ---------------------------------------------------------------------------
// Import dynamique — FullCalendar ne supporte pas le SSR
// ---------------------------------------------------------------------------
const CalendarWrapper = dynamicImport(
  () => import('@/components/admin/CalendarWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    ),
  }
)

// ---------------------------------------------------------------------------
// Helpers couleurs
// ---------------------------------------------------------------------------
function getColorByType(type) {
  const map = {
    drop_off:   '#F59E0B',
    pickup:     '#10B981',
    repair:     '#4F8EF7',
    diagnostic: '#8B5CF6',
    callback:   '#F97316',
  }
  return map[type] ?? '#6B7280'
}

// ---------------------------------------------------------------------------
// Page principale Agenda
// ---------------------------------------------------------------------------

/**
 * Page agenda avec FullCalendar (vue semaine) et panel latéral du jour.
 */
export default function AgendaPage() {
  const supabase = getSupabaseClient()

  const [shopId,        setShopId]        = useState(null)
  const [events,        setEvents]        = useState([])
  const [businessHours, setBusinessHours] = useState([])
  const [visibleRange,  setVisibleRange]  = useState(null)
  const [refreshKey,    setRefreshKey]    = useState(0)

  // État de la modale
  const [modalOpen,        setModalOpen]        = useState(false)
  const [editingAppt,      setEditingAppt]      = useState(null)
  const [defaultStart,     setDefaultStart]     = useState(null)
  const [defaultEnd,       setDefaultEnd]       = useState(null)
  const [defaultClientId,  setDefaultClientId]  = useState(null)
  const [defaultTicketId,  setDefaultTicketId]  = useState(null)

  // ---------------------------------------------------------------------------
  // Init : shop + horaires
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) return
      setShopId(shop.id)
      loadBusinessHours(shop.id)
    }
    init()
  }, [])

  async function loadBusinessHours(sid) {
    const { data } = await supabase
      .from('shop_hours').select('*').eq('shop_id', sid).order('day_of_week')
    if (!data) return
    // Convertit en format FullCalendar businessHours
    const hours = data.filter(d => d.is_open).map(d => ({
      daysOfWeek: [d.day_of_week],
      startTime:  (d.open_time  || '09:00:00').slice(0, 5),
      endTime:    (d.close_time || '18:00:00').slice(0, 5),
    }))
    setBusinessHours(hours)
  }

  // ---------------------------------------------------------------------------
  // Chargement des événements
  // ---------------------------------------------------------------------------

  const loadEvents = useCallback(async (start, end) => {
    if (!shopId) return
    const { data } = await supabase.rpc('get_appointments_week', {
      p_start: start.toISOString(),
      p_end:   end.toISOString(),
    })
    const evts = (data ?? []).map(a => ({
      id:              a.id,
      title:           a.client?.name ?? a.title,
      start:           a.start_at,
      end:             a.end_at,
      backgroundColor: a.color || getColorByType(a.type),
      borderColor:     a.color || getColorByType(a.type),
      textColor:       '#fff',
      extendedProps:   a,
    }))
    setEvents(evts)
  }, [shopId])

  // Recharge si shopId ou refreshKey change
  useEffect(() => {
    if (shopId && visibleRange) {
      loadEvents(visibleRange.start, visibleRange.end)
    }
  }, [shopId, refreshKey, visibleRange])

  // ---------------------------------------------------------------------------
  // Handlers calendrier
  // ---------------------------------------------------------------------------

  function handleDatesSet({ start, end }) {
    setVisibleRange({ start, end })
  }

  function handleSelect(info) {
    setEditingAppt(null)
    setDefaultStart(info.start)
    setDefaultEnd(info.end)
    setDefaultClientId(null)
    setDefaultTicketId(null)
    setModalOpen(true)
  }

  function handleEventClick(info) {
    setEditingAppt(info.event.extendedProps)
    setDefaultStart(null)
    setDefaultEnd(null)
    setDefaultClientId(null)
    setDefaultTicketId(null)
    setModalOpen(true)
  }

  async function handleEventDrop(info) {
    if (!info.event.start || !info.event.end) return
    await supabase.from('appointments').update({
      start_at: info.event.start.toISOString(),
      end_at:   info.event.end.toISOString(),
    }).eq('id', info.event.id)
    setRefreshKey(k => k + 1)
  }

  // ---------------------------------------------------------------------------
  // Handlers panel + modale
  // ---------------------------------------------------------------------------

  function handleSuccess() {
    setRefreshKey(k => k + 1)
  }

  function openNewAppointment(defaults = {}) {
    setEditingAppt(null)
    setDefaultStart(defaults.start ?? new Date())
    setDefaultEnd(defaults.end ?? null)
    setDefaultClientId(defaults.clientId ?? null)
    setDefaultTicketId(defaults.ticketId ?? null)
    setModalOpen(true)
  }

  function openEditAppointment(appt) {
    setEditingAppt(appt)
    setDefaultStart(null)
    setDefaultEnd(null)
    setDefaultClientId(null)
    setDefaultTicketId(null)
    setModalOpen(true)
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 80px)' }}>

      {/* ── Panel gauche ────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-[#111118] border border-white/10 rounded-xl
                      flex flex-col overflow-hidden">
        {/* En-tête panel */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-bold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            Agenda
          </h2>
          <Link href="/admin/agenda/parametres"
            className="text-gray-500 hover:text-white transition-colors"
            title="Paramètres horaires">
            <Settings className="w-4 h-4" />
          </Link>
        </div>

        {/* Bouton nouveau RDV */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <button onClick={() => openNewAppointment()}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold
                       text-white bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Nouveau RDV
          </button>
        </div>

        {/* Panel du jour */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {shopId && (
            <TodayPanel
              shopId={shopId}
              refreshKey={refreshKey}
              onNewAppointment={openNewAppointment}
              onOpenAppointment={openEditAppointment}
            />
          )}
        </div>
      </div>

      {/* ── Calendrier ──────────────────────────────────────────────── */}
      <div className="flex-1 bg-[#111118] border border-white/10 rounded-xl p-4 min-w-0 overflow-hidden">
        {shopId ? (
          <CalendarWrapper
            key={`cal-${shopId}`}
            events={events}
            businessHours={businessHours}
            onSelect={handleSelect}
            onEventClick={handleEventClick}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventDrop}
            onDatesSet={handleDatesSet}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        )}
      </div>

      {/* ── Modale RDV ──────────────────────────────────────────────── */}
      {shopId && (
        <AppointmentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
          shopId={shopId}
          appointment={editingAppt}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          defaultClientId={defaultClientId}
          defaultTicketId={defaultTicketId}
        />
      )}
    </div>
  )
}

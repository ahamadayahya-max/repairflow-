'use client'

import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin  from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import AppointmentCard from './AppointmentCard'

// ---------------------------------------------------------------------------
// Surcharges CSS dark theme pour FullCalendar
// ---------------------------------------------------------------------------
const DARK_CSS = `
  .fc { --fc-border-color: rgba(255,255,255,0.08); --fc-page-bg-color: transparent;
        --fc-neutral-bg-color: rgba(255,255,255,0.03); --fc-today-bg-color: rgba(245,158,11,0.04); }
  .fc-theme-standard td, .fc-theme-standard th { border-color: rgba(255,255,255,0.08); }
  .fc-col-header-cell-cushion  { color: #9ca3af !important; text-decoration: none !important; font-size: 12px; }
  .fc-timegrid-slot-label-cushion { color: #6b7280 !important; font-size: 11px; }
  .fc-daygrid-day-number { color: #9ca3af !important; text-decoration: none !important; }
  .fc-toolbar-title  { color: #fff !important; font-size: 0.95rem !important; font-weight: 700; }
  .fc-button         { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important;
                       color: #9ca3af !important; border-radius: 8px !important; font-size: 12px !important;
                       padding: 4px 10px !important; box-shadow: none !important; }
  .fc-button:hover   { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
  .fc-button:focus   { box-shadow: none !important; }
  .fc-button-active  { background: rgba(245,158,11,0.18) !important; color: #fbbf24 !important;
                       border-color: rgba(245,158,11,0.3) !important; }
  .fc-today-button   { background: rgba(245,158,11,0.12) !important; color: #fbbf24 !important;
                       border-color: rgba(245,158,11,0.2) !important; }
  .fc-today-button:disabled { opacity: 0.5 !important; }
  .fc-timegrid-now-indicator-line  { border-color: #f59e0b !important; }
  .fc-timegrid-now-indicator-arrow { border-top-color: #f59e0b !important; border-bottom-color: #f59e0b !important; }
  .fc-highlight      { background: rgba(245,158,11,0.08) !important; }
  .fc-non-business   { background: rgba(0,0,0,0.18) !important; }
  .fc-event          { border-radius: 6px !important; border: none !important; cursor: pointer; }
  .fc-event:hover    { filter: brightness(1.1); }
  .fc-timegrid-slot  { height: 36px !important; }
  .fc-scrollgrid     { border-radius: 8px; overflow: hidden; }
  .fc-button-group   { gap: 4px; display: flex; }
  .fc-toolbar        { margin-bottom: 12px !important; flex-wrap: wrap; gap: 8px; }
  .fc-daygrid-event  { border-radius: 4px !important; }
  .fc-event-mirror   { opacity: 0.75; }
  .fc-select-mirror  { background: rgba(245,158,11,0.15) !important; border: 1px solid rgba(245,158,11,0.4) !important; }
`

/**
 * Enveloppe FullCalendar avec le thème sombre RepairFlow.
 * Importé dynamiquement (ssr:false) depuis la page Agenda.
 * @param {{
 *   events: object[],
 *   businessHours: object[],
 *   onSelect: function,
 *   onEventClick: function,
 *   onEventDrop: function,
 *   onEventResize: function,
 *   onDatesSet: function,
 * }} props
 */
export default function CalendarWrapper({
  events,
  businessHours,
  onSelect,
  onEventClick,
  onEventDrop,
  onEventResize,
  onDatesSet,
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DARK_CSS }} />
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        firstDay={1}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        allDaySlot={false}
        nowIndicator={true}
        editable={true}
        selectable={true}
        selectMirror={true}
        height="100%"
        headerToolbar={{
          left:   'prev,next today',
          center: 'title',
          right:  'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{
          today:  "Aujourd'hui",
          month:  'Mois',
          week:   'Semaine',
          day:    'Jour',
        }}
        events={events}
        businessHours={businessHours}
        eventContent={(info) => <AppointmentCard event={info.event} />}
        select={onSelect}
        eventClick={onEventClick}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        datesSet={(info) => onDatesSet?.({ start: info.start, end: info.end })}
      />
    </>
  )
}

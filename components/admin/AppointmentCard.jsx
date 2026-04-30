'use client'

const TYPE_ICONS = {
  drop_off:   '📥',
  pickup:     '📤',
  repair:     '🔧',
  diagnostic: '🔍',
  callback:   '📞',
}

const STATUS_OPACITY = {
  done:      0.5,
  cancelled: 0.4,
  no_show:   0.4,
}

/**
 * Bloc affiché dans chaque créneau du calendrier FullCalendar.
 * @param {{ event: object }} props
 */
export default function AppointmentCard({ event }) {
  const a   = event.extendedProps
  const op  = STATUS_OPACITY[a.status] ?? 1

  return (
    <div style={{ padding: '2px 6px', fontSize: 11, lineHeight: 1.4, opacity: op }}>
      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {TYPE_ICONS[a.type] || '📅'} {a.client?.name ?? event.title}
      </div>
      {a.ticket && (
        <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.ticket.device_brand} {a.ticket.device_model}
        </div>
      )}
    </div>
  )
}

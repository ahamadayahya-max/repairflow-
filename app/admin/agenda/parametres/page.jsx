'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { ArrowLeft, Save, Loader2, Clock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = [
  { day: 1, label: 'Lundi'    },
  { day: 2, label: 'Mardi'    },
  { day: 3, label: 'Mercredi' },
  { day: 4, label: 'Jeudi'    },
  { day: 5, label: 'Vendredi' },
  { day: 6, label: 'Samedi'   },
  { day: 0, label: 'Dimanche' },
]

const INPUT_CLS = `bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white
  text-sm focus:outline-none focus:border-amber-500/40 transition-colors`

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Page de paramétrage des horaires d'ouverture de l'atelier.
 */
export default function AgendaParametresPage() {
  const supabase = getSupabaseClient()

  const [shopId,  setShopId]  = useState(null)
  const [hours,   setHours]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [flash,   setFlash]   = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: shop } = await supabase
        .from('shops').select('id').eq('owner_id', user.id).single()
      if (!shop) { setLoading(false); return }
      setShopId(shop.id)

      const { data } = await supabase
        .from('shop_hours').select('*').eq('shop_id', shop.id).order('day_of_week')

      // S'assure que les 7 jours sont présents
      const hoursMap = Object.fromEntries((data || []).map(d => [d.day_of_week, d]))
      const filled   = DAYS.map(({ day }) => hoursMap[day] ?? {
        day_of_week: day,
        is_open:     day !== 0,
        open_time:   '09:00',
        close_time:  '18:00',
        break_start: '12:00',
        break_end:   '14:00',
      })
      setHours(filled)
      setLoading(false)
    }
    init()
  }, [])

  function update(dayOfWeek, field, value) {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
    ))
  }

  async function handleSave() {
    if (!shopId) return
    setSaving(true)
    try {
      for (const h of hours) {
        await supabase.from('shop_hours').upsert({
          shop_id:     shopId,
          day_of_week: h.day_of_week,
          is_open:     h.is_open,
          open_time:   h.open_time  || '09:00',
          close_time:  h.close_time || '18:00',
          break_start: h.break_start || '12:00',
          break_end:   h.break_end   || '14:00',
        }, { onConflict: 'shop_id,day_of_week' })
      }
      setFlash({ type: 'success', msg: 'Horaires enregistrés' })
    } catch {
      setFlash({ type: 'error', msg: 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
      setTimeout(() => setFlash(null), 3000)
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {flash && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg
          ${flash.type === 'success'
            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {flash.msg}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/agenda"
            className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Horaires d'ouverture
          </h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white
                     bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {/* Grille des jours */}
      <div className="bg-[#111118] border border-white/10 rounded-xl overflow-hidden">
        {/* En-tête de colonne */}
        <div className="grid grid-cols-[120px_80px_1fr] gap-4 px-5 py-3
                        border-b border-white/10 bg-white/2">
          <span className="text-[11px] text-gray-500 uppercase tracking-wide">Jour</span>
          <span className="text-[11px] text-gray-500 uppercase tracking-wide">Ouvert</span>
          <span className="text-[11px] text-gray-500 uppercase tracking-wide">Horaires</span>
        </div>

        {DAYS.map(({ day, label }) => {
          const h = hours.find(x => x.day_of_week === day)
          if (!h) return null
          return (
            <div key={day}
              className="grid grid-cols-[120px_80px_1fr] gap-4 px-5 py-4
                         border-b border-white/5 last:border-0 items-center">
              {/* Nom du jour */}
              <span className={`text-sm font-medium ${h.is_open ? 'text-white' : 'text-gray-600'}`}>
                {label}
              </span>

              {/* Toggle ouvert/fermé */}
              <button
                onClick={() => update(day, 'is_open', !h.is_open)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${h.is_open ? 'bg-amber-500' : 'bg-white/10'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                  ${h.is_open ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>

              {/* Plages horaires */}
              {h.is_open ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="time" value={(h.open_time  || '09:00').slice(0,5)}
                    onChange={e => update(day, 'open_time', e.target.value)}
                    className={INPUT_CLS} />
                  <span className="text-gray-500 text-xs">→</span>
                  <input type="time" value={(h.close_time || '18:00').slice(0,5)}
                    onChange={e => update(day, 'close_time', e.target.value)}
                    className={INPUT_CLS} />
                  <span className="text-gray-600 text-xs mx-1">Pause</span>
                  <input type="time" value={(h.break_start || '12:00').slice(0,5)}
                    onChange={e => update(day, 'break_start', e.target.value)}
                    className={INPUT_CLS} />
                  <span className="text-gray-500 text-xs">→</span>
                  <input type="time" value={(h.break_end || '14:00').slice(0,5)}
                    onChange={e => update(day, 'break_end', e.target.value)}
                    className={INPUT_CLS} />
                </div>
              ) : (
                <span className="text-xs text-gray-600">Fermé</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-600">
        Ces horaires définissent les plages actives dans le calendrier (zones claires)
        et seront utilisés pour les rappels automatiques.
      </p>
    </div>
  )
}

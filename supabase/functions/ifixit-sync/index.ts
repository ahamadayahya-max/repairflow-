/**
 * Edge Function : ifixit-sync
 * Synchronise les appareils populaires depuis l'API iFixit vers la table ifixit_devices.
 * Déclenchée par un CRON hebdomadaire (chaque lundi à 03h00).
 *
 * Catégories synchronisées : Phone, Tablet, Laptop, TV, Console, Camera, Appliance
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IFIXIT_BASE_URL = 'https://www.ifixit.com/api/2.0'

// Requêtes prédéfinies pour hydrater la table avec les appareils les plus courants
const SEED_QUERIES = [
  'iPhone', 'Samsung Galaxy', 'MacBook', 'iPad', 'PlayStation',
  'Nintendo Switch', 'Xbox', 'Pixel', 'Huawei', 'OnePlus',
  'LG TV', 'Samsung TV', 'Dell laptop', 'Lenovo ThinkPad', 'HP laptop',
]

// Mapping titre → catégorie (heuristique simple)
function guessCategory(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('iphone') || t.includes('galaxy s') || t.includes('pixel') ||
      t.includes('huawei') || t.includes('oneplus') || t.includes('phone') ||
      t.includes('xperia') || t.includes('moto'))   return 'Phone'
  if (t.includes('ipad') || t.includes('tab ') || t.includes('tablet'))
                                                      return 'Tablet'
  if (t.includes('macbook') || t.includes('laptop') || t.includes('thinkpad') ||
      t.includes('xps') || t.includes('spectre') || t.includes('zenbook'))
                                                      return 'Laptop'
  if (t.includes('playstation') || t.includes('xbox') ||
      t.includes('nintendo') || t.includes('switch'))
                                                      return 'Console'
  if (t.includes(' tv') || t.includes('oled') || t.includes('qled') ||
      t.includes('bravia'))                           return 'TV'
  if (t.includes('camera') || t.includes('canon') || t.includes('nikon') ||
      t.includes('sony a'))                           return 'Camera'
  return 'Appliance'
}

Deno.serve(async (req) => {
  // Autoriser uniquement POST (CRON Supabase envoie un POST)
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  let synced   = 0
  let errors   = 0

  for (const query of SEED_QUERIES) {
    try {
      const res  = await fetch(
        `${IFIXIT_BASE_URL}/suggest/${encodeURIComponent(query)}?doctypes=device&limit=20`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (!res.ok) { errors++; continue }

      const data = await res.json()
      const results: any[] = data?.results ?? []

      const rows = results.map((r: any) => ({
        id:         r.title.replace(/\s+/g, '_'),
        name:       r.title,
        category:   guessCategory(r.title),
        subcategory: null,
        image_url:  r.image?.standard ?? null,
        ifixit_url: r.url ? `https://www.ifixit.com${r.url}` : null,
        synced_at:  new Date().toISOString(),
      }))

      if (rows.length > 0) {
        const { error } = await supabase
          .from('ifixit_devices')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

        if (error) { console.error('upsert error:', error.message); errors++ }
        else synced += rows.length
      }

      // Délai poli pour ne pas surcharger l'API iFixit
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error(`Erreur pour la requête "${query}":`, err)
      errors++
    }
  }

  return Response.json({ synced, errors, timestamp: new Date().toISOString() })
})

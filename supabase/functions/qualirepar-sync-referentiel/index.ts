// supabase/functions/qualirepar-sync-referentiel/index.ts
// Synchronise le référentiel AgoraPlus (marques, types produits, codes)
// Déclenchement : CRON hebdomadaire (lundi 3h) via Supabase Scheduler

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGORAPLUS_BASE = 'https://api.agoraplus.com/api'

const ECO_ORGS = [
  { id: 44, name: 'ecologic'  },
  { id: 45, name: 'ecosystem' },
]

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const apiKey = Deno.env.get('AGORAPLUS_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'AGORAPLUS_API_KEY manquant' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type':  'application/json',
  }

  const results: Record<string, unknown> = {}

  for (const eco of ECO_ORGS) {
    try {
      // ── 1. Sync marques ────────────────────────────────────────────────
      const brandsRes  = await fetch(`${AGORAPLUS_BASE}/PrintBrandList`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ EcoOrganizationId: eco.id }),
      })
      const brandsData = await brandsRes.json()

      if (brandsData.IsValid && brandsData.ResponseData?.length) {
        const brands = brandsData.ResponseData.map((b: any) => ({
          id:         String(b.BrandId),
          name:       b.BrandName,
          eco_org:    eco.name,
          synced_at:  new Date().toISOString(),
        }))
        await supabase
          .from('qualirepar_brands')
          .upsert(brands, { onConflict: 'id' })
      }

      // ── 2. Sync types produits + codes ─────────────────────────────────
      const typesRes  = await fetch(`${AGORAPLUS_BASE}/PrintProductTypeList`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ EcoOrganizationId: eco.id }),
      })
      const typesData = await typesRes.json()

      if (typesData.IsValid && typesData.ResponseData?.length) {
        for (const pt of typesData.ResponseData) {
          // Upsert type produit
          await supabase.from('qualirepar_product_types').upsert({
            id:             String(pt.ProductTypeId),
            label:          pt.ProductTypeLabel,
            eco_org:        eco.name,
            bonus_amount:   pt.BonusAmount ?? 0,
            has_threshold:  pt.HasThreshold    ?? false,
            threshold_amt:  pt.ThresholdAmount ?? null,
            synced_at:      new Date().toISOString(),
          }, { onConflict: 'id' })

          // Upsert codes symptômes
          if (pt.Symptoms?.length) {
            await supabase.from('qualirepar_symptom_codes').upsert(
              pt.Symptoms.map((s: any) => ({
                id:              String(s.SymptomCode),
                product_type_id: String(pt.ProductTypeId),
                label:           s.SymptomLabel,
              })),
              { onConflict: 'id,product_type_id' }
            )
          }

          // Upsert codes réparations
          if (pt.RepairCodes?.length) {
            await supabase.from('qualirepar_repair_codes').upsert(
              pt.RepairCodes.map((r: any) => ({
                id:              String(r.RepairCode),
                product_type_id: String(pt.ProductTypeId),
                label:           r.RepairLabel,
              })),
              { onConflict: 'id,product_type_id' }
            )
          }
        }
      }

      results[eco.name] = {
        brands:        brandsData.ResponseData?.length  ?? 0,
        product_types: typesData.ResponseData?.length   ?? 0,
      }
    } catch (err: any) {
      console.error(`[sync] Erreur eco ${eco.name} :`, err.message)
      results[eco.name] = { error: err.message }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, synced_at: new Date().toISOString(), results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})

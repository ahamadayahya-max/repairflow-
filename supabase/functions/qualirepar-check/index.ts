// supabase/functions/qualirepar-check/index.ts
// Vérifie si un ticket est éligible au bonus QualiRépar
// Appelée par le frontend quand l'utilisateur ouvre un ticket ou clique "Vérifier"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Correspondance device_type → mots-clés label produit AgoraPlus
const DEVICE_TYPE_KEYWORDS: Record<string, string[]> = {
  smartphone: ['téléphone', 'mobile', 'smartphone', 'phone'],
  tablet:     ['tablette', 'tablet'],
  laptop:     ['ordinateur portable', 'laptop', 'notebook'],
  tv:         ['télévision', 'tv', 'television'],
  appliance:  ['lave-linge', 'réfrigérateur', 'lave-vaisselle', 'electroménager'],
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: { ticket_id?: string }
  try { body = await req.json() } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON invalide' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const { ticket_id } = body
  if (!ticket_id) {
    return new Response(
      JSON.stringify({ error: 'ticket_id requis' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupère le ticket complet
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('id, shop_id, device_type, device_brand, price_final, repair_cost')
    .eq('id', ticket_id)
    .single()

  if (ticketErr || !ticket) {
    return new Response(
      JSON.stringify({ error: 'Ticket introuvable' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Vérifie que QualiRépar est configuré pour cet atelier
  const { data: config } = await supabase
    .from('qualirepar_shop_config')
    .select('active')
    .eq('shop_id', ticket.shop_id)
    .single()

  if (!config?.active) {
    return new Response(
      JSON.stringify({ eligible: false, reason: 'QualiRépar non configuré pour cet atelier' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Cherche la marque dans le cache référentiel (insensible à la casse)
  const { data: brand } = await supabase
    .from('qualirepar_brands')
    .select('id, name, eco_org')
    .ilike('name', `%${ticket.device_brand ?? ''}%`)
    .limit(1)
    .maybeSingle()

  if (!brand) {
    await supabase.from('qualirepar_api_logs').insert({
      ticket_id,
      shop_id:       ticket.shop_id,
      action:        'check_eligibility',
      success:       false,
      error_message: `Marque "${ticket.device_brand}" non trouvée dans le référentiel AgoraPlus`,
    })
    return new Response(
      JSON.stringify({ eligible: false, reason: `Marque "${ticket.device_brand}" non référencée AgoraPlus` }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Cherche le type produit correspondant
  const keywords = DEVICE_TYPE_KEYWORDS[ticket.device_type ?? ''] ?? [ticket.device_type ?? '']
  const orFilter = keywords.map(k => `label.ilike.%${k}%`).join(',')

  const { data: productType } = await supabase
    .from('qualirepar_product_types')
    .select('id, label, bonus_amount, has_threshold, threshold_amt')
    .eq('eco_org', brand.eco_org)
    .or(orFilter)
    .limit(1)
    .maybeSingle()

  if (!productType) {
    return new Response(
      JSON.stringify({ eligible: false, reason: `Type d'appareil "${ticket.device_type}" non couvert par QualiRépar` }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Vérifie le seuil de montant facture si applicable
  const montantFacture = Number(ticket.price_final ?? ticket.repair_cost ?? 0)
  if (productType.has_threshold && montantFacture < Number(productType.threshold_amt ?? 0)) {
    return new Response(
      JSON.stringify({
        eligible: false,
        reason:   `Montant facture (${montantFacture} €) inférieur au seuil requis (${productType.threshold_amt} €)`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Marque le ticket éligible via la RPC
  const { error: rpcErr } = await supabase.rpc('mark_ticket_qualirepar_eligible', {
    p_ticket_id:       ticket_id,
    p_montant:         productType.bonus_amount,
    p_eco_org:         brand.eco_org,
    p_brand_id:        brand.id,
    p_product_type_id: productType.id,
  })

  if (rpcErr) {
    console.error('[qualirepar-check] RPC error:', rpcErr.message)
  }

  // Log de succès
  await supabase.from('qualirepar_api_logs').insert({
    ticket_id,
    shop_id:       ticket.shop_id,
    action:        'check_eligibility',
    eco_org:       brand.eco_org,
    success:       true,
    response_body: {
      brand_id:        brand.id,
      product_type_id: productType.id,
      bonus:           productType.bonus_amount,
    },
  })

  return new Response(
    JSON.stringify({
      eligible:        true,
      montant:         productType.bonus_amount,
      eco_org:         brand.eco_org,
      brand_id:        brand.id,
      product_type_id: productType.id,
      product_label:   productType.label,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})

// supabase/functions/qualirepar-submit/index.ts
// Soumet un dossier QualiRépar à AgoraPlus :
// 1. CreateSupportRequest → validation SMS client
// 2. Upload facture → Supabase Storage
// 3. CreateClaim → dossier de remboursement
//
// NOTE : toutes les erreurs métier retournent HTTP 200 avec { ok: false, error: "..." }
// afin que le client Supabase JS puisse lire le message réel (une réponse non-2xx
// est interceptée avant que le body soit lisible par le composant appelant).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGORAPLUS_BASE = 'https://api.agoraplus.com/api'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Réponse JSON toujours en 200 — évite que supabase-js masque le message d'erreur */
function jsonOk(body: object) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: {
    ticket_id?:           string
    invoice_file_base64?: string
    invoice_mime_type?:   string
  }
  try { body = await req.json() } catch {
    return jsonOk({ ok: false, error: 'Body JSON invalide' })
  }

  const { ticket_id, invoice_file_base64, invoice_mime_type = 'application/pdf' } = body
  if (!ticket_id) {
    return jsonOk({ ok: false, error: 'ticket_id requis' })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Récupère ticket + client ───────────────────────────────────────────────
  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      id, shop_id, qr_eco_org, qr_brand_id, qr_product_type_id,
      qr_symptom_code, qr_repair_code, qr_imei, qr_montant,
      price_final, repair_cost,
      clients!tickets_client_id_fkey(first_name, last_name, phone, email, address)
    `)
    .eq('id', ticket_id)
    .single()

  if (!ticket) {
    return jsonOk({ ok: false, error: 'Ticket introuvable' })
  }

  // ── Récupère la config atelier (clé API stockée dans agoraplus_key_ref) ───
  const { data: shopConfig } = await supabase
    .from('qualirepar_shop_config')
    .select('active, agoraplus_key_ref')
    .eq('shop_id', ticket.shop_id)
    .single()

  // Priorité : clé en base → variable d'env dédiée par atelier → variable globale
  const shopKeyVar = `AGORAPLUS_KEY_${ticket.shop_id.replace(/-/g, '_')}`
  const apiKey     = shopConfig?.agoraplus_key_ref
                  ?? Deno.env.get(shopKeyVar)
                  ?? Deno.env.get('AGORAPLUS_API_KEY')

  if (!apiKey) {
    return jsonOk({
      ok:    false,
      error: 'Clé API AgoraPlus non configurée. Rendez-vous dans Paramètres → QualiRépar pour la saisir.',
    })
  }

  const ecoOrgId = ticket.qr_eco_org === 'ecosystem' ? 45 : 44
  const headers  = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const client   = ticket.clients as any

  // ── ÉTAPE 1 : CreateSupportRequest ────────────────────────────────────────
  const supportPayload = {
    EcoOrganizationId: ecoOrgId,
    RepairDate:         new Date().toISOString(),
    BrandId:            ticket.qr_brand_id,
    ProductTypeId:      ticket.qr_product_type_id,
    SymptomCode:        ticket.qr_symptom_code ?? '',
    RepairCode:         ticket.qr_repair_code  ?? '',
    SerialNumber:       ticket.qr_imei         ?? '',
    ConsumerFirstName:  client?.first_name      ?? '',
    ConsumerLastName:   client?.last_name       ?? '',
    ConsumerPhone:      client?.phone           ?? '',
    ConsumerEmail:      client?.email           ?? '',
    ConsumerAddress:    client?.address         ?? '',
    BonusAmount:        ticket.qr_montant,
    InvoiceAmount:      Number(ticket.price_final ?? ticket.repair_cost ?? 0),
    InvoiceNumber:      `RF-${ticket_id.slice(0, 8).toUpperCase()}`,
  }

  let supportRes, supportData
  try {
    supportRes  = await fetch(`${AGORAPLUS_BASE}/CreateSupportRequest`, {
      method: 'POST', headers, body: JSON.stringify(supportPayload),
    })
    supportData = await supportRes.json()
  } catch (err: any) {
    return jsonOk({ ok: false, error: `Erreur réseau AgoraPlus (étape 1) : ${err.message}` })
  }

  await supabase.from('qualirepar_api_logs').insert({
    ticket_id,
    shop_id:       ticket.shop_id,
    action:        'create_support_request',
    eco_org:       ticket.qr_eco_org,
    request_body:  supportPayload,
    response_body: supportData,
    http_status:   supportRes.status,
    success:       supportData.IsValid ?? false,
  })

  if (!supportData.IsValid) {
    await supabase.rpc('update_qualirepar_status', {
      p_ticket_id:     ticket_id,
      p_status:        'eligible',
      p_error_message: supportData.ResponseErrorMessage ?? 'Erreur CreateSupportRequest',
    })
    return jsonOk({
      ok:    false,
      error: supportData.ResponseErrorMessage ?? 'AgoraPlus a refusé la demande (étape 1)',
    })
  }

  const supportRequestId = supportData.ResponseData?.RequestId
  await supabase.rpc('update_qualirepar_status', {
    p_ticket_id:          ticket_id,
    p_status:             'support_pending',
    p_support_request_id: supportRequestId,
  })

  // ── ÉTAPE 2 : Upload facture dans Supabase Storage ─────────────────────
  let invoiceUrl: string | null = null

  if (invoice_file_base64) {
    try {
      const fileBuffer = Uint8Array.from(atob(invoice_file_base64), c => c.charCodeAt(0))
      const ext        = invoice_mime_type === 'application/pdf' ? 'pdf'
                       : invoice_mime_type === 'image/png'       ? 'png' : 'jpg'
      const path       = `qualirepar/${ticket.shop_id}/${ticket_id}/facture.${ext}`

      const { data: storageData, error: storageErr } = await supabase.storage
        .from('tickets-documents')
        .upload(path, fileBuffer, { contentType: invoice_mime_type, upsert: true })

      if (storageData && !storageErr) {
        const { data: urlData } = supabase.storage
          .from('tickets-documents')
          .getPublicUrl(path)
        invoiceUrl = urlData.publicUrl
      }
    } catch (err: any) {
      // Non bloquant — on continue sans la facture
      console.error('[qualirepar-submit] Storage upload error:', err.message)
    }
  }

  // ── ÉTAPE 3 : CreateClaim ──────────────────────────────────────────────
  const claimPayload = {
    EcoOrganizationId: ecoOrgId,
    RequestId:         supportRequestId,
  }

  let claimRes, claimData
  try {
    claimRes  = await fetch(`${AGORAPLUS_BASE}/CreateClaim`, {
      method: 'POST', headers, body: JSON.stringify(claimPayload),
    })
    claimData = await claimRes.json()
  } catch (err: any) {
    return jsonOk({ ok: false, error: `Erreur réseau AgoraPlus (étape 3) : ${err.message}` })
  }

  await supabase.from('qualirepar_api_logs').insert({
    ticket_id,
    shop_id:       ticket.shop_id,
    action:        'create_claim',
    eco_org:       ticket.qr_eco_org,
    request_body:  claimPayload,
    response_body: claimData,
    http_status:   claimRes.status,
    success:       claimData.IsValid ?? false,
  })

  if (!claimData.IsValid) {
    await supabase.rpc('update_qualirepar_status', {
      p_ticket_id:     ticket_id,
      p_status:        'support_accepted',
      p_error_message: claimData.ResponseErrorMessage ?? 'Erreur CreateClaim',
    })
    return jsonOk({
      ok:    false,
      error: claimData.ResponseErrorMessage ?? 'AgoraPlus a refusé le dossier (étape 3)',
    })
  }

  const claimId = claimData.ResponseData?.ClaimId
  await supabase.rpc('update_qualirepar_status', {
    p_ticket_id:   ticket_id,
    p_status:      'claim_submitted',
    p_claim_id:    claimId,
    p_invoice_url: invoiceUrl,
  })

  return jsonOk({
    ok:                 true,
    claim_id:           claimId,
    support_request_id: supportRequestId,
    invoice_url:        invoiceUrl,
  })
})

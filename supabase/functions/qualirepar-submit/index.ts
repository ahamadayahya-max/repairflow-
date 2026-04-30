// supabase/functions/qualirepar-submit/index.ts
// Soumet un dossier QualiRépar à AgoraPlus :
// 1. CreateSupportRequest → SMS validation client
// 2. Upload facture → Supabase Storage
// 3. CreateClaim → dossier de remboursement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AGORAPLUS_BASE = 'https://api.agoraplus.com/api'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: {
    ticket_id?:           string
    invoice_file_base64?: string
    invoice_mime_type?:   string
  }
  try { body = await req.json() } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Body JSON invalide' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const { ticket_id, invoice_file_base64, invoice_mime_type = 'application/pdf' } = body
  if (!ticket_id) {
    return new Response(
      JSON.stringify({ ok: false, error: 'ticket_id requis' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Récupère ticket + client + config atelier ──────────────────────────
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
    return new Response(
      JSON.stringify({ ok: false, error: 'Ticket introuvable' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Clé API de l'atelier : d'abord variable dédiée, sinon clé globale
  const shopKeyVar = `AGORAPLUS_KEY_${ticket.shop_id.replace(/-/g, '_')}`
  const apiKey     = Deno.env.get(shopKeyVar) ?? Deno.env.get('AGORAPLUS_API_KEY')

  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Clé API AgoraPlus non configurée pour cet atelier' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const ecoOrgId = ticket.qr_eco_org === 'ecosystem' ? 45 : 44
  const headers  = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const client   = ticket.clients as any

  // ── ÉTAPE 1 : CreateSupportRequest ────────────────────────────────────
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
    return new Response(
      JSON.stringify({ ok: false, error: `Erreur réseau AgoraPlus : ${err.message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
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
    return new Response(
      JSON.stringify({ ok: false, error: supportData.ResponseErrorMessage }),
      { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const supportRequestId = supportData.ResponseData?.RequestId
  await supabase.rpc('update_qualirepar_status', {
    p_ticket_id:           ticket_id,
    p_status:              'support_pending',
    p_support_request_id:  supportRequestId,
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
      console.error('[qualirepar-submit] Storage upload error:', err.message)
      // Non bloquant — on continue sans la facture
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
    return new Response(
      JSON.stringify({ ok: false, error: `Erreur réseau AgoraPlus CreateClaim : ${err.message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
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
    return new Response(
      JSON.stringify({ ok: false, error: claimData.ResponseErrorMessage }),
      { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const claimId = claimData.ResponseData?.ClaimId
  await supabase.rpc('update_qualirepar_status', {
    p_ticket_id:   ticket_id,
    p_status:      'claim_submitted',
    p_claim_id:    claimId,
    p_invoice_url: invoiceUrl,
  })

  return new Response(
    JSON.stringify({
      ok:                 true,
      claim_id:           claimId,
      support_request_id: supportRequestId,
      invoice_url:        invoiceUrl,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})

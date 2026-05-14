// app/api/invoices/create/route.js
// Crée une nouvelle facture (depuis un ticket ou manuellement).

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const body = await req.json()
    const {
      shop_id, ticket_id, client_name, client_email, client_phone, client_address,
      lines, tva_rate = 20, qualirepar_bonus = 0, notes, due_at,
    } = body

    if (!shop_id || !client_name || !lines?.length) {
      return Response.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Calcul des totaux
    const subtotal_ht = lines.reduce((s, l) =>
      s + parseFloat(l.unit_price_ht || 0) * parseInt(l.qty || 1), 0)
    const tva_amount  = parseFloat((subtotal_ht * tva_rate / 100).toFixed(2))
    const total_ttc   = parseFloat((subtotal_ht + tva_amount).toFixed(2))
    const total_net   = parseFloat((total_ttc - parseFloat(qualirepar_bonus || 0)).toFixed(2))

    // Numéro de facture
    const { data: invNum } = await supabase.rpc('next_invoice_number', { p_shop_id: shop_id })

    // Insère la facture
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        shop_id, ticket_id: ticket_id || null,
        invoice_number: invNum,
        client_name, client_email: client_email || null,
        client_phone: client_phone || null,
        client_address: client_address || null,
        status: 'draft',
        subtotal_ht: parseFloat(subtotal_ht.toFixed(2)),
        tva_rate, tva_amount, total_ttc,
        qualirepar_bonus: parseFloat(qualirepar_bonus || 0),
        total_net,
        notes: notes || null,
        issued_at: new Date().toISOString(),
        due_at: due_at || null,
      })
      .select('id, invoice_number')
      .single()

    if (invErr) throw invErr

    // Insère les lignes
    const linesData = lines.map(l => ({
      invoice_id:    invoice.id,
      description:   l.description,
      qty:           parseInt(l.qty || 1),
      unit_price_ht: parseFloat(l.unit_price_ht || 0),
      tva_rate:      parseFloat(l.tva_rate || tva_rate),
    }))

    const { error: lErr } = await supabase.from('invoice_lines').insert(linesData)
    if (lErr) throw lErr

    return Response.json({ invoice_id: invoice.id, invoice_number: invoice.invoice_number })
  } catch (err) {
    console.error('[invoice-create]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// app/api/invoices/[id]/pdf/route.js
// Génère et retourne le PDF d'une facture.

import { createClient } from '@supabase/supabase-js'
import { generateInvoicePdf } from '@/lib/pdf/invoicePdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(req, { params }) {
  const { id } = await params

  try {
    // Récupère la facture
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Facture introuvable' }), { status: 404 })
    }

    // Récupère les lignes
    const { data: lines } = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at')

    // Récupère les infos de l'atelier
    const { data: shop } = await supabase
      .from('shops')
      .select('name, phone, address')
      .eq('id', invoice.shop_id)
      .single()

    // Récupère la ref ticket si présent
    let ticketRef = null
    if (invoice.ticket_id) {
      const { data: t } = await supabase
        .from('tickets')
        .select('tracking_token')
        .eq('id', invoice.ticket_id)
        .single()
      ticketRef = t?.tracking_token
    }

    const pdfBuffer = await generateInvoicePdf({
      invoice: { ...invoice, ticket_ref: ticketRef },
      lines:   lines ?? [],
      shop,
    })

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
        'Content-Length':      String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[invoice-pdf]', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

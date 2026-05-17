// app/api/invoices/[id]/send/route.js
// Génère le PDF et l'envoie par email au client.

import { createClient } from '@supabase/supabase-js'
import { generateInvoicePdf } from '@/lib/pdf/invoicePdf'
import nodemailer from 'nodemailer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req, { params }) {
  const { id } = await params

  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !invoice) {
      return Response.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    if (!invoice.client_email) {
      return Response.json({ error: 'Aucun email client pour cette facture' }, { status: 400 })
    }

    const { data: lines } = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at')

    const { data: shop } = await supabase
      .from('shops')
      .select('name, phone, address')
      .eq('id', invoice.shop_id)
      .single()

    const pdfBuffer = await generateInvoicePdf({ invoice, lines: lines ?? [], shop })

    // Envoi via nodemailer (Mailpit en dev, Brevo en prod)
    const transporter = nodemailer.createTransport({
      host: process.env.MAILPIT_SMTP_HOST || 'localhost',
      port: parseInt(process.env.MAILPIT_SMTP_PORT || '1025'),
      secure: false,
    })

    await transporter.sendMail({
      from:    `"${shop?.name || 'ReparFlow'}" <${process.env.MAIL_FROM_ADDRESS || 'noreply@reparflow.local'}>`,
      to:      invoice.client_email,
      subject: `Votre facture ${invoice.invoice_number} — ${shop?.name || 'ReparFlow'}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#111118;padding:24px;border-radius:12px 12px 0 0;">
            <h1 style="color:#F59E0B;margin:0;font-size:22px;">ReparFlow</h1>
            <p style="color:#9CA3AF;margin:4px 0 0;font-size:13px;">${shop?.name || ''}</p>
          </div>
          <div style="background:#ffffff;padding:24px;border:1px solid #E5E7EB;border-radius:0 0 12px 12px;">
            <p style="font-size:16px;color:#1F2937;">Bonjour <strong>${invoice.client_name}</strong>,</p>
            <p style="color:#4B5563;">Veuillez trouver ci-joint votre facture <strong>${invoice.invoice_number}</strong>
               d'un montant de <strong>${parseFloat(invoice.total_net).toFixed(2)} €</strong>.</p>
            <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0;color:#6B7280;font-size:13px;">Montant HT : ${parseFloat(invoice.subtotal_ht).toFixed(2)} €</p>
              <p style="margin:4px 0;color:#6B7280;font-size:13px;">TVA (${invoice.tva_rate}%) : ${parseFloat(invoice.tva_amount).toFixed(2)} €</p>
              ${parseFloat(invoice.qualirepar_bonus || 0) > 0
                ? `<p style="margin:4px 0;color:#10B981;font-size:13px;">Bonus QualiRépar : -${parseFloat(invoice.qualirepar_bonus).toFixed(2)} €</p>`
                : ''}
              <p style="margin:8px 0 0;color:#111118;font-size:16px;font-weight:bold;">Total net : ${parseFloat(invoice.total_net).toFixed(2)} €</p>
            </div>
            <p style="color:#4B5563;font-size:13px;">Cordialement,<br><strong>${shop?.name || 'ReparFlow'}</strong></p>
          </div>
        </div>
      `,
      attachments: [{
        filename:    `${invoice.invoice_number}.pdf`,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }],
    })

    // Met à jour le statut → 'sent' si encore brouillon
    if (invoice.status === 'draft') {
      await supabase
        .from('invoices')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[invoice-send]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

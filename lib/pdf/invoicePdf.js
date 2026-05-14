/**
 * Génération de PDF de facture avec PDFKit (Node.js).
 * Retourne un Buffer prêt à envoyer en réponse HTTP ou en pièce jointe email.
 */

import PDFDocument from 'pdfkit'

const AMBER  = '#F59E0B'
const DARK   = '#111118'
const GRAY   = '#6B7280'
const LIGHT  = '#F3F4F6'
const BLACK  = '#1F2937'
const GREEN  = '#10B981'
const RED    = '#EF4444'

/**
 * Génère un PDF de facture.
 * @param {{ invoice: object, lines: object[], shop: object }} params
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdf({ invoice, lines, shop }) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ size: 'A4', margin: 50, compress: true })

    doc.on('data',  chunk => chunks.push(chunk))
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)))
    doc.on('error', err   => reject(err))

    const W = doc.page.width - 100  // largeur utile
    const L = 50                    // marge gauche

    // ---------------------------------------------------------------------------
    // En-tête : bande colorée + logo texte
    // ---------------------------------------------------------------------------
    doc.rect(0, 0, doc.page.width, 80).fill(DARK)
    doc.font('Helvetica-Bold').fontSize(22).fillColor(AMBER).text('RepairFlow', L, 25)
    doc.font('Helvetica').fontSize(9).fillColor('#9CA3AF').text('Logiciel de gestion d\'ateliers de réparation', L, 52)

    // Numéro de facture (coin droit)
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF')
       .text('FACTURE', 0, 25, { align: 'right', width: doc.page.width - L })
    doc.font('Helvetica').fontSize(11).fillColor(AMBER)
       .text(invoice.invoice_number, 0, 48, { align: 'right', width: doc.page.width - L })

    doc.moveDown(3)

    // ---------------------------------------------------------------------------
    // Bloc Émetteur / Destinataire
    // ---------------------------------------------------------------------------
    const yBlocks = 110
    doc.fillColor(BLACK)

    // Atelier (gauche)
    doc.font('Helvetica-Bold').fontSize(10).text('DE', L, yBlocks)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text(shop?.name || 'Mon Atelier', L, yBlocks + 15)
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
    if (shop?.address) doc.text(shop.address, L, yBlocks + 30)
    if (shop?.phone)   doc.text(shop.phone,   L, yBlocks + 43)

    // Client (droite)
    const colR = L + W / 2 + 20
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK).text('FACTURÉ À', colR, yBlocks)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text(invoice.client_name, colR, yBlocks + 15)
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
    if (invoice.client_email)   doc.text(invoice.client_email,   colR, yBlocks + 30)
    if (invoice.client_phone)   doc.text(invoice.client_phone,   colR, yBlocks + 43)
    if (invoice.client_address) doc.text(invoice.client_address, colR, yBlocks + 56)

    // Dates
    const yDates = yBlocks + 80
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
    const issued = invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('fr-FR') : '—'
    const due    = invoice.due_at    ? new Date(invoice.due_at).toLocaleDateString('fr-FR')    : '—'
    doc.text(`Date d'émission : ${issued}`, L,     yDates)
    doc.text(`Date d'échéance : ${due}`,    colR,  yDates)
    if (invoice.ticket_id) {
      doc.text(`Réf. ticket : ${invoice.ticket_ref || ''}`, L, yDates + 13)
    }

    // Séparateur
    const ySep = yDates + 35
    doc.rect(L, ySep, W, 1).fill('#E5E7EB')

    // ---------------------------------------------------------------------------
    // Tableau des lignes
    // ---------------------------------------------------------------------------
    const yTable   = ySep + 15
    const colWidths = [W * 0.50, W * 0.10, W * 0.18, W * 0.10, W * 0.12]
    const headers   = ['Description', 'Qté', 'P.U. HT', 'TVA', 'Total HT']

    // En-tête tableau
    doc.rect(L, yTable, W, 22).fill(DARK)
    let xH = L
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
         .text(h, xH + 4, yTable + 7, { width: colWidths[i] - 4, align: i > 0 ? 'right' : 'left' })
      xH += colWidths[i]
    })

    // Lignes de données
    let yRow = yTable + 22
    ;(lines || []).forEach((line, idx) => {
      const totalHT = parseFloat(line.unit_price_ht || 0) * parseInt(line.qty || 1)
      const bg = idx % 2 === 0 ? '#FFFFFF' : LIGHT
      doc.rect(L, yRow, W, 20).fill(bg)

      const cells = [
        line.description,
        String(line.qty),
        `${parseFloat(line.unit_price_ht || 0).toFixed(2)} €`,
        `${line.tva_rate || 20}%`,
        `${totalHT.toFixed(2)} €`,
      ]
      let xC = L
      cells.forEach((cell, i) => {
        doc.font('Helvetica').fontSize(9).fillColor(BLACK)
           .text(cell, xC + 4, yRow + 6, { width: colWidths[i] - 4, align: i > 0 ? 'right' : 'left' })
        xC += colWidths[i]
      })

      // Ligne séparatrice légère
      doc.rect(L, yRow + 20, W, 0.5).fill('#E5E7EB')
      yRow += 20
    })

    // ---------------------------------------------------------------------------
    // Totaux
    // ---------------------------------------------------------------------------
    const yTotals = yRow + 15
    const xTLabel = L + W * 0.60
    const xTValue = L + W - 5
    const tWidth  = W * 0.38

    const totalsRows = [
      { label: 'Sous-total HT',    value: `${parseFloat(invoice.subtotal_ht || 0).toFixed(2)} €`,  bold: false },
      { label: `TVA (${invoice.tva_rate || 20}%)`, value: `${parseFloat(invoice.tva_amount || 0).toFixed(2)} €`, bold: false },
      { label: 'Total TTC',        value: `${parseFloat(invoice.total_ttc || 0).toFixed(2)} €`,    bold: false },
    ]

    if (parseFloat(invoice.qualirepar_bonus || 0) > 0) {
      totalsRows.push({
        label: '🔁 Bonus QualiRépar',
        value: `- ${parseFloat(invoice.qualirepar_bonus).toFixed(2)} €`,
        bold: false, color: GREEN,
      })
    }

    totalsRows.push({
      label: 'NET À PAYER',
      value: `${parseFloat(invoice.total_net || 0).toFixed(2)} €`,
      bold: true, bg: DARK,
    })

    let yT = yTotals
    totalsRows.forEach(t => {
      if (t.bg) {
        doc.rect(xTLabel - 10, yT, tWidth + 15, 24).fill(t.bg)
        doc.font('Helvetica-Bold').fontSize(11).fillColor(AMBER)
           .text(t.label, xTLabel, yT + 7, { width: tWidth * 0.55, align: 'left' })
        doc.font('Helvetica-Bold').fontSize(11).fillColor(AMBER)
           .text(t.value, xTLabel, yT + 7, { width: tWidth, align: 'right' })
      } else {
        doc.font(t.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
           .fillColor(t.color || GRAY)
           .text(t.label, xTLabel, yT + 4, { width: tWidth * 0.55, align: 'left' })
        doc.font(t.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
           .fillColor(t.color || BLACK)
           .text(t.value, xTLabel, yT + 4, { width: tWidth, align: 'right' })
      }
      yT += t.bg ? 24 : 18
    })

    // Badge statut
    const statusLabel = { draft:'Brouillon', sent:'Envoyée', paid:'Payée', cancelled:'Annulée' }
    const statusColor = { draft: GRAY, sent: '#3B82F6', paid: GREEN, cancelled: RED }
    const stColor = statusColor[invoice.status] || GRAY
    doc.rect(L, yTotals, 120, 24).fill(stColor + '20')
    doc.font('Helvetica-Bold').fontSize(10).fillColor(stColor)
       .text(statusLabel[invoice.status] || invoice.status, L + 8, yTotals + 7)

    // ---------------------------------------------------------------------------
    // Notes
    // ---------------------------------------------------------------------------
    if (invoice.notes) {
      const yNotes = yT + 20
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text('Notes :', L, yNotes)
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(invoice.notes, L, yNotes + 14, { width: W })
    }

    // ---------------------------------------------------------------------------
    // Pied de page
    // ---------------------------------------------------------------------------
    const yFooter = doc.page.height - 60
    doc.rect(0, yFooter, doc.page.width, 60).fill(DARK)
    doc.font('Helvetica').fontSize(8).fillColor('#6B7280')
       .text('Généré par RepairFlow — repairflow-app.vercel.app', L, yFooter + 12, { align: 'center', width: doc.page.width - 100 })
    doc.font('Helvetica').fontSize(8).fillColor('#4B5563')
       .text(invoice.invoice_number, L, yFooter + 28, { align: 'center', width: doc.page.width - 100 })

    doc.end()
  })
}

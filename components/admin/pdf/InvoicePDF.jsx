// Importé dynamiquement côté client uniquement
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const c = {
  dark:   '#111827',
  mid:    '#374151',
  light:  '#6B7280',
  border: '#E5E7EB',
  amber:  '#F59E0B',
  green:  '#059669',
}

const s = StyleSheet.create({
  page:      { fontSize: 9, fontFamily: 'Helvetica', padding: '36 40', color: c.dark, backgroundColor: '#fff' },
  bold:      { fontFamily: 'Helvetica-Bold' },
  row:       { flexDirection: 'row' },

  header:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  shopName:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.dark, marginBottom: 4 },
  docType:   { fontSize: 26, fontFamily: 'Helvetica-Bold', color: c.amber, letterSpacing: 2 },
  docNum:    { fontSize: 10, color: c.mid, marginTop: 4 },

  infoGrid:  { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoBox:   { flex: 1, backgroundColor: '#F9FAFB', padding: '10 12', borderRadius: 4 },
  label:     { fontSize: 8, color: c.light, marginBottom: 3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },

  tHead:     { flexDirection: 'row', backgroundColor: c.dark, padding: '5 8' },
  tHeadText: { color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  tRow:      { flexDirection: 'row', padding: '5 8', borderBottom: `1 solid ${c.border}` },
  tRowAlt:   { flexDirection: 'row', padding: '5 8', borderBottom: `1 solid ${c.border}`, backgroundColor: '#FAFAFA' },
  tRowQR:    { flexDirection: 'row', padding: '5 8', borderBottom: `1 solid ${c.border}`, backgroundColor: '#FFF7ED' },
  col3:      { flex: 3 },
  col1:      { flex: 1, textAlign: 'center' },
  col15:     { flex: 1.5, textAlign: 'right' },

  totals:    { marginLeft: 'auto', width: 220, marginTop: 16 },
  totRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, paddingHorizontal: 6 },
  totNet:    { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.amber, padding: '7 10', borderRadius: 4, marginTop: 6 },
  totNetTxt: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 11 },

  badge:     { fontSize: 8, fontFamily: 'Helvetica-Bold', padding: '2 6', borderRadius: 3, marginTop: 2 },

  footer:    { position: 'absolute', bottom: 28, left: 40, right: 40, borderTop: `1 solid ${c.border}`, paddingTop: 8 },
  footerText:{ fontSize: 7, color: c.light, lineHeight: 1.5 },
})

function fmt(n) { return Number(n || 0).toFixed(2).replace('.', ',') + ' €' }
function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
}

/**
 * Template PDF pour une facture conforme au droit français.
 * Importé dynamiquement : import('@/components/admin/pdf/InvoicePDF')
 * @param {{
 *   invoice: object,
 *   lines:   object[],
 *   shop:    object,
 *   client:  object,
 *   ticket?: object,  // ticket lié — pour éco-organisme et n° dossier QualiRépar
 * }} props
 */
export default function InvoicePDF({ invoice = {}, lines = [], shop = {}, client = {}, ticket = null }) {
  const subtotal   = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const discount   = Number(invoice.discount_amount || 0)
  const totalHT    = subtotal - discount
  const taxRate    = Number(invoice.tax_rate || 20)
  const tva        = totalHT * taxRate / 100
  const totalTTC   = totalHT + tva
  const qrDed      = Number(invoice.qr_deduction || 0)
  const totalNet   = totalTTC - qrDed
  const hasQR      = qrDed > 0

  // Données QualiRépar — depuis le ticket lié ou l'invoice
  const ecoOrg  = ticket?.qr_eco_org  ?? invoice.qr_eco_org  ?? null
  const claimId = ticket?.qr_claim_id ?? invoice.qr_claim_id ?? null
  const ecoName = ecoOrg === 'ecologic' ? 'Ecologic' : ecoOrg === 'ecosystem' ? 'Ecosystem' : 'éco-organisme partenaire'

  const statusLabels = {
    draft:     'Brouillon',
    sent:      'Envoyée',
    paid:      'Payée',
    partial:   'Paiement partiel',
    overdue:   'En retard',
    cancelled: 'Annulée',
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── En-tête ── */}
        <View style={s.header}>
          <View>
            <Text style={s.shopName}>{shop.name || 'Atelier'}</Text>
            {shop.siret   && <Text style={{ color: c.mid }}>SIRET : {shop.siret}</Text>}
            {shop.address && <Text style={{ color: c.light }}>{shop.address}</Text>}
            {shop.phone   && <Text style={{ color: c.light }}>{shop.phone}</Text>}
            {shop.email   && <Text style={{ color: c.light }}>{shop.email}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docType}>FACTURE</Text>
            <Text style={s.docNum}>{invoice.invoice_number || '—'}</Text>
            <Text style={{ color: c.light, marginTop: 6 }}>
              Date d'émission : {fmtDate(invoice.issue_date)}
            </Text>
            <Text style={{ color: invoice.status === 'overdue' ? 'red' : c.mid, marginTop: 2 }}>
              Échéance : {fmtDate(invoice.due_date)}
            </Text>
            <Text style={[s.badge, {
              backgroundColor: invoice.status === 'paid' ? '#D1FAE5' : '#FEF3C7',
              color:           invoice.status === 'paid' ? c.green : '#92400E',
            }]}>
              {statusLabels[invoice.status] || 'Brouillon'}
            </Text>
          </View>
        </View>

        {/* ── Infos client ── */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.label}>Facturé à</Text>
            <Text style={[s.bold, { fontSize: 10, marginBottom: 2 }]}>{client.full_name || '—'}</Text>
            {client.phone && <Text style={{ color: c.mid }}>{client.phone}</Text>}
            {client.email && <Text style={{ color: c.mid }}>{client.email}</Text>}
          </View>
          {invoice.amount_paid > 0 && (
            <View style={s.infoBox}>
              <Text style={s.label}>Paiement reçu</Text>
              <Text style={[s.bold, { fontSize: 10, color: c.green }]}>{fmt(invoice.amount_paid)}</Text>
              {invoice.payment_date && (
                <Text style={{ color: c.mid }}>Le {fmtDate(invoice.payment_date)}</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Tableau lignes ── */}
        <View style={s.tHead}>
          <Text style={[s.tHeadText, s.col3]}>Description</Text>
          <Text style={[s.tHeadText, s.col1]}>Qté</Text>
          <Text style={[s.tHeadText, s.col15]}>Prix unit. HT</Text>
          <Text style={[s.tHeadText, s.col15]}>Total HT</Text>
        </View>
        {lines.map((line, i) => {
          const lineTotal = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0)
          const rowStyle  = line.line_type === 'qualirepar' ? s.tRowQR : i % 2 === 0 ? s.tRow : s.tRowAlt
          return (
            <View key={i} style={rowStyle}>
              <Text style={s.col3}>{line.description || '—'}</Text>
              <Text style={s.col1}>{line.quantity}</Text>
              <Text style={s.col15}>{fmt(line.unit_price)}</Text>
              <Text style={[s.col15, line.line_type === 'qualirepar' ? { color: c.green } : {}]}>
                {fmt(lineTotal)}
              </Text>
            </View>
          )
        })}

        {/* ── Totaux ── */}
        <View style={s.totals}>
          <View style={s.totRow}>
            <Text>Sous-total HT :</Text>
            <Text style={s.bold}>{fmt(subtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={s.totRow}>
              <Text>Remise :</Text>
              <Text style={{ color: c.green }}>-{fmt(discount)}</Text>
            </View>
          )}
          <View style={s.totRow}>
            <Text>TVA ({taxRate}%) :</Text>
            <Text>{fmt(tva)}</Text>
          </View>
          <View style={[s.totRow, { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 4, marginTop: 2 }]}>
            <Text style={s.bold}>Total TTC :</Text>
            <Text style={s.bold}>{fmt(totalTTC)}</Text>
          </View>

          {/* ── Ligne QualiRépar — bloc vert avec éco-organisme et n° dossier ── */}
          {hasQR && (
            <View style={{
              backgroundColor: '#f0fdf4',
              borderRadius: 5,
              padding: '6 8',
              marginTop: 6,
              borderLeftWidth: 3,
              borderLeftColor: c.green,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#065f46' }}>
                  🔁 Bonus Réparation QualiRépar
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.green }}>
                  -{fmt(qrDed)}
                </Text>
              </View>
              <Text style={{ fontSize: 7, color: '#6b7280' }}>
                {'Dispositif financé par ' + ecoName + (claimId ? ' · Dossier #' + claimId : '')}
              </Text>
            </View>
          )}

          {/* ── NET À PAYER — proéminent en ambré ── */}
          <View style={[s.totNet, hasQR ? { marginTop: 8, borderTopWidth: 2, borderTopColor: '#d1d5db' } : {}]}>
            <Text style={[s.totNetTxt, { fontSize: hasQR ? 12 : 11 }]}>NET À PAYER :</Text>
            <Text style={[s.totNetTxt, { fontSize: hasQR ? 16 : 11 }]}>{fmt(hasQR ? totalNet : totalTTC)}</Text>
          </View>

          {/* Mention "dont QR" */}
          {hasQR && (
            <Text style={{ fontSize: 7, color: c.green, textAlign: 'right', marginTop: 3 }}>
              {'Dont ' + fmt(qrDed) + ' pris en charge par QualiRépar'}
            </Text>
          )}
        </View>

        {/* ── Mention légale QualiRépar (obligatoire AGEC) ── */}
        {hasQR && (
          <View style={{
            marginTop: 14,
            padding: '7 10',
            backgroundColor: '#f9fafb',
            borderRadius: 5,
            borderWidth: 1,
            borderColor: c.border,
          }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 3 }}>
              Mention réglementaire — Bonus Réparation QualiRépar
            </Text>
            <Text style={{ fontSize: 7.5, color: '#6b7280', lineHeight: 1.5 }}>
              {'Le montant de ' + fmt(qrDed) + ' correspond au Bonus Réparation déduit conformément au ' +
               'dispositif prévu par la loi AGEC n°2020-105 et au décret n°2022-1498 relatif au fonds de réparation. ' +
               'Ce bonus est financé par l\'éco-organisme ' + ecoName +
               ' et remboursé directement au réparateur labellisé QualiRépar.' +
               (claimId ? ' Référence dossier : #' + claimId + '.' : '')}
            </Text>
          </View>
        )}

        {/* ── Notes ── */}
        {invoice.notes && (
          <View style={{ marginTop: 20 }}>
            <Text style={s.label}>Notes</Text>
            <Text style={{ color: c.mid, lineHeight: 1.5 }}>{invoice.notes}</Text>
          </View>
        )}

        {/* ── Pied de page légal ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            TVA acquittée sur les encaissements · Conditions de règlement : {fmtDate(invoice.due_date)} · Escompte pour paiement anticipé : néant
          </Text>
          <Text style={s.footerText}>
            En cas de retard de paiement, des pénalités de 3× le taux directeur de la BCE seront appliquées, augmentées d'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L.441-10 du Code de commerce).
          </Text>
          {shop.name && (
            <Text style={[s.footerText, { marginTop: 4, textAlign: 'center' }]}>
              {shop.name}{shop.address ? ` · ${shop.address}` : ''}{shop.phone ? ` · ${shop.phone}` : ''}
            </Text>
          )}
        </View>

      </Page>
    </Document>
  )
}

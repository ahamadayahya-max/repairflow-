'use client'

import {
  Document, Page, Text, View, StyleSheet, Image, Font,
} from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Styles PDF (react-pdf n'utilise pas Tailwind — styles inline obligatoires)
// ---------------------------------------------------------------------------

const AMBER = '#F59E0B'
const DARK  = '#111118'
const GRAY  = '#6B7280'
const LIGHT = '#F9FAFB'

const s = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        10,
    color:           '#1F2937',
    padding:         40,
    backgroundColor: '#FFFFFF',
  },

  // En-tête
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    marginBottom:    32,
    paddingBottom:   20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logo: {
    width:  80,
    height: 30,
    objectFit: 'contain',
  },
  shopName: {
    fontSize:   16,
    fontFamily: 'Helvetica-Bold',
    color:      DARK,
  },
  shopMeta: {
    fontSize: 9,
    color:    GRAY,
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize:   22,
    fontFamily: 'Helvetica-Bold',
    color:      AMBER,
    textAlign:  'right',
  },
  invoiceRef: {
    fontSize:  10,
    color:     GRAY,
    textAlign: 'right',
    marginTop: 4,
  },

  // Bloc infos
  twoCol: {
    flexDirection:  'row',
    gap:            20,
    marginBottom:   24,
  },
  col: { flex: 1 },
  sectionTitle: {
    fontSize:     9,
    fontFamily:   'Helvetica-Bold',
    color:        GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom:  6,
  },
  value: {
    fontSize: 10,
    color:    '#1F2937',
    marginBottom: 2,
  },

  // Tableau des prestations
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection:   'row',
    backgroundColor: DARK,
    borderRadius:    4,
    padding:         8,
    marginBottom:    2,
  },
  tableHeaderText: {
    color:      '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize:   9,
  },
  tableRow: {
    flexDirection:   'row',
    padding:         8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: {
    backgroundColor: LIGHT,
  },
  tableCell: {
    fontSize: 10,
    color:    '#374151',
  },
  colDesc:   { flex: 4 },
  colQty:    { flex: 1, textAlign: 'center' },
  colPU:     { flex: 2, textAlign: 'right'  },
  colTotal:  { flex: 2, textAlign: 'right'  },

  // Totaux
  totalsBox: {
    alignSelf:  'flex-end',
    width:      220,
    marginBottom: 24,
  },
  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color:    GRAY,
  },
  totalValue: {
    fontSize: 10,
    color:    '#1F2937',
  },
  totalTTCRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    paddingVertical: 8,
    marginTop:       4,
    borderTopWidth:  2,
    borderTopColor:  AMBER,
  },
  totalTTCLabel: {
    fontSize:   13,
    fontFamily: 'Helvetica-Bold',
    color:      DARK,
  },
  totalTTCValue: {
    fontSize:   13,
    fontFamily: 'Helvetica-Bold',
    color:      AMBER,
  },
  deductionRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 2,
  },
  deductionLabel: { fontSize: 10, color: '#059669' },
  deductionValue: { fontSize: 10, color: '#059669' },
  netRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    paddingVertical: 8,
    borderTopWidth:  1,
    borderTopColor:  '#059669',
  },
  netLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#059669' },
  netValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#059669' },

  // QualiRépar
  qrMention: {
    fontSize:        8,
    color:           GRAY,
    fontStyle:       'italic',
    marginBottom:    16,
    padding:         8,
    backgroundColor: '#F0FDF4',
    borderRadius:    4,
    borderWidth:     1,
    borderColor:     '#BBF7D0',
  },

  // Pied de page
  footer: {
    position:  'absolute',
    bottom:    30,
    left:      40,
    right:     40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color:    GRAY,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso) {
  if (!iso) return new Date().toLocaleDateString('fr-FR')
  return new Date(iso).toLocaleDateString('fr-FR')
}

function fmtEur(val) {
  if (val == null) return '—'
  return `${Number(val).toFixed(2)} €`
}

// ---------------------------------------------------------------------------
// Composant PDF
// ---------------------------------------------------------------------------

/**
 * Facture PDF générée côté client avec @react-pdf/renderer.
 *
 * @param {{
 *   ticket: object,
 *   shop: object,
 *   client: object,
 *   ticketParts: Array<object>,
 * }} props
 */
export default function InvoicePDF({ ticket, shop, client, ticketParts = [] }) {
  const ref       = `RF-${(ticket.id ?? '').slice(0, 8).toUpperCase()}`
  const dateDoc   = fmtDate(ticket.closed_at)
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ')
                   || client?.full_name
                   || '—'

  // Prix de la main d'œuvre
  const laborPrice = ticket.price_final ?? ticket.price_estimate ?? 0

  // Lignes du tableau
  const lines = [
    {
      desc:  `Réparation ${[ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type || 'appareil'}`,
      qty:   1,
      pu:    laborPrice,
      total: laborPrice,
    },
    ...ticketParts.map(tp => ({
      desc:  tp.parts_inventory?.part_name ?? `Pièce #${tp.part_id?.slice(0, 6)}`,
      qty:   tp.quantity,
      pu:    tp.unit_price ?? 0,
      total: (tp.unit_price ?? 0) * tp.quantity,
    })),
  ]

  const totalHT  = lines.reduce((s, l) => s + l.total, 0)
  const tva      = totalHT * 0.2
  const totalTTC = totalHT + tva

  // QualiRépar
  const qrEligible = ticket.qr_eligible && ticket.qr_montant > 0
  const netApres   = totalTTC - (ticket.qr_montant ?? 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── En-tête ── */}
        <View style={s.header}>
          <View>
            {shop.logo_url ? (
              <Image src={shop.logo_url} style={s.logo} />
            ) : (
              <Text style={s.shopName}>{shop.name ?? 'RepairFlow'}</Text>
            )}
            {shop.address && <Text style={s.shopMeta}>{shop.address}</Text>}
            {shop.phone   && <Text style={s.shopMeta}>{shop.phone}</Text>}
            {shop.email   && <Text style={s.shopMeta}>{shop.email}</Text>}
          </View>
          <View>
            <Text style={s.invoiceTitle}>FACTURE</Text>
            <Text style={s.invoiceRef}>N° {ref}</Text>
            <Text style={s.invoiceRef}>Date : {dateDoc}</Text>
          </View>
        </View>

        {/* ── Client ── */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Émetteur</Text>
            <Text style={s.value}>{shop.name ?? 'RepairFlow'}</Text>
            {shop.address && <Text style={s.value}>{shop.address}</Text>}
            {shop.phone   && <Text style={s.value}>{shop.phone}</Text>}
          </View>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Client</Text>
            <Text style={s.value}>{clientName}</Text>
            {client?.phone && <Text style={s.value}>{client.phone}</Text>}
            {client?.email && <Text style={s.value}>{client.email}</Text>}
          </View>
        </View>

        {/* ── Tableau des prestations ── */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.colDesc]}>Désignation</Text>
            <Text style={[s.tableHeaderText, s.colQty]}>Qté</Text>
            <Text style={[s.tableHeaderText, s.colPU]}>P.U. HT</Text>
            <Text style={[s.tableHeaderText, s.colTotal]}>Total HT</Text>
          </View>

          {/* Lignes */}
          {lines.map((line, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <Text style={[s.tableCell, s.colDesc]}>{line.desc}</Text>
              <Text style={[s.tableCell, s.colQty]}>{line.qty}</Text>
              <Text style={[s.tableCell, s.colPU]}>{fmtEur(line.pu)}</Text>
              <Text style={[s.tableCell, s.colTotal]}>{fmtEur(line.total)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totaux ── */}
        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Sous-total HT</Text>
            <Text style={s.totalValue}>{fmtEur(totalHT)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TVA 20 %</Text>
            <Text style={s.totalValue}>{fmtEur(tva)}</Text>
          </View>
          <View style={s.totalTTCRow}>
            <Text style={s.totalTTCLabel}>Total TTC</Text>
            <Text style={s.totalTTCValue}>{fmtEur(totalTTC)}</Text>
          </View>

          {qrEligible && (
            <>
              <View style={s.deductionRow}>
                <Text style={s.deductionLabel}>Bonus QualiRépar</Text>
                <Text style={s.deductionValue}>- {fmtEur(ticket.qr_montant)}</Text>
              </View>
              <View style={s.netRow}>
                <Text style={s.netLabel}>Net à payer</Text>
                <Text style={s.netValue}>{fmtEur(netApres)}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Mention QualiRépar ── */}
        {qrEligible && (
          <Text style={s.qrMention}>
            Bonus Réparation déduit conformément au dispositif prévu par la loi AGEC.
            Éco-organisme : {ticket.qr_eco_org ?? 'Non renseigné'}.
          </Text>
        )}

        {/* ── Pied de page ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Merci de votre confiance — {shop.name ?? 'RepairFlow'}
          </Text>
          <Text style={s.footerText}>
            repairflow-app.vercel.app/suivi/{ticket.tracking_token}
          </Text>
        </View>

      </Page>
    </Document>
  )
}

'use client'

import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    padding: 28,
    fontSize: 10,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // En-tête atelier
  header: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  logo:     { width: 56, height: 56, borderRadius: 10, marginBottom: 6 },
  shopName: { fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 3 },
  shopInfo: { fontSize: 8, color: '#6b7280', textAlign: 'center', lineHeight: 1.5 },

  // Titre bon de dépôt
  titleBox: {
    backgroundColor: '#F59E0B', borderRadius: 6,
    padding: '8 12', alignItems: 'center', marginBottom: 12,
  },
  titleText: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000', letterSpacing: 1 },
  refText:   { fontSize: 9, color: '#1a1a1a', marginTop: 2 },

  // Badge statut
  badge:     { borderRadius: 4, padding: '3 10', alignSelf: 'flex-start', marginBottom: 12 },
  badgeText: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Sections
  section:      { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', borderStyle: 'dashed' },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#9ca3af', marginBottom: 5 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rowLabel:     { fontSize: 9, color: '#6b7280', flex: 1 },
  rowValue:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827', flex: 2, textAlign: 'right' },

  // Bloc appareil
  deviceBox:  { backgroundColor: '#f9fafb', borderRadius: 6, padding: '8 10', marginBottom: 10 },
  deviceName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  deviceIssue:{ fontSize: 9, color: '#374151', lineHeight: 1.5 },

  // Prix
  priceBox:   { backgroundColor: '#fff7ed', borderRadius: 6, padding: '8 10', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 9, color: '#92400e' },
  priceValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#F59E0B' },

  // QR code
  qrSection: { alignItems: 'center', paddingTop: 10, marginBottom: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', borderStyle: 'dashed' },
  qrLabel:   { fontSize: 8, color: '#6b7280', textAlign: 'center', marginBottom: 6 },
  qrImage:   { width: 80, height: 80 },
  qrUrl:     { fontSize: 7, color: '#9ca3af', textAlign: 'center', marginTop: 4 },

  // Footer
  footer:      { alignItems: 'center', marginTop: 8 },
  footerMerci: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 4 },
  footerText:  { fontSize: 8, color: '#6b7280', textAlign: 'center', lineHeight: 1.6 },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_MAP = {
  pending:   { label: 'En attente',    bg: '#FFF7ED', color: '#F59E0B' },
  in_repair: { label: 'En réparation', bg: '#EFF6FF', color: '#4F8EF7' },
  ready:     { label: '✓ Prêt',        bg: '#F0FDF4', color: '#10B981' },
  delivered: { label: 'Livré',         bg: '#F9FAFB', color: '#6B7280' },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(n) {
  return Number(n).toFixed(2).replace('.', ',') + ' €'
}

// ---------------------------------------------------------------------------
// Composant PDF bon de dépôt
// @param {{ ticket: object, shop: object, qrCodeDataUrl: string }} props
// ---------------------------------------------------------------------------

/**
 * PDF bon de dépôt client pour un ticket de réparation.
 * @param {{ ticket: object, shop: object, qrCodeDataUrl: string }} props
 */
export function TicketReceiptPDF({ ticket, shop, qrCodeDataUrl }) {
  // Données client — gère les deux champs first_name/last_name et full_name
  const client     = ticket?.clients ?? {}
  const shopData   = shop ?? ticket?.shops ?? {}
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
    || client.full_name
    || 'Client inconnu'

  const ref    = `RF-${(ticket?.id ?? '').slice(0, 8).toUpperCase()}`
  const status = STATUS_MAP[ticket?.status] ?? { label: ticket?.status ?? '—', bg: '#F9FAFB', color: '#6B7280' }

  // Description panne — gère les deux colonnes
  const issueTxt = ticket?.issue_description ?? ticket?.issue_desc ?? '—'

  // Prix — priorité price_final > repair_cost
  const price  = ticket?.price_final ?? ticket?.repair_cost ?? null
  const devis  = ticket?.price_estimate ?? null
  const depot  = Number(ticket?.deposit_amount ?? 0)
  const reste  = price != null ? Number(price) - depot : null

  // URL de suivi
  const trackingUrl = ticket?.tracking_token
    ? `repairflow-app.vercel.app/suivi/${ticket.tracking_token}`
    : ''

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* En-tête */}
        <View style={S.header}>
          {shopData.logo_url
            ? <Image src={shopData.logo_url} style={S.logo} />
            : null
          }
          <Text style={S.shopName}>{shopData.name ?? 'Mon Atelier'}</Text>
          <Text style={S.shopInfo}>
            {[shopData.address, shopData.phone, shopData.email].filter(Boolean).join('  ·  ')}
          </Text>
        </View>

        {/* Titre */}
        <View style={S.titleBox}>
          <Text style={S.titleText}>BON DE DÉPÔT</Text>
          <Text style={S.refText}>N° {ref}</Text>
        </View>

        {/* Statut */}
        <View style={[S.badge, { backgroundColor: status.bg }]}>
          <Text style={[S.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>

        {/* Client */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>CLIENT</Text>
          <View style={S.row}>
            <Text style={S.rowLabel}>Nom</Text>
            <Text style={S.rowValue}>{clientName}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.rowLabel}>Téléphone</Text>
            <Text style={S.rowValue}>{client.phone ?? '—'}</Text>
          </View>
          {client.email && (
            <View style={S.row}>
              <Text style={S.rowLabel}>Email</Text>
              <Text style={[S.rowValue, { fontSize: 8 }]}>{client.email}</Text>
            </View>
          )}
        </View>

        {/* Appareil */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>APPAREIL</Text>
          <View style={S.deviceBox}>
            <Text style={S.deviceName}>
              {[ticket?.device_brand, ticket?.device_model].filter(Boolean).join(' ') || ticket?.device_type || '—'}
            </Text>
            <Text style={S.deviceIssue}>Panne déclarée : {issueTxt}</Text>
            {ticket?.diagnosis && (
              <Text style={[S.deviceIssue, { color: '#4F8EF7', marginTop: 4 }]}>
                Diagnostic : {ticket.diagnosis}
              </Text>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>DATES</Text>
          <View style={S.row}>
            <Text style={S.rowLabel}>Date de dépôt</Text>
            <Text style={S.rowValue}>{fmtDate(ticket?.received_at ?? ticket?.created_at)}</Text>
          </View>
          {ticket?.estimated_ready_at && (
            <View style={S.row}>
              <Text style={S.rowLabel}>Prêt estimé le</Text>
              <Text style={[S.rowValue, { color: '#10B981' }]}>{fmtDate(ticket.estimated_ready_at)}</Text>
            </View>
          )}
        </View>

        {/* Prix */}
        {(price != null || devis != null) && (
          <View style={S.section}>
            <Text style={S.sectionLabel}>TARIF</Text>
            <View style={S.priceBox}>
              <Text style={S.priceLabel}>{price != null ? 'Prix final TTC' : 'Devis estimé TTC'}</Text>
              <Text style={S.priceValue}>{fmtPrice(price ?? devis ?? 0)}</Text>
            </View>
            {depot > 0 && (
              <>
                <View style={S.row}>
                  <Text style={S.rowLabel}>Acompte versé</Text>
                  <Text style={S.rowValue}>{fmtPrice(depot)}</Text>
                </View>
                <View style={S.row}>
                  <Text style={[S.rowLabel, { fontFamily: 'Helvetica-Bold' }]}>Reste à payer</Text>
                  <Text style={[S.rowValue, { color: '#F59E0B' }]}>{fmtPrice(reste ?? 0)}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* QR code */}
        <View style={S.qrSection}>
          <Text style={S.qrLabel}>Scannez pour suivre votre réparation en temps réel</Text>
          {qrCodeDataUrl ? <Image src={qrCodeDataUrl} style={S.qrImage} /> : null}
          <Text style={S.qrUrl}>{trackingUrl}</Text>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerMerci}>Merci de votre confiance !</Text>
          <Text style={S.footerText}>
            {'Conservez ce bon de dépôt.\n'}
            {'Vous serez notifié par SMS dès que votre appareil sera prêt.\n'}
            {shopData.phone ?? ''}
          </Text>
        </View>

      </Page>
    </Document>
  )
}

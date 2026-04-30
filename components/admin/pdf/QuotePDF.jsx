// Importé dynamiquement côté client uniquement — ne pas importer directement dans un Server Component
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const c = {
  dark:   '#111827',
  mid:    '#374151',
  light:  '#6B7280',
  border: '#E5E7EB',
  amber:  '#F59E0B',
  bg:     '#FFFBEB',
}

const s = StyleSheet.create({
  page:       { fontSize: 9, fontFamily: 'Helvetica', padding: '36 40', color: c.dark, backgroundColor: '#fff' },
  row:        { flexDirection: 'row' },
  flex1:      { flex: 1 },
  bold:       { fontFamily: 'Helvetica-Bold' },

  /* En-tête */
  header:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  shopName:   { fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.dark, marginBottom: 4 },
  docType:    { fontSize: 26, fontFamily: 'Helvetica-Bold', color: c.amber, letterSpacing: 2 },
  docNum:     { fontSize: 10, color: c.mid, marginTop: 4 },

  /* Bloc client */
  clientBox:  { backgroundColor: '#F9FAFB', padding: '10 12', borderRadius: 4, marginBottom: 20 },
  label:      { fontSize: 8, color: c.light, marginBottom: 3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Tableau lignes */
  tHead:      { flexDirection: 'row', backgroundColor: c.dark, padding: '5 8', marginBottom: 0 },
  tHeadText:  { color: '#fff', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  tRow:       { flexDirection: 'row', padding: '5 8', borderBottom: `1 solid ${c.border}` },
  tRowAlt:    { flexDirection: 'row', padding: '5 8', borderBottom: `1 solid ${c.border}`, backgroundColor: '#FAFAFA' },
  col3:       { flex: 3 },
  col1:       { flex: 1, textAlign: 'center' },
  col15:      { flex: 1.5, textAlign: 'right' },

  /* Totaux */
  totals:     { marginLeft: 'auto', width: 210, marginTop: 16 },
  totRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, paddingHorizontal: 6 },
  totFinal:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.amber, padding: '7 10', borderRadius: 4, marginTop: 6 },
  totFinalTxt:{ color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 11 },

  /* Pied */
  footer:     { position: 'absolute', bottom: 28, left: 40, right: 40, borderTop: `1 solid ${c.border}`, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: c.light, textAlign: 'center', lineHeight: 1.5 },
  mention:    { fontSize: 7.5, color: c.light, marginTop: 4, lineHeight: 1.5 },
})

function fmt(n) { return Number(n || 0).toFixed(2).replace('.', ',') + ' €' }
function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
}

/**
 * Template PDF pour un devis.
 * Importé dynamiquement : import('@/components/admin/pdf/QuotePDF')
 * @param {{ quote: object, lines: object[], shop: object, client: object }} props
 */
export default function QuotePDF({ quote = {}, lines = [], shop = {}, client = {} }) {
  const subtotal  = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const discount  = Number(quote.discount_amount || 0)
  const totalHT   = subtotal - discount
  const taxRate   = Number(quote.tax_rate || 20)
  const tva       = totalHT * taxRate / 100
  const totalTTC  = totalHT + tva

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── En-tête ── */}
        <View style={s.header}>
          <View>
            <Text style={s.shopName}>{shop.name || 'Atelier'}</Text>
            {shop.address && <Text style={{ color: c.light }}>{shop.address}</Text>}
            {shop.phone   && <Text style={{ color: c.light }}>{shop.phone}</Text>}
            {shop.email   && <Text style={{ color: c.light }}>{shop.email}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docType}>DEVIS</Text>
            <Text style={s.docNum}>{quote.quote_number || '—'}</Text>
            <Text style={{ color: c.light, marginTop: 6 }}>
              Émis le : {fmtDate(quote.created_at)}
            </Text>
            <Text style={{ color: c.amber, marginTop: 2 }}>
              Valable jusqu'au : {fmtDate(quote.valid_until)}
            </Text>
          </View>
        </View>

        {/* ── Infos client ── */}
        {client?.full_name && (
          <View style={s.clientBox}>
            <Text style={s.label}>Destinataire</Text>
            <Text style={[s.bold, { fontSize: 10 }]}>{client.full_name}</Text>
            {client.phone && <Text style={{ color: c.mid }}>{client.phone}</Text>}
            {client.email && <Text style={{ color: c.mid }}>{client.email}</Text>}
          </View>
        )}

        {/* ── Tableau des lignes ── */}
        <View style={s.tHead}>
          <Text style={[s.tHeadText, s.col3]}>Description</Text>
          <Text style={[s.tHeadText, s.col1]}>Qté</Text>
          <Text style={[s.tHeadText, s.col15]}>Prix unit. HT</Text>
          <Text style={[s.tHeadText, s.col15]}>Total HT</Text>
        </View>
        {lines.map((line, i) => {
          const lineTotal = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0)
          return (
            <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
              <Text style={s.col3}>{line.description || '—'}</Text>
              <Text style={s.col1}>{line.quantity}</Text>
              <Text style={s.col15}>{fmt(line.unit_price)}</Text>
              <Text style={s.col15}>{fmt(lineTotal)}</Text>
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
              <Text style={{ color: 'green' }}>-{fmt(discount)}</Text>
            </View>
          )}
          <View style={s.totRow}>
            <Text>TVA ({taxRate}%) :</Text>
            <Text>{fmt(tva)}</Text>
          </View>
          <View style={s.totFinal}>
            <Text style={s.totFinalTxt}>Total TTC :</Text>
            <Text style={s.totFinalTxt}>{fmt(totalTTC)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {quote.notes && (
          <View style={{ marginTop: 20 }}>
            <Text style={s.label}>Notes</Text>
            <Text style={{ color: c.mid, lineHeight: 1.5 }}>{quote.notes}</Text>
          </View>
        )}

        {/* ── Pied de page ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Ce devis est valable {quote.valid_until ? `jusqu'au ${fmtDate(quote.valid_until)}` : '30 jours'}.
            {' '}Sans engagement jusqu'à acceptation écrite par le client.
          </Text>
          {shop.name && (
            <Text style={s.mention}>
              {shop.name}{shop.address ? ` · ${shop.address}` : ''}{shop.phone ? ` · ${shop.phone}` : ''}
            </Text>
          )}
        </View>

      </Page>
    </Document>
  )
}

'use client'

import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111827',
    backgroundColor: '#ffffff',
    padding: '20 24',
  },

  // En-tête
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderStyle: 'solid',
  },
  shopName:    { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  shopInfo:    { fontSize: 7, color: '#6b7280', lineHeight: 1.5 },
  qrLabel:     { fontSize: 8, color: '#F59E0B', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  qrSubLabel:  { fontSize: 7, color: '#9ca3af', textAlign: 'right' },

  // Titre couverture
  titleBox: {
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    padding: '10 14',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleText:   { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000', letterSpacing: 1 },
  titleSub:    { fontSize: 9, color: '#1a1a1a', marginTop: 3 },

  // Badge éligibilité
  badgeEligible:    { backgroundColor: '#F0FDF4', borderRadius: 6, padding: '6 12', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0', borderStyle: 'solid' },
  badgeNotEligible: { backgroundColor: '#FFF7ED', borderRadius: 6, padding: '6 12', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa', borderStyle: 'solid' },
  badgeText: { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  // Score global
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: '8 12',
    marginBottom: 12,
    gap: 10,
  },
  scoreBig:  { fontSize: 32, fontFamily: 'Helvetica-Bold' },
  scoreLabel:{ fontSize: 8, color: '#6b7280', marginBottom: 2 },

  // Section
  section:      { marginBottom: 10 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase' },
  divider:      { borderBottomWidth: 1, borderBottomColor: '#f3f4f6', borderStyle: 'dashed', marginBottom: 8 },

  // Tableau
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: '4 6', borderRadius: 3, marginBottom: 2 },
  tableRow:    { flexDirection: 'row', padding: '4 6', borderBottomWidth: 1, borderBottomColor: '#f9fafb', borderStyle: 'solid' },
  col1: { flex: 3, fontSize: 8 },
  col2: { flex: 1, fontSize: 8, textAlign: 'center' },
  col3: { flex: 2, fontSize: 8, color: '#6b7280' },
  col4: { flex: 1, fontSize: 7, color: '#9ca3af', textAlign: 'right' },
  th:   { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#6b7280' },

  // Stats
  statsRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  statsLabel: { fontSize: 8, color: '#6b7280' },
  statsValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },

  // Barre de score catégorie
  catRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  catLabel:  { fontSize: 8, color: '#374151', width: 80 },
  catBarBg:  { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, marginHorizontal: 6 },
  catBarFill:{ height: 6, borderRadius: 3 },
  catScore:  { fontSize: 8, fontFamily: 'Helvetica-Bold', width: 30, textAlign: 'right' },

  // Footer
  footer: { position: 'absolute', bottom: 16, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_FR = {
  conforme:     'Conforme ✓',
  non_conforme: 'Non conforme',
  en_cours:     'En cours',
  non_verifie:  'À vérifier',
}

const STATUS_COLOR = {
  conforme:     '#10B981',
  non_conforme: '#EF4444',
  en_cours:     '#F59E0B',
  non_verifie:  '#9ca3af',
}

const CAT_LABELS = {
  formation:    '🎓 Formation',
  materiel:     '🔧 Matériel',
  qualite:      '⭐ Qualité',
  transparence: '📋 Transparence',
  environnement:'♻️ Environnement',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtPeriod(start, end) {
  return `${fmtDate(start)} au ${fmtDate(end)}`
}

function scoreColor(v) {
  const n = Number(v ?? 0)
  if (n >= 80) return '#10B981'
  if (n >= 60) return '#F59E0B'
  return '#EF4444'
}

function Footer({ shopName }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>Généré par ReparFlow — repairflow-app.vercel.app</Text>
      <Text style={S.footerText}>{shopName} — {fmtDate(new Date().toISOString())}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Composant principal du PDF
// @param {{ report, shop, criteria, compliance }} props
// ---------------------------------------------------------------------------

/**
 * PDF rapport officiel de conformité QualiRépar.
 * @param {{ report: object, shop: object, criteria: object[], compliance: object[] }} props
 */
export function ReportPDF({ report, shop, criteria, compliance }) {
  const score = Number(report?.score_total ?? 0)
  const eligible = score >= 80
  const compMap = Object.fromEntries((compliance ?? []).map(c => [c.criteria_id, c]))

  // Groupement critères par catégorie
  const categories = ['formation', 'materiel', 'qualite', 'transparence', 'environnement']
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = (criteria ?? []).filter(c => c.category === cat)
    return acc
  }, {})

  const scoreField = {
    formation:    report?.score_formation,
    materiel:     report?.score_materiel,
    qualite:      report?.score_qualite,
    transparence: report?.score_transparence,
    environnement:report?.score_environnement,
  }

  return (
    <Document>

      {/* ── PAGE 1 : Couverture ── */}
      <Page size="A4" style={S.page}>

        {/* En-tête atelier */}
        <View style={S.header}>
          <View>
            <Text style={S.shopName}>{shop?.name ?? 'Mon Atelier'}</Text>
            <Text style={S.shopInfo}>
              {[shop?.address, shop?.phone, shop?.email, shop?.siret ? `SIRET: ${shop.siret}` : null]
                .filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <View>
            <Text style={S.qrLabel}>QUALIREPAR</Text>
            <Text style={S.qrSubLabel}>Label qualité réparation</Text>
          </View>
        </View>

        {/* Titre */}
        <View style={S.titleBox}>
          <Text style={S.titleText}>RAPPORT DE CONFORMITÉ QUALIREPAR</Text>
          <Text style={S.titleSub}>
            {report?.report_type === 'annual'    ? 'Rapport annuel'
            : report?.report_type === 'quarterly' ? 'Bilan trimestriel'
            : report?.report_type === 'audit'     ? 'Rapport d\'audit'
            : 'Dossier de renouvellement'}
            {' — '}Période : {fmtPeriod(report?.period_start, report?.period_end)}
          </Text>
        </View>

        {/* Badge éligibilité */}
        <View style={eligible ? S.badgeEligible : S.badgeNotEligible}>
          <Text style={[S.badgeText, { color: eligible ? '#166534' : '#9a3412' }]}>
            {eligible ? '✅  ÉLIGIBLE AU LABEL QUALIREPAR' : '⚠️  NON ÉLIGIBLE — CRITÈRES MANQUANTS'}
          </Text>
        </View>

        {/* Score global */}
        <View style={S.scoreBox}>
          <Text style={[S.scoreBig, { color: scoreColor(score) }]}>{score}</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.scoreLabel}>Score global de conformité /100</Text>
            {categories.map(cat => {
              const s = Number(scoreField[cat] ?? 0)
              return (
                <View key={cat} style={S.catRow}>
                  <Text style={S.catLabel}>{CAT_LABELS[cat]}</Text>
                  <View style={S.catBarBg}>
                    <View style={[S.catBarFill, { width: `${s}%`, backgroundColor: scoreColor(s) }]} />
                  </View>
                  <Text style={[S.catScore, { color: scoreColor(s) }]}>{s}%</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Stats réparations */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Statistiques réparations</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { label: 'Total réparations',    value: report?.nb_tickets_total ?? 0 },
              { label: 'Éligibles QualiRépar', value: report?.nb_eligibles ?? 0 },
              { label: 'Dossiers soumis',      value: report?.nb_soumis ?? 0 },
              { label: 'Montant total bonus',  value: `${Number(report?.montant_total_qr ?? 0).toFixed(2)} €` },
              { label: 'Taux de succès',       value: `${report?.taux_succes_repair ?? 0}%` },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: '#f9fafb', borderRadius: 4, padding: '5 6' }}>
                <Text style={{ fontSize: 7, color: '#6b7280', marginBottom: 2 }}>{s.label}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' }}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer shopName={shop?.name} />
      </Page>

      {/* ── PAGE 2 : Détail des critères ── */}
      <Page size="A4" style={S.page}>
        <Text style={[S.sectionTitle, { marginBottom: 10, fontSize: 11 }]}>Détail des critères de conformité</Text>

        {categories.map(cat => (
          <View key={cat} style={S.section} wrap={false}>
            <Text style={S.sectionTitle}>{CAT_LABELS[cat]}</Text>
            <View style={S.divider} />

            {/* En-tête tableau */}
            <View style={S.tableHeader}>
              <Text style={[S.col1, S.th]}>Critère</Text>
              <Text style={[S.col2, S.th]}>Statut</Text>
              <Text style={[S.col3, S.th]}>Justificatif</Text>
              <Text style={[S.col4, S.th]}>Vérifié le</Text>
            </View>

            {(grouped[cat] ?? []).map(c => {
              const comp = compMap[c.id]
              const st   = comp?.status ?? 'non_verifie'
              return (
                <View key={c.id} style={S.tableRow}>
                  <View style={S.col1}>
                    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{c.label}</Text>
                    {c.mandatory && <Text style={{ fontSize: 6, color: '#EF4444' }}>* obligatoire</Text>}
                  </View>
                  <Text style={[S.col2, { color: STATUS_COLOR[st], fontFamily: 'Helvetica-Bold' }]}>
                    {STATUS_FR[st]}
                  </Text>
                  <Text style={S.col3}>{comp?.evidence ?? '—'}</Text>
                  <Text style={S.col4}>{fmtDate(comp?.verified_at)}</Text>
                </View>
              )
            })}
          </View>
        ))}

        <Footer shopName={shop?.name} />
      </Page>

    </Document>
  )
}

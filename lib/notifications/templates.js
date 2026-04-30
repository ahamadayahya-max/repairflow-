/**
 * Templates de notifications SMS et Email HTML pour RepairFlow.
 *
 * Chaque entrée expose :
 *   - sms(vars)          → string (max 160 chars, GSM-7 safe)
 *   - emailSubject(vars) → string
 *   - emailHtml(vars)    → string (HTML complet, compatible Outlook 2016+)
 *
 * @typedef {Object} NotifVars
 * @property {string}  client_name      - Prénom ou nom complet du client
 * @property {string}  device_type      - Type d'appareil (ex : "smartphone")
 * @property {string}  device_brand     - Marque (ex : "Samsung")
 * @property {string}  device_model     - Modèle (ex : "Galaxy S23")
 * @property {string}  device_label     - Brand + model concaténés
 * @property {string}  tracking_url     - URL de suivi public
 * @property {string}  [price_estimate] - Devis estimé (ex : "89.00")
 * @property {string}  [price_final]    - Prix final (ex : "89.00")
 * @property {string}  [estimated_date] - Date estimée (ex : "jeudi 15 mai")
 * @property {string}  shop_name        - Nom de l'atelier
 * @property {string}  shop_phone       - Téléphone de l'atelier
 * @property {string}  shop_address     - Adresse physique
 * @property {string}  shop_hours       - Horaires d'ouverture
 * @property {string}  [review_url]     - Lien vers la page d'avis Google
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de style (centralisées pour cohérence)
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  primary:   '#2563EB',
  text:      '#374151',
  muted:     '#6B7280',
  footer:    '#9CA3AF',
  bodyBg:    '#F5F5F5',
  emailBg:   '#FFFFFF',
  footerBg:  '#F9FAFB',
  border:    '#E5E7EB',
  success:   '#16A34A',
  successBg: '#F0FDF4',
  warning:   '#D97706',
  warningBg: '#FFFBEB',
};

// ─────────────────────────────────────────────────────────────────────────────
// Enveloppe HTML commune — compatible Outlook 2016+
// Toute la structure table-based est ici ; les templates n'injectent que le
// contenu spécifique (bodyHtml) et le CTA optionnel.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {Object} p
 * @param {string}   p.preheader  - Texte de prévisualisation (invisible dans le corps)
 * @param {string}   p.headline   - Titre principal de l'email
 * @param {string}   p.bodyHtml   - Corps HTML spécifique au statut
 * @param {string}   [p.ctaText]  - Texte du bouton CTA
 * @param {string}   [p.ctaUrl]   - URL du bouton CTA
 * @param {NotifVars} p.vars      - Variables disponibles (pour le footer)
 * @returns {string}
 */
function buildEmail({ preheader = '', headline, bodyHtml, ctaText = '', ctaUrl = '', vars }) {
  const { shop_name, shop_phone, shop_address, shop_hours } = vars;

  // Bouton CTA avec fallback VML pour Outlook
  const ctaBlock = ctaText && ctaUrl ? `
        <!-- BOUTON CTA -->
        <tr>
          <td align="center" style="padding: 32px 40px 0;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                         xmlns:w="urn:schemas-microsoft-com:office:word"
                         href="${ctaUrl}"
                         style="height:48px;v-text-anchor:middle;width:260px;"
                         arcsize="12%" stroke="f" fillcolor="${S.primary}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">
                ${ctaText}
              </center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${ctaUrl}"
               style="display:inline-block;background-color:${S.primary};color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:12px 32px;border-radius:6px;mso-hide:all;">
              ${ctaText}
            </a>
            <!--<![endif]-->
          </td>
        </tr>` : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="fr"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${headline}</title>
  <!--[if mso]>
  <noscript><xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, #bodyTable { margin: 0; padding: 0; width: 100%; background-color: ${S.bodyBg}; }
    img              { border: 0; outline: none; text-decoration: none; display: block; }
    a                { color: ${S.primary}; }
    table            { border-collapse: collapse; border-spacing: 0; }
    /* Responsive */
    @media only screen and (max-width: 620px) {
      #emailContainer { width: 100% !important; border-radius: 0 !important; }
      .ep             { padding: 24px 20px !important; }
      .ep-t           { padding-top: 28px !important; }
    }
  </style>
</head>
<body>

<!-- Texte de prévisualisation masqué -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table id="bodyTable" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:${S.bodyBg};padding:32px 0;">
  <tr>
    <td align="center" valign="top">

      <!-- Conteneur principal 600px -->
      <table id="emailContainer" width="600" cellpadding="0" cellspacing="0" border="0"
             style="background-color:${S.emailBg};border-radius:8px;overflow:hidden;">

        <!-- ═══ EN-TÊTE LOGO ═══ -->
        <tr>
          <td style="background-color:${S.primary};padding:22px 40px;text-align:center;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;
                         color:#ffffff;letter-spacing:0.5px;mso-line-height-rule:exactly;">
              RepairFlow
            </span>
          </td>
        </tr>

        <!-- ═══ TITRE ═══ -->
        <tr>
          <td class="ep ep-t" style="padding:36px 40px 0;">
            <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;
                       font-weight:bold;color:${S.text};line-height:1.3;mso-line-height-rule:exactly;">
              ${headline}
            </h1>
          </td>
        </tr>

        <!-- ═══ CORPS ═══ -->
        <tr>
          <td class="ep" style="padding:20px 40px 0;font-family:Arial,Helvetica,sans-serif;
                                font-size:16px;color:${S.text};line-height:1.6;mso-line-height-rule:exactly;">
            ${bodyHtml}
          </td>
        </tr>

        ${ctaBlock}

        <!-- ═══ SÉPARATEUR ═══ -->
        <tr>
          <td style="padding:36px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-top:1px solid ${S.border};font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td class="ep" style="background-color:${S.footerBg};padding:24px 40px 28px;
                                border-radius:0 0 8px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
                           color:${S.footer};line-height:1.6;mso-line-height-rule:exactly;">
                  <strong style="color:${S.muted};">${shop_name}</strong><br>
                  ${shop_address}<br>
                  ${shop_phone}&nbsp;&nbsp;·&nbsp;&nbsp;${shop_hours}<br>
                  <br>
                  Cet email a été envoyé par <strong style="color:${S.muted};">${shop_name}</strong>
                  via RepairFlow.<br>
                  Pour toute question, contactez-nous directement au ${shop_phone}.
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /emailContainer -->

    </td>
  </tr>
</table>
<!-- /bodyTable -->

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc réutilisable : carte d'informations (appareil + valeur)
// ─────────────────────────────────────────────────────────────────────────────
function infoCard(rows) {
  const rowsHtml = rows.map(({ label, value, valueStyle = '' }, i) => `
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:14px;color:${S.muted};
                           padding-top:${i > 0 ? '12px' : '0'};${i > 0 ? `border-top:1px solid ${S.border};` : ''}
                           padding-bottom:4px;">
                  ${label}
                </td>
                <td style="font-family:Arial,sans-serif;font-size:${valueStyle ? '20px' : '14px'};
                           color:${valueStyle || S.text};font-weight:bold;text-align:right;
                           padding-top:${i > 0 ? '12px' : '0'};${i > 0 ? `border-top:1px solid ${S.border};` : ''}
                           padding-bottom:4px;">
                  ${value}
                </td>
              </tr>`).join('');

  return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${S.footerBg};border:1px solid ${S.border};
                      border-radius:8px;margin:20px 0 0;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rowsHtml}
              </table>
            </td>
          </tr>
        </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc réutilisable : encart coloré (succès / attention / info)
// ─────────────────────────────────────────────────────────────────────────────
function callout({ bg, borderColor, textColor = S.text, icon = '', text }) {
  return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${bg};border-left:4px solid ${borderColor};
                      border-radius:0 6px 6px 0;margin:20px 0 0;">
          <tr>
            <td style="padding:14px 18px;font-family:Arial,sans-serif;font-size:15px;
                       color:${textColor};line-height:1.5;mso-line-height-rule:exactly;">
              ${icon ? `<strong>${icon}</strong>&nbsp;&nbsp;` : ''}${text}
            </td>
          </tr>
        </table>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES PAR STATUT
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_TEMPLATES = {

  // ───────────────────────────────────────────────────────────────────────────
  // 1. RECEIVED — Confirmation de réception
  // ───────────────────────────────────────────────────────────────────────────
  received: {
    /**
     * SMS : confirmation de réception + lien de suivi.
     * Aucun accent problématique, URL en dernier.
     */
    sms: (v) =>
      `Bonjour ${v.client_name}, votre ${v.device_label} a bien ete recu par ${v.shop_name}. Suivez votre reparation : ${v.tracking_url}`,

    emailSubject: (v) =>
      `Votre ${v.device_label} est bien arrivé chez ${v.shop_name}`,

    emailHtml: (v) => buildEmail({
      preheader: `Votre ${v.device_label} a bien été reçu. Suivez l'avancement en temps réel, sans compte.`,
      headline:  `Votre appareil est bien arrivé !`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 16px;">Nous avons bien reçu votre <strong>${v.device_label}</strong>
               dans notre atelier. Votre dossier de réparation est ouvert — nous vous tiendrons
               informé(e) à chaque étape.</p>
            <p style="margin:0 0 0;">Suivez l'avancement de votre réparation à tout moment,
               sans avoir besoin de créer un compte :</p>
            ${callout({
              bg: '#EFF6FF', borderColor: S.primary, textColor: '#1E40AF',
              icon: '🔗',
              text: `<a href="${v.tracking_url}"
                        style="color:${S.primary};font-weight:bold;word-break:break-all;
                               text-decoration:none;">${v.tracking_url}</a>`,
            })}
            <p style="margin:16px 0 0;">N'hésitez pas à nous contacter si vous avez
               des questions. À très vite !</p>`,
      ctaText: 'Suivre ma réparation',
      ctaUrl:  v.tracking_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DIAGNOSED — Diagnostic terminé, devis à valider
  // ───────────────────────────────────────────────────────────────────────────
  diagnosed: {
    sms: (v) =>
      `Bonjour ${v.client_name}, diagnostic de votre ${v.device_label} termine. Devis : ${v.price_estimate}EUR. Votre accord est requis : ${v.tracking_url}`,

    emailSubject: (v) =>
      `Diagnostic terminé — Votre accord est requis (devis : ${v.price_estimate} €)`,

    emailHtml: (v) => buildEmail({
      preheader: `Le diagnostic de votre ${v.device_label} est terminé. Montant estimé : ${v.price_estimate} €. Votre validation est attendue.`,
      headline:  `Diagnostic terminé — Votre avis est requis`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 20px;">Notre technicien a diagnostiqué votre
               <strong>${v.device_label}</strong>. Voici le résultat :</p>
            ${infoCard([
              { label: 'Appareil',       value: v.device_label },
              { label: 'Devis estimé',   value: `${v.price_estimate} €`, valueStyle: S.primary },
            ])}
            ${callout({
              bg: '#FFFBEB', borderColor: '#F59E0B', textColor: '#92400E',
              icon: '⚠️',
              text: `Sans réponse de votre part sous <strong>48 heures</strong>,
                     votre dossier sera mis en attente.`,
            })}
            <p style="margin:20px 0 0;">Vous pouvez <strong>valider ou refuser</strong> en un clic
               depuis votre espace de suivi. Si vous avez des questions sur le diagnostic,
               appelez-nous au <strong>${v.shop_phone}</strong>.</p>`,
      ctaText: 'Valider la réparation',
      ctaUrl:  v.tracking_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 3. WAITING_APPROVAL — Relance bienveillante J+2
  // ───────────────────────────────────────────────────────────────────────────
  waiting_approval: {
    sms: (v) =>
      `Rappel ${v.shop_name} : votre devis pour ${v.device_label} (${v.price_estimate}EUR) attend votre reponse. Repondez : ${v.tracking_url}`,

    emailSubject: (v) =>
      `Rappel — Votre devis de ${v.price_estimate} € attend toujours votre réponse`,

    emailHtml: (v) => buildEmail({
      preheader: `Petit rappel bienveillant : votre devis pour ${v.device_label} n'a pas encore reçu de réponse.`,
      headline:  `Votre devis attend votre réponse`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 20px;">Nous nous permettons de vous envoyer un petit rappel
               au sujet du devis pour votre <strong>${v.device_label}</strong>. Pas d'inquiétude,
               votre appareil est en sécurité chez nous !</p>
            ${infoCard([
              { label: 'Appareil',     value: v.device_label },
              { label: 'Montant devis', value: `${v.price_estimate} €`, valueStyle: S.warning },
            ])}
            <p style="margin:20px 0 16px;">Valider ou refuser ne prend que quelques secondes
               depuis votre espace de suivi.</p>
            <p style="margin:0;">Une question ? Notre équipe est disponible au
               <strong>${v.shop_phone}</strong> — nous sommes là pour vous aider.</p>`,
      ctaText: 'Voir mon devis',
      ctaUrl:  v.tracking_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 4. IN_REPAIR — Réparation en cours, aucune action requise
  // ───────────────────────────────────────────────────────────────────────────
  in_repair: {
    sms: (v) =>
      `Bonne nouvelle ${v.client_name} ! La reparation de votre ${v.device_label} est en cours. Aucune action requise. - ${v.shop_name}`,

    emailSubject: (v) =>
      `La réparation de votre ${v.device_label} est en cours`,

    emailHtml: (v) => buildEmail({
      preheader: `Votre ${v.device_label} est entre les mains de notre technicien. Aucune action requise de votre part.`,
      headline:  `Réparation en cours`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 20px;">Notre technicien a pris en charge votre
               <strong>${v.device_label}</strong> et la réparation est maintenant en cours.
               Votre appareil est entre de bonnes mains !</p>
            ${callout({
              bg: '#F0FDF4', borderColor: '#22C55E', textColor: '#166534',
              icon: '✓',
              text: 'Aucune action requise de votre part pour le moment.',
            })}
            <p style="margin:20px 0 16px;">Vous recevrez un message dès que votre appareil
               sera prêt à être récupéré. En attendant, vous pouvez suivre l'avancement
               de votre dossier :</p>
            <p style="margin:0;">
              <a href="${v.tracking_url}"
                 style="color:${S.primary};font-weight:bold;word-break:break-all;">
                ${v.tracking_url}
              </a>
            </p>`,
      ctaText: 'Suivre mon dossier',
      ctaUrl:  v.tracking_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 5. WAITING_PARTS — En attente d'une pièce, transparence sur le délai
  // ───────────────────────────────────────────────────────────────────────────
  waiting_parts: {
    sms: (v) =>
      `Bonjour ${v.client_name}, votre ${v.device_label} necessite une piece en commande. Date prevue : ${v.estimated_date}. Suivi : ${v.tracking_url}`,

    emailSubject: (v) =>
      `Votre réparation : en attente d'une pièce — livraison prévue le ${v.estimated_date}`,

    emailHtml: (v) => buildEmail({
      preheader: `La réparation de votre ${v.device_label} attend une pièce détachée. Date estimée : ${v.estimated_date}.`,
      headline:  `En attente d'une pièce détachée`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 16px;">Nous souhaitons vous tenir informé(e) de l'avancement
               de la réparation de votre <strong>${v.device_label}</strong>.</p>
            <p style="margin:0 0 20px;">La réparation nécessite une pièce détachée que nous
               avons commandée auprès de notre fournisseur. Nous mettons tout en œuvre pour
               vous rendre votre appareil dans les meilleurs délais.</p>
            ${infoCard([
              { label: 'Appareil',                    value: v.device_label },
              { label: 'Date de récupération estimée', value: v.estimated_date, valueStyle: S.primary },
            ])}
            <p style="margin:20px 0 0;">Vous serez contacté(e) dès que la pièce sera reçue
               et la réparation terminée. Pour toute question, appelez-nous au
               <strong>${v.shop_phone}</strong>. Merci de votre patience !</p>`,
      ctaText: 'Suivre mon dossier',
      ctaUrl:  v.tracking_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 6. READY — Appareil prêt, invitation à venir récupérer
  // ───────────────────────────────────────────────────────────────────────────
  ready: {
    sms: (v) =>
      `${v.client_name}, votre ${v.device_label} est repare et vous attend ! Montant : ${v.price_final}EUR. ${v.shop_address} - ${v.shop_name}`,

    emailSubject: (v) =>
      `Votre ${v.device_label} est prêt — Montant à régler : ${v.price_final} €`,

    emailHtml: (v) => buildEmail({
      preheader: `Excellente nouvelle ! Votre ${v.device_label} est réparé et vous attend à l'atelier.`,
      headline:  `Votre appareil est prêt !`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 20px;">Excellente nouvelle ! La réparation de votre
               <strong>${v.device_label}</strong> est terminée. Votre appareil vous attend
               à l'atelier.</p>

            <!-- Montant à régler -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${S.successBg};border:1px solid #BBF7D0;
                          border-radius:8px;margin:0 0 20px;">
              <tr>
                <td style="padding:18px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:Arial,sans-serif;font-size:14px;
                                 color:#166534;font-weight:bold;">
                        Montant à régler
                      </td>
                      <td style="font-family:Arial,sans-serif;font-size:26px;
                                 color:${S.success};font-weight:bold;text-align:right;">
                        ${v.price_final} €
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Informations pratiques -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${S.footerBg};border:1px solid ${S.border};
                          border-radius:8px;margin:0 0 20px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;
                             color:${S.muted};font-weight:bold;text-transform:uppercase;
                             letter-spacing:0.8px;">
                    Où nous trouver
                  </p>
                  <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:16px;
                             color:${S.text};font-weight:bold;">
                    ${v.shop_name}
                  </p>
                  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:14px;
                             color:${S.text};">
                    ${v.shop_address}
                  </p>
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;
                             color:${S.muted};">
                    ${v.shop_hours}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:${S.muted};">
              Paiement accepté par carte bancaire et en espèces.
            </p>`,
      ctaText: 'Voir les informations pratiques',
      ctaUrl:  v.tracking_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 7. DELIVERED — Récupération effectuée, demande d'avis
  // ───────────────────────────────────────────────────────────────────────────
  delivered: {
    sms: (v) =>
      `Merci ${v.client_name} pour votre confiance ! Un avis en 30 secondes nous aide enormement : ${v.review_url} - ${v.shop_name}`,

    emailSubject: (v) =>
      `Merci pour votre confiance, ${v.client_name} — Laissez-nous votre avis !`,

    emailHtml: (v) => buildEmail({
      preheader: `Merci d'avoir choisi ${v.shop_name} ! Votre avis compte vraiment pour nous.`,
      headline:  `Merci pour votre confiance !`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 20px;">Nous espérons que vous êtes pleinement satisfait(e)
               de la réparation de votre <strong>${v.device_label}</strong>.
               C'est toujours un plaisir de vous rendre service !</p>

            <!-- Bloc avis stars -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${S.footerBg};border:1px solid ${S.border};
                          border-radius:8px;margin:0 0 24px;text-align:center;">
              <tr>
                <td style="padding:28px 24px;">
                  <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:36px;
                             line-height:1;mso-line-height-rule:exactly;">
                    &#9733;&#9733;&#9733;&#9733;&#9733;
                  </p>
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;
                             color:${S.muted};line-height:1.5;mso-line-height-rule:exactly;">
                    Votre avis aide d'autres clients à nous trouver<br>
                    et motive toute notre équipe au quotidien.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 16px;">Cela ne prend que <strong>30 secondes</strong>
               et ça fait vraiment la différence pour un atelier comme le nôtre.
               Merci infiniment !</p>
            <p style="margin:0;color:${S.muted};font-size:14px;">
               Et si votre prochain appareil a besoin d'un coup de pouce,
               vous savez où nous trouver !
            </p>`,
      ctaText: 'Laisser un avis Google',
      ctaUrl:  v.review_url,
      vars: v,
    }),
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 8. CANCELLED — Dossier clôturé, invitation à revenir
  // ───────────────────────────────────────────────────────────────────────────
  cancelled: {
    sms: (v) =>
      `Bonjour ${v.client_name}, votre dossier de reparation a ete clos. Pour toute question : ${v.shop_phone}. A bientot ! - ${v.shop_name}`,

    emailSubject: (v) =>
      `Votre dossier de réparation a été clôturé — ${v.shop_name}`,

    emailHtml: (v) => buildEmail({
      preheader: `Votre dossier concernant votre ${v.device_label} a été clôturé. Nous restons disponibles.`,
      headline:  `Votre dossier a été clôturé`,
      bodyHtml: `
            <p style="margin:0 0 16px;">Bonjour <strong>${v.client_name}</strong>,</p>
            <p style="margin:0 0 16px;">Nous vous informons que votre dossier de réparation
               concernant votre <strong>${v.device_label}</strong> a bien été clôturé.</p>
            <p style="margin:0 0 20px;">Si cette clôture ne correspond pas à vos attentes
               ou si vous souhaitez obtenir plus d'informations, notre équipe est à votre
               entière disposition.</p>

            <!-- Contact atelier -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${S.footerBg};border:1px solid ${S.border};
                          border-radius:8px;margin:0 0 20px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;
                             color:${S.muted};font-weight:bold;text-transform:uppercase;
                             letter-spacing:0.8px;">
                    Nous contacter
                  </p>
                  <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:16px;
                             color:${S.text};font-weight:bold;">
                    ${v.shop_phone}
                  </p>
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;
                             color:${S.muted};">
                    ${v.shop_address}&nbsp;&nbsp;·&nbsp;&nbsp;${v.shop_hours}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;">Nous espérons avoir l'occasion de vous aider à nouveau
               prochainement. À bientôt !</p>`,
      vars: v,
    }),
  },

};

export default NOTIFICATION_TEMPLATES;

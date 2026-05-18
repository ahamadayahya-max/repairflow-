/**
 * Helper d'envoi d'email.
 * - En production (BREVO_API_KEY défini) : utilise l'API HTTP Brevo (port 443, compatible Vercel)
 * - En développement : utilise Mailpit via nodemailer (localhost:1025)
 *
 * Ne jamais appeler ce fichier depuis un Client Component.
 */

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email'

/**
 * Envoie un email via l'API HTTP Brevo (production) ou Mailpit (développement).
 * Les données personnelles du destinataire ne sont jamais loggées.
 *
 * @param {{
 *   to:       string,
 *   subject:  string,
 *   html:     string,
 *   text?:    string,
 *   from?:    string,
 *   fromName?: string,
 * }} options
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendEmail({ to, subject, html, text, from, fromName }) {
  const apiKey = process.env.BREVO_API_KEY

  // Production : API HTTP Brevo (évite les problèmes SMTP sur Vercel)
  if (apiKey) {
    return sendViaBrevoApi({ to, subject, html, text, from, fromName, apiKey })
  }

  // Développement local : Mailpit via nodemailer
  return sendViaMailpit({ to, subject, html, text, from, fromName })
}

// ---------------------------------------------------------------------------
// Envoi via API HTTP Brevo
// ---------------------------------------------------------------------------

async function sendViaBrevoApi({ to, subject, html, text, from, fromName, apiKey }) {
  const senderEmail = from ?? (process.env.MAIL_FROM_ADDRESS ?? 'ahamada.yahya@gmail.com')
  const senderName  = fromName ?? (process.env.MAIL_FROM_NAME ?? 'TickeeFlow')

  const body = {
    sender:   { name: senderName, email: senderEmail },
    to:       [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }

  try {
    const res = await fetch(BREVO_EMAIL_URL, {
      method:  'POST',
      headers: {
        'api-key':      apiKey,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('[sendEmail] Erreur API Brevo :', res.status, errData?.message)
      return { success: false, error: errData?.message ?? `HTTP ${res.status}` }
    }

    const data = await res.json()
    return { success: true, messageId: data?.messageId }
  } catch (err) {
    console.error('[sendEmail] Erreur réseau Brevo :', err.message)
    return { success: false, error: err.message }
  }
}

// ---------------------------------------------------------------------------
// Envoi via Mailpit (développement local uniquement)
// ---------------------------------------------------------------------------

async function sendViaMailpit({ to, subject, html, text, from, fromName }) {
  // Import dynamique — nodemailer n'est pas nécessaire en production
  const nodemailer = (await import('nodemailer')).default

  const transporter = nodemailer.createTransport({
    host:      process.env.MAILPIT_SMTP_HOST ?? 'localhost',
    port:      Number(process.env.MAILPIT_SMTP_PORT ?? 1025),
    secure:    false,
    ignoreTLS: true,
  })

  const fromAddress = from
    ? `"${fromName ?? 'TickeeFlow'}" <${from}>`
    : `"${process.env.MAIL_FROM_NAME ?? 'TickeeFlow'}" <${process.env.MAIL_FROM_ADDRESS ?? 'noreply@tickeeflow.local'}>`

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    console.error('[sendEmail] Erreur Mailpit :', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Vérifie que l'envoi d'email est correctement configuré.
 * @returns {Promise<boolean>}
 */
export async function verifyEmailConfig() {
  return !!(process.env.BREVO_API_KEY || process.env.MAILPIT_SMTP_HOST)
}

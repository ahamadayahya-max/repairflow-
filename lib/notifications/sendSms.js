/**
 * Helper d'envoi de SMS transactionnel via l'API Brevo.
 * Ne jamais appeler depuis un Client Component.
 *
 * Documentation Brevo : https://developers.brevo.com/reference/sendtransacsms
 */

const BREVO_SMS_URL = 'https://api.brevo.com/v3/transactionalSMS/sms'

/**
 * Normalise un numéro de téléphone au format E.164 (ex : 0612345678 → +33612345678).
 * Ne traite que les numéros français — adapter pour d'autres pays si besoin.
 *
 * @param {string} phone
 * @returns {string}
 */
function toE164(phone) {
  const digits = phone.replace(/\D/g, '')
  // Déjà en E.164
  if (digits.startsWith('33') && digits.length === 11) return `+${digits}`
  // Numéro français local (0XXXXXXXXX)
  if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`
  // Déjà préfixé + (ex : +33...)
  if (phone.startsWith('+')) return phone
  return `+${digits}`
}

/**
 * Envoie un SMS transactionnel via Brevo.
 * Les données personnelles du destinataire ne sont jamais loggées.
 *
 * @param {{
 *   to:      string,   — numéro du destinataire (format libre, normalisé en E.164)
 *   content: string,   — contenu du SMS (max 160 chars pour 1 crédit GSM-7)
 *   sender?: string,   — nom de l'expéditeur affiché (max 11 chars, sans espaces)
 * }} options
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendSms({ to, content, sender = 'RepairFlow' }) {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    console.error('[sendSms] BREVO_API_KEY manquant — SMS non envoyé')
    return { success: false, error: 'BREVO_API_KEY non configurée' }
  }

  const phoneE164 = toE164(to)

  try {
    const res = await fetch(BREVO_SMS_URL, {
      method: 'POST',
      headers: {
        'api-key':      apiKey,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: JSON.stringify({
        sender:    sender.slice(0, 11),
        recipient: phoneE164,
        content:   content.slice(0, 160),
        type:      'transactional',
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('[sendSms] Erreur Brevo :', res.status, errData?.message)

      // Erreur de crédits insuffisants — message explicite avec lien d'achat
      const msg = errData?.message ?? ''
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('insufficient') || res.status === 402) {
        return {
          success: false,
          error:   'Crédits SMS insuffisants sur votre compte Brevo. Achetez des crédits ici : https://app.sendinblue.com/billing/addon/customize/sms',
          noCredits: true,
        }
      }

      return { success: false, error: msg || `Erreur Brevo (HTTP ${res.status})` }
    }

    const data = await res.json()
    return { success: true, messageId: data?.messageId }
  } catch (err) {
    console.error('[sendSms] Erreur réseau :', err.message)
    return { success: false, error: err.message }
  }
}

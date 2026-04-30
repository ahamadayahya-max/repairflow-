import { createClient } from '@supabase/supabase-js'

// Client serveur avec service_role — nécessaire pour generateLink
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/auth/forgot-password
 * Génère un lien de récupération via Supabase Admin,
 * puis envoie l'email via Brevo (délivrabilité fiable).
 *
 * Retourne toujours { sent: true } pour ne pas révéler
 * si l'adresse email existe dans la base (anti-énumération).
 */
export async function POST(req) {
  let email = ''

  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return Response.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  if (!email) {
    return Response.json({ error: 'Email requis' }, { status: 400 })
  }

  try {
    // Génère un lien de récupération sécurisé via l'API admin Supabase
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://repairflow-app.vercel.app/reset-password',
      },
    })

    // Si l'email n'existe pas ou autre erreur — on sort silencieusement
    if (error || !data?.properties?.action_link) {
      return Response.json({ sent: true })
    }

    const resetLink = data.properties.action_link

    // Envoie l'email via l'API Brevo (transactionnel)
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key':      process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name:  'RepairFlow',
          email: process.env.BREVO_SMTP_USER ?? 'ahamada.yahya@gmail.com',
        },
        to: [{ email }],
        subject: 'Réinitialisez votre mot de passe RepairFlow',
        htmlContent: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F1A;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F1A;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">

        <!-- En-tête -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:rgba(245,158,11,0.2);border-radius:10px;text-align:center;vertical-align:middle;">
                  <span style="font-size:18px;">🔧</span>
                </td>
                <td style="padding-left:10px;">
                  <span style="color:#ffffff;font-size:18px;font-weight:bold;">RepairFlow</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:32px;">
            <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 8px 0;">
              Réinitialisation de mot de passe
            </h1>
            <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
              Vous avez demandé la réinitialisation de votre mot de passe.
              Cliquez sur le bouton ci-dessous pour en définir un nouveau.
            </p>

            <!-- Bouton -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
              <tr>
                <td style="background:#f59e0b;border-radius:10px;">
                  <a href="${resetLink}"
                     style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                    Réinitialiser mon mot de passe →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Avertissement -->
            <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;">
              Ce lien est valable <strong style="color:#9ca3af;">1 heure</strong>.
              Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre compte reste sécurisé.
            </p>
          </td>
        </tr>

        <!-- Pied -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="color:#374151;font-size:11px;margin:0;text-align:center;">
              RepairFlow — Gestion d'ateliers de réparation
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
        `,
      }),
    })

    // Log l'erreur Brevo côté serveur sans l'exposer au client
    if (!brevoRes.ok) {
      console.error('[forgot-password] Brevo error:', brevoRes.status, await brevoRes.text())
    }
  } catch (err) {
    // Erreur silencieuse — on ne révèle rien au client
    console.error('[forgot-password] Erreur:', err.message)
  }

  // Toujours 200 avec { sent: true } — anti-énumération
  return Response.json({ sent: true })
}

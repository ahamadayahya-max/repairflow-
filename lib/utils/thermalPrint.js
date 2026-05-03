import QRCode from 'qrcode'

// ---------------------------------------------------------------------------
// Correspondance statuts → libellés imprimante thermique
// ---------------------------------------------------------------------------

const STATUS_FR = {
  pending:   'EN ATTENTE',
  in_repair: 'EN REPARATION',
  ready:     '>>> PRET A RECUPERER <<<',
  delivered: 'LIVRE',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Fonction principale — ouvre une popup 48mm et déclenche l'impression
// ---------------------------------------------------------------------------

/**
 * Génère et imprime un ticket thermique 58mm (zone utile 48mm) pour un ticket de réparation.
 * Compatible Excelvan USB et toute imprimante thermique paramétrée en papier 58mm.
 * Nécessite que les popups soient autorisées dans le navigateur.
 *
 * @param {object} ticket         — objet ticket complet (avec .clients optionnel)
 * @param {object} [shopOverride] — données atelier si ticket.shops est absent
 */
export async function printThermalTicket(ticket, shopOverride = {}) {
  try {
    // Génère le QR code de suivi
    const trackingUrl = `https://repairflow-app.vercel.app/suivi/${ticket.tracking_token}`
    const qrDataUrl   = await QRCode.toDataURL(trackingUrl, { width: 120, margin: 0 })

    // Données dérivées
    const client     = ticket.clients ?? {}
    const shop       = ticket.shops ?? shopOverride
    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
                    || client.full_name
                    || 'Client'
    const ref        = `RF-${(ticket.id ?? '').slice(0, 8).toUpperCase()}`
    const issueTxt   = ticket.issue_description ?? ticket.issue_desc ?? '—'
    const price      = ticket.price_final ?? ticket.repair_cost ?? null
    const devis      = ticket.price_estimate ?? null
    const depot      = Number(ticket.deposit_amount ?? 0)
    const trackShort = `repairflow-app.vercel.app/suivi/${ticket.tracking_token}`
    const deviceName = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ')
                    || ticket.device_type || '—'

    // Ouvre la fenêtre popup dédiée à l'impression
    const pw = window.open('', '_blank', 'width=320,height=700,toolbar=0,menubar=0,location=0,status=0')
    if (!pw) {
      alert('Autorisez les popups dans votre navigateur pour imprimer.')
      return
    }

    // Injection du HTML thermique — largeur 48mm, police Courier (monospace imprimante)
    pw.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon depot ${ref}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: 48mm;
      padding: 2mm 1mm;
    }
    .c    { text-align: center; }
    .b    { font-weight: bold; }
    .lg   { font-size: 11pt; }
    .sm   { font-size: 7.5pt; }
    .row  { display: flex; justify-content: space-between; margin: 1px 0; }
    .sep  { margin: 3px 0; }
    .wrap { word-break: break-all; }
    img   { display: block; margin: 4px auto; }
    @page { size: 58mm auto; margin: 0; }
    @media print { body { width: 48mm; } }
  </style>
</head>
<body>

  <div class="c b lg">${shop.name ?? 'Mon Atelier'}</div>
  ${shop.address ? `<div class="c sm">${shop.address}</div>` : ''}
  ${shop.phone   ? `<div class="c sm">Tel: ${shop.phone}</div>` : ''}

  <div class="sep">================================</div>
  <div class="c b">*** BON DE DEPOT ***</div>
  <div class="c">N&#176; ${ref}</div>
  <div class="c sm">${fmtDate(ticket.received_at ?? ticket.created_at)}</div>

  <div class="sep">--------------------------------</div>
  <div class="b">CLIENT :</div>
  <div>${clientName}</div>
  <div>Tel: ${client.phone ?? '—'}</div>
  ${client.email ? `<div class="sm wrap">${client.email}</div>` : ''}

  <div class="sep">--------------------------------</div>
  <div class="b">APPAREIL :</div>
  <div class="b">${deviceName}</div>
  <div class="sm wrap">Panne: ${issueTxt}</div>
  ${ticket.diagnosis ? `<div class="sm wrap">Diagnostic: ${ticket.diagnosis}</div>` : ''}

  <div class="sep">--------------------------------</div>
  <div class="b">DATES :</div>
  <div class="sm">Depot: ${fmtDate(ticket.received_at ?? ticket.created_at)}</div>
  ${ticket.estimated_ready_at
    ? `<div class="sm">Pret le: ${fmtDate(ticket.estimated_ready_at)}</div>`
    : ''}

  <div class="sep">--------------------------------</div>
  <div class="c b">${STATUS_FR[ticket.status] ?? (ticket.status ?? '').toUpperCase()}</div>

  ${(price != null || devis != null) ? `
  <div class="sep">--------------------------------</div>
  <div class="b">TARIF :</div>
  <div class="row">
    <span>${price != null ? 'Prix final TTC' : 'Devis estime'}</span>
    <span class="b">${Number(price ?? devis ?? 0).toFixed(2)} EUR</span>
  </div>
  ${depot > 0 ? `
  <div class="row">
    <span>Acompte verse</span>
    <span>${depot.toFixed(2)} EUR</span>
  </div>
  <div class="row b">
    <span>RESTE A PAYER</span>
    <span>${(Number(price ?? devis ?? 0) - depot).toFixed(2)} EUR</span>
  </div>` : ''}
  ` : ''}

  <div class="sep">================================</div>
  <div class="c sm">Suivez votre reparation :</div>
  <img src="${qrDataUrl}" width="100" height="100" alt="QR">
  <div class="c sm wrap">${trackShort}</div>

  <div class="sep">================================</div>
  <div class="c b">Merci de votre confiance !</div>
  <div class="c sm">Conservez ce bon de depot.</div>
  <div class="c sm">Notification SMS a la fin.</div>
  <br><br><br>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1000);
      }, 300);
    };
  </script>
</body>
</html>`)

    pw.document.close()
  } catch (err) {
    console.error('[impression thermique]', err)
    alert('Erreur lors de la génération du ticket thermique.')
  }
}

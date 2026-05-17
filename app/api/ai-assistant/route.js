import Groq from 'groq-sdk'

// ---------------------------------------------------------------------------
// Route Handler — Assistant IA interne pour les réparateurs
// Utilise Groq (gratuit) avec le modèle Llama 3.3 70B
// ---------------------------------------------------------------------------

// Initialisation lazy — évite l'erreur au build si la clé est absente
let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

/**
 * Construit le system prompt en injectant le contexte du ticket courant.
 *
 * @param {object|null} ticket
 * @param {Array}       parts
 * @param {Array}       statusHistory
 * @returns {string}
 */
function buildSystemPrompt(ticket, parts, statusHistory) {
  const contextBlocks = []

  if (ticket) {
    contextBlocks.push(`## Ticket courant
- Appareil : ${[ticket.device_type, ticket.device_brand, ticket.device_model].filter(Boolean).join(' ')}
- Problème : ${ticket.issue_desc ?? ticket.issue_description ?? 'Non renseigné'}
- Statut : ${ticket.status ?? 'N/A'}
- Reçu le : ${ticket.received_at ? new Date(ticket.received_at).toLocaleDateString('fr-FR') : 'N/A'}
- Prêt estimé : ${ticket.estimated_ready_at ? new Date(ticket.estimated_ready_at).toLocaleDateString('fr-FR') : 'Non défini'}`)
  }

  if (parts && parts.length > 0) {
    const partsList = parts
      .map(p => `  • ${p.name} (réf. ${p.reference ?? '?'}) — stock : ${p.stock ?? 0}, prix : ${p.price ?? '?'} €`)
      .join('\n')
    contextBlocks.push(`## Pièces disponibles en stock\n${partsList}`)
  }

  if (statusHistory && statusHistory.length > 0) {
    const history = statusHistory
      .map(h => `  • ${new Date(h.changed_at).toLocaleDateString('fr-FR')} : ${h.old_status ?? '?'} → ${h.new_status}`)
      .join('\n')
    contextBlocks.push(`## Historique des statuts\n${history}`)
  }

  const contextSection = contextBlocks.length > 0
    ? `\n\n---\n${contextBlocks.join('\n\n')}`
    : ''

  return `Tu es l'assistant technique de ReparFlow. Tu assistes les réparateurs professionnels dans leur travail quotidien.

Tes domaines d'expertise :
- Diagnostic assisté (smartphones, tablettes, laptops, consoles, TV, électroménager)
- Suggestion de pièces de rechange adaptées au stock disponible
- Rédaction de SMS et emails à envoyer aux clients (ton professionnel, en français)
- Estimation réaliste des délais de réparation
- Réponses aux questions techniques de réparation

Règles absolues :
- Toujours répondre en français, de façon concise et professionnelle
- Maximum 300 mots par réponse
- Ne jamais inventer des informations non présentes dans le contexte
- Pour les SMS clients : 160 caractères max, ton chaleureux
- Pour les emails clients : structurés, ton professionnel
- Si tu suggères des pièces, ne mentionner que celles disponibles dans le stock fourni${contextSection}`
}

/**
 * POST /api/ai-assistant
 *
 * Body attendu :
 * {
 *   messages:       [{ role: 'user'|'assistant', content: string }]
 *   ticket?:        object
 *   parts?:         array
 *   statusHistory?: array
 * }
 *
 * Retourne un flux SSE text/event-stream.
 */
export async function POST(request) {
  if (!process.env.GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY non configurée' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON invalide' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages = [], ticket = null, parts = [], statusHistory = [] } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Le tableau messages est requis' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const systemPrompt = buildSystemPrompt(ticket, parts, statusHistory)

  // Formate les messages pour l'API Groq (compatible OpenAI)
  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  // Stream SSE vers le client
  const stream = new ReadableStream({
    async start(controller) {
      const encode = (obj) =>
        new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`)

      try {
        const groqStream = await getGroq().chat.completions.create({
          model:       'llama-3.3-70b-versatile',
          messages:    groqMessages,
          max_tokens:  1024,
          temperature: 0.7,
          stream:      true,
        })

        // Relaye chaque chunk de texte
        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            controller.enqueue(encode({ type: 'delta', text }))
          }
        }

        controller.enqueue(encode({ type: 'done' }))
        controller.close()
      } catch (err) {
        console.error('[ai-assistant] Erreur Groq :', err?.status, err?.message)
        controller.enqueue(encode({
          type:  'error',
          error: 'Une erreur est survenue lors de la génération de la réponse.',
        }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}

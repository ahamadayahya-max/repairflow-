// app/api/parse-order/route.js
// Route serveur : analyse un texte collé (catalogue Mobilax ou autre fournisseur)
// et en extrait les lignes de commande via Claude.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req) {
  try {
    const { text } = await req.json()

    if (!text || text.trim().length < 5) {
      return Response.json({ error: 'Texte trop court' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Tu es un assistant qui analyse du texte provenant d'un catalogue de pièces détachées (Mobilax, GSM55, etc.) et en extrait les lignes de commande.

Texte à analyser :
"""
${text}
"""

Extrais TOUTES les pièces mentionnées et retourne UNIQUEMENT un tableau JSON valide, sans aucun texte autour.
Format exact :
[
  {
    "part_name": "Nom complet de la pièce",
    "sku": "Référence ou code article (null si absent)",
    "qty": 1,
    "unit_price": 0.00
  }
]

Règles :
- part_name : nom complet et descriptif (marque + modèle + type de pièce)
- sku : référence/code article si présent, sinon null
- qty : quantité si précisée, sinon 1
- unit_price : prix unitaire HT en nombre décimal (ex: 89.90), 0 si absent
- Si le texte contient plusieurs pièces, liste-les toutes
- Retourne [] si aucune pièce détectable`,
      }],
    })

    const raw = message.content[0]?.text?.trim() ?? '[]'

    // Extrait le JSON même si Claude ajoute du texte autour
    const match = raw.match(/\[[\s\S]*\]/)
    const lines  = match ? JSON.parse(match[0]) : []

    return Response.json({ lines })
  } catch (err) {
    console.error('[parse-order]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

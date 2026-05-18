# TickeeFlow — CLAUDE.md

Ce fichier est lu par Claude Code à chaque session. Il contient toutes les conventions,
règles métier et informations architecturales nécessaires pour travailler de façon
autonome et cohérente sur ce projet.

---

## Contexte du projet

TickeeFlow est un SaaS B2B de gestion d'ateliers de réparation électronique (smartphones,
tablettes, laptops, consoles, TV, électroménager). Il permet aux techniciens de créer et
suivre des tickets de réparation, d'envoyer des notifications automatiques aux clients
(SMS + email), et d'orchestrer les workflows via n8n. Les clients finaux peuvent suivre
leur réparation via une page publique sans authentification. Le projet est en phase MVP
actif : landing page, espace admin, page de suivi public, agent IA d'intake WhatsApp et
assistant IA interne sont fonctionnels et déployés sur Vercel.

---

## Stack technique

| Technologie | Version | Rôle |
|---|---|---|
| Next.js | ^15.5.15 | Framework fullstack — App Router, Server + Client Components |
| React | ^18 | UI — `.jsx` uniquement, jamais `.tsx` ou `.ts` |
| Tailwind CSS | ^3.4.1 | Styles — aucune classe CSS custom, aucun fichier `.css` additionnel |
| Supabase | cloud | PostgreSQL + Auth + Storage + Edge Functions (projet : `cjowekcppcwdazvthlwb`) |
| @supabase/supabase-js | installé | Client navigateur (Auth + requêtes côté client) |
| n8n | self-hosted | Orchestration des workflows (VPS Hetzner ARM64, Docker Compose) |
| Brevo | API + SMTP | SMS transactionnel + emails (actuellement remplacé par Mailpit en local) |
| Mailpit | local:1025 | SMTP local de développement — UI sur localhost:8025 |
| @anthropic-ai/sdk | ^0.90.0 | API Claude — intake agent WhatsApp + assistant IA interne |
| nodemailer | ^8.0.5 | Envoi d'emails via SMTP (Mailpit en dev, Brevo en prod) |
| lucide-react | ^0.400.0 | Icônes SVG |
| Vercel | cloud | Hébergement Next.js — domaine stable : tickeeflow-app.vercel.app |

---

## Structure du projet

```
/
├── app/                              — Pages Next.js (App Router)
│   ├── layout.jsx                    — Layout racine (metadata globale)
│   ├── page.jsx                      — Landing page publique (/)
│   ├── globals.css                   — Reset CSS + directives Tailwind uniquement
│   │
│   ├── admin/                        — Espace administration (protégé par Supabase Auth)
│   │   ├── layout.jsx                — Layout admin : sidebar + vérification session
│   │   ├── page.jsx                  — Redirige vers /admin/tickets
│   │   ├── login/
│   │   │   └── page.jsx              — Page de connexion email/mot de passe
│   │   └── tickets/
│   │       ├── page.jsx              — Liste des tickets avec filtres + recherche
│   │       └── [id]/
│   │           └── page.jsx          — Détail ticket + Assistant IA intégré
│   │
│   ├── track/
│   │   └── [token]/
│   │       ├── page.jsx              — Page de suivi public (Server Component, sans auth)
│   │       └── TrackingClient.jsx    — Client Component avec polling 60s
│   │
│   └── api/                          — Route Handlers (webhooks entrants uniquement)
│       ├── ai-assistant/
│       │   └── route.js              — POST : streaming SSE vers Claude (assistant interne)
│       └── demo-request/
│           └── route.js              — POST : demande de démo depuis la landing page
│
├── components/
│   ├── admin/
│   │   └── AIAssistant.jsx           — Chat IA streaming pour les réparateurs
│   └── landing/                      — Sections de la landing page
│       ├── Navbar.jsx
│       ├── Hero.jsx
│       ├── FeaturesSection.jsx
│       ├── ProblemSection.jsx
│       ├── PerksSection.jsx
│       ├── TestimonialsSection.jsx
│       ├── FaqSection.jsx
│       ├── CtaSection.jsx
│       ├── Footer.jsx
│       └── DemoModal.jsx
│
├── lib/
│   ├── supabase/
│   │   ├── server.js                 — Client Supabase serveur (service_role key, fetch brut)
│   │   └── client.js                 — Client Supabase navigateur (anon key, SDK officiel)
│   └── notifications/
│       ├── sendEmail.js              — Envoi email via nodemailer (Mailpit/Brevo)
│       └── templates.js              — Templates SMS et HTML email
│
├── supabase/
│   └── migrations/                   — Fichiers SQL — NE JAMAIS MODIFIER un fichier existant
│       ├── 20260410000000_tickeeflow_initial_schema.sql
│       ├── 20260416000000_tickeeflow_intake_conversations.sql
│       ├── 20260416000001_tickeeflow_shops.sql
│       ├── 20260416000003_tickeeflow_corrective_migration.sql
│       ├── 20260416000004_fix_get_ticket_by_token.sql
│       └── 20260416000005_intake_conversations.sql
│
├── n8n-workflows/                    — Exports JSON des workflows n8n versionnés
│   ├── tickeeflow-create-ticket.json
│   ├── tickeeflow-update-status.json
│   ├── tickeeflow-stock-alert.json
│   ├── tickeeflow-dashboard-stats.json
│   ├── tickeeflow-intake-agent.json  — Agent intake WhatsApp → Claude → Supabase
│   ├── intake-system-prompt.txt      — System prompt de l'agent intake Claude
│   └── intake-agent-system-prompt.md
│
├── CLAUDE.md                         — Ce fichier
├── jsconfig.json                     — Alias @/* → ./*
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .gitignore
```

---

## Conventions de code

### Fichiers et nommage
- Tous les composants sont en **`.jsx`** — ne jamais créer `.tsx` ou `.ts`
- Composants : **PascalCase** → `TicketCard.jsx`, `StatusBadge.jsx`
- Fonctions utilitaires : **camelCase** → `formatDate.js`, `buildNotificationPayload.js`
- Pages App Router : convention Next.js → `app/tickets/[id]/page.jsx`
- Un composant par fichier, toujours exporté en `export default`

### Structure d'un composant
```jsx
'use client' // seulement si hooks ou événements navigateur

import { useState } from 'react'
import { Wrench } from 'lucide-react'

/**
 * Description du composant en une phrase.
 * @param {{ ticket: object, onClose: () => void }} props
 */
export default function MonComposant({ ticket, onClose }) {
  // ...
  return (
    <div className="...tailwind...">
      {/* Commentaire en français sur le pourquoi */}
    </div>
  )
}
```

### Imports Supabase
```js
// Dans un Server Component ou Route Handler :
import { rpc, from } from '@/lib/supabase/server'

// Dans un Client Component ('use client') :
import { getSupabaseClient } from '@/lib/supabase/client'
const supabase = getSupabaseClient() // singleton
```

### Styles
- **Uniquement Tailwind CSS** — pas de classes CSS personnalisées
- Pas de `style={{}}` inline sauf valeurs dynamiques impossibles en Tailwind
- Palette dark theme admin : `bg-[#0F0F1A]` (fond), `bg-[#111118]` (cartes), `text-amber-400` (accent)
- Pas de bibliothèques de composants tierces sans accord explicite

### Commentaires
- Tous les commentaires en **français**
- Commenter le "pourquoi", pas le "quoi"
- En-tête de section avec `// ---------------------------------------------------------------------------`

### Props JSDoc obligatoire
```jsx
/**
 * Affiche le badge de statut d'un ticket.
 * @param {{ status: 'pending'|'in_repair'|'ready'|'delivered', size?: 'sm'|'md' }} props
 */
export function StatusBadge({ status, size = 'md' }) { ... }
```

---

## Règles métier importantes

### 1. Transitions de statut — unidirectionnelles et strictes

```
pending → in_repair → ready → delivered
```

Toute logique de changement de statut DOIT valider cette contrainte.
Un `UPDATE` régressif est une erreur critique. Matrice autorisée :

| Depuis \ Vers | pending | in_repair | ready | delivered |
|---|---|---|---|---|
| `pending` | — | ✅ | ❌ | ❌ |
| `in_repair` | ❌ | — | ✅ | ❌ |
| `ready` | ❌ | ❌ | — | ✅ |
| `delivered` | ❌ | ❌ | ❌ | — |

### 2. Immuabilité du `tracking_token`

Le `tracking_token` est généré **une seule fois** à la création du ticket.
Il NE DOIT JAMAIS apparaître dans un `UPDATE`. Si une migration touche ce champ, stopper immédiatement.

### 3. Confidentialité des données client dans les logs

Les données personnelles (nom, téléphone, email, adresse) NE DOIVENT JAMAIS apparaître dans :
- Les `console.log` / `console.error`
- Les messages d'erreur renvoyés au client
- Les payloads de webhook loggés

Utiliser uniquement des identifiants anonymes : `ticket_id`, `client_id`, `shop_id`.

### 4. Tout changement de statut passe par n8n

JAMAIS de `UPDATE` direct sur `tickets.status` depuis le frontend ou une Route Handler.
Le flux obligatoire est : **Frontend → webhook n8n → validation → Supabase → notification Brevo**.
Le seul endroit légitime pour écrire `status` directement est l'Edge Function Supabase appelée par n8n.

### 5. Multi-tenancy — isolation par `shop_id`

Chaque requête Supabase côté admin DOIT filtrer par `shop_id`.
Les RLS sont actives sur toutes les tables — ne jamais les désactiver.
La fonction `fn_my_shop_id()` retourne le `shop_id` de l'utilisateur connecté.

### 6. `service_role` key — jamais côté navigateur

La `SUPABASE_SERVICE_ROLE_KEY` n'est utilisée que dans `lib/supabase/server.js`.
Elle ne doit JAMAIS être importée dans un Client Component ou exposée en `NEXT_PUBLIC_`.

---

## Variables d'environnement

Fichier : `.env.local` (jamais commité — voir `.gitignore`)

```env
# Supabase — projet cjowekcppcwdazvthlwb
NEXT_PUBLIC_SUPABASE_URL=https://cjowekcppcwdazvthlwb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...        # clé publique, visible navigateur
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...            # clé privée, serveur uniquement

# Email (Mailpit en dev, Brevo en prod)
MAILPIT_SMTP_HOST=localhost
MAILPIT_SMTP_PORT=1025
MAIL_FROM_ADDRESS=noreply@tickeeflow.local
MAIL_FROM_NAME=TickeeFlow

# n8n
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=tickeeflow_secret             # header x-webhook-secret à valider

# Claude / Anthropic
ANTHROPIC_API_KEY=sk-ant-...                     # requis pour /api/ai-assistant et intake agent
```

Variables déjà configurées sur Vercel (production) :
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `ANTHROPIC_API_KEY` ✅

Variables à ajouter sur Vercel pour la production complète :
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_BASE_URL` (URL publique du VPS Hetzner)
- `N8N_WEBHOOK_SECRET`

---

## Commandes utiles

```bash
# Développement local
npm run dev                        # démarre Next.js (port 3002 — 3000 bloqué par Hyper-V)
npm run build                      # build de production (vérification erreurs)
npm run lint                       # ESLint

# Déploiement Vercel
npx vercel --prod                  # déploie en production
# Domaine stable : https://tickeeflow-app.vercel.app

# Supabase
supabase db push                   # applique les migrations locales vers Supabase cloud
# Ou : coller le SQL directement dans Supabase Studio → SQL Editor

# n8n (local)
n8n start                          # démarre n8n sur localhost:5678
# Binaire : C:/Users/HP/AppData/Roaming/npm/node_modules/n8n/bin/n8n

# Mailpit (local)
# SMTP : localhost:1025
# UI web : http://localhost:8025
```

---

## Architecture des données

### Tables principales

```
shops
  id (uuid PK), owner_id (uuid FK → auth.users), name, phone, address,
  hours, logo_url, plan, created_at

clients
  id (uuid PK), shop_id (uuid FK → shops), full_name (NOT NULL), phone (NOT NULL),
  email, first_name, last_name, created_at

tickets
  id (uuid PK), shop_id (uuid FK → shops), client_id (uuid FK → clients),
  tracking_token (text UNIQUE — immuable), status (enum: pending|in_repair|ready|delivered),
  device_type (NOT NULL), device_brand, device_model,
  issue_desc (NOT NULL), issue_description,
  received_at, estimated_ready_at, intake_channel, created_at

intake_conversations
  id (uuid PK), phone (text NOT NULL), contact_id (uuid FK → clients),
  ticket_id (uuid FK → tickets), messages (jsonb — historique Claude),
  partial_data (jsonb), turn_count (integer), status (open|completed|closed),
  last_action (text), created_at, updated_at
```

### Fonctions RPC Supabase clés

| Fonction | Usage |
|---|---|
| `get_ticket_by_token(p_token)` | Retourne `{ ticket: {...}, shop: {...} }` — page de suivi public |
| `fn_get_or_create_conversation(p_phone)` | Upsert session intake — appelée par n8n |
| `fn_update_conversation(p_id, ...)` | Sauvegarde l'état de la conversation Claude |
| `fn_my_shop_id()` | Retourne le `shop_id` de l'utilisateur connecté (RLS helper) |

### Relations

```
auth.users (Supabase Auth)
    └── shops (owner_id)
            └── clients (shop_id)
                    └── tickets (shop_id + client_id)
                            └── intake_conversations (ticket_id)
```

---

## Intégrations externes

### Supabase
- **URL projet** : `https://cjowekcppcwdazvthlwb.supabase.co`
- **Studio** : `https://supabase.com/dashboard/project/cjowekcppcwdazvthlwb`
- `lib/supabase/server.js` — fetch brut avec `service_role` → Server Components + Route Handlers
- `lib/supabase/client.js` — SDK `@supabase/supabase-js` avec `anon key` → Client Components
- RLS actif sur toutes les tables — `service_role` bypasse le RLS (à utiliser avec prudence)

### n8n (self-hosted)
- **Local** : `http://localhost:5678`
- **Production** : VPS Hetzner ARM64, Docker Compose
- Les webhooks entrants n8n arrivent sur `/app/api/webhooks/n8n/` (valider `x-webhook-secret`)
- Workflows versionnés dans `/n8n-workflows/*.json`
- Workflow intake agent : 13 nœuds → Webhook → Normalize → Upsert Contact → Build Claude Request → Call Claude → Parse → Switch → Create Ticket / Ask Question / Fallback → SMS → Respond 200

### Claude API (Anthropic)
- **Modèle** : `claude-opus-4-7` (toujours utiliser ce modèle par défaut)
- **Intake agent** : appelé par n8n, system prompt dans `n8n-workflows/intake-system-prompt.txt`
  - Format de réponse JSON : `{ action, confidence, client_message_to_send, question_focus, ticket_data }`
- **Assistant interne** : Route Handler `POST /api/ai-assistant` avec streaming SSE
  - Body : `{ messages, ticket, parts, statusHistory }`
  - Retourne `data: { type: 'delta'|'done'|'error', text? }` en Server-Sent Events

### Brevo (production) / Mailpit (développement)
- Toute la logique d'envoi est dans `lib/notifications/`
- Ne jamais appeler Brevo directement depuis un composant ou une page
- SMS : format E.164 obligatoire avant envoi
- 16 templates disponibles dans `lib/notifications/templates.js`

---

## Workflow de développement

### Ajouter une migration SQL
1. Créer un NOUVEAU fichier dans `supabase/migrations/` avec timestamp croissant
2. Format : `YYYYMMDDHHMMSS_description.sql`
3. Ne JAMAIS modifier un fichier de migration existant
4. Appliquer via Supabase Studio → SQL Editor (coller le contenu)

### Ajouter une page admin
1. Créer `app/admin/nouvelle-page/page.jsx`
2. Ajouter `export const dynamic = 'force-dynamic'` en tête de fichier
3. Les pages admin sont automatiquement protégées par `app/admin/layout.jsx`
4. Toujours filtrer les requêtes Supabase par `shop_id`

### Ajouter un composant
1. Créer dans `components/admin/` ou `components/landing/` selon le contexte
2. Documenter les props avec JSDoc
3. Pas de `'use client'` sauf si hooks React ou événements navigateur sont nécessaires

### Déploiement
```bash
npm run build   # vérifier qu'il n'y a pas d'erreurs
npx vercel --prod
# URL stable automatiquement mise à jour : https://tickeeflow-app.vercel.app
```

---

## Points d'attention et pièges connus

### Alias `@/` — jsconfig.json requis
Le fichier `jsconfig.json` configure `"@/*": ["./*"]`. Sans lui, tous les imports `@/lib/...` échouent.

### Port 3000 bloqué sous Windows
Hyper-V réserve le port 3000. Next.js tourne sur **localhost:3002** en local.
Pour forcer le port : `npm run dev -- -p 3002`

### Supabase RPC — paramètres nommés
Les paramètres des fonctions RPC doivent correspondre exactement aux noms définis en SQL.
Exemple : `get_ticket_by_token` attend `p_token`, pas `token`.
```js
// ✅ Correct
await rpc('get_ticket_by_token', { p_token: token })
// ❌ Faux
await rpc('get_ticket_by_token', { token })
```

### RPC `get_ticket_by_token` — structure de retour imbriquée
La fonction retourne `{ ticket: {...}, shop: {...} }`, pas un objet plat.
```js
const { shop = {}, ticket: ticketData } = result
```

### Pages admin — `export const dynamic = 'force-dynamic'`
Toutes les pages admin utilisent `getSupabaseClient()` qui nécessite les env vars.
Sans `force-dynamic`, Vercel tente un prerendering statique au build et échoue.

### `'use client'` et `dynamic` incompatibles en apparence
On peut exporter `dynamic` depuis un fichier avec `'use client'` — Next.js l'accepte.
La directive `'use client'` s'applique au runtime, `dynamic` au comportement de rendu.

### Données client dans les logs
Ne jamais logger `client.phone`, `client.full_name`, `client.email`.
En cas de debug : logger `ticket.id` ou `client.id` uniquement.

### n8n — chemin du binaire (Windows)
```
C:/Users/HP/AppData/Roaming/npm/node_modules/n8n/bin/n8n
```
S'assurer que Node.js est dans le PATH avant de lancer n8n.

### Supabase `clients` — champ `full_name`
La table `clients` a un champ `full_name` (hérité du schéma initial) ET les champs
`first_name` / `last_name` ajoutés par la migration corrective. Utiliser `full_name`
comme champ principal d'affichage.

---

## Roadmap actuelle

### 1. 🔴 Tableau de bord admin (priorité haute)
Ajouter `app/admin/dashboard/page.jsx` avec :
- KPIs : tickets ouverts, en réparation, prêts, livrés ce mois
- Graphique de volume hebdomadaire
- Alertes stock (pièces < seuil)
- Données servies par la RPC n8n `tickeeflow-dashboard-stats`

### 2. 🟡 Gestion du changement de statut depuis l'admin (priorité moyenne)
Ajouter dans `app/admin/tickets/[id]/page.jsx` :
- Boutons de transition de statut (respectant la matrice autorisée)
- Appel webhook vers n8n (jamais `UPDATE` direct)
- Notification automatique au client via Brevo après changement

### 3. 🟢 Page de gestion du profil atelier (priorité normale)
Créer `app/admin/settings/page.jsx` :
- Modifier nom, téléphone, adresse, horaires de l'atelier
- Upload logo (Supabase Storage)
- Configurer les templates de notifications SMS/email

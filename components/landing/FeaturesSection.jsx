import { CheckCircle, Smartphone, Monitor, Tablet } from 'lucide-react'

/**
 * Mockup : liste de tickets
 */
function TicketsMockup() {
  const tickets = [
    { id: 'B7KL2P', name: 'Sophie M.', device: 'iPhone 14 Pro', status: 'ready', statusLabel: 'Prêt', statusColor: 'text-green-400 bg-green-400/10' },
    { id: 'A3FX9K', name: 'Marie D.', device: 'Samsung Galaxy S23', status: 'in_repair', statusLabel: 'En réparation', statusColor: 'text-amber-400 bg-amber-400/10' },
    { id: 'C9MT4R', name: 'Lucas B.', device: 'MacBook Air M2', status: 'diagnosed', statusLabel: 'Diagnostic', statusColor: 'text-blue-400 bg-blue-400/10' },
  ]

  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#9CA3AF] text-xs font-medium">Tickets en cours</span>
        <span className="text-amber-400 text-xs font-semibold bg-amber-400/10 px-2 py-0.5 rounded-full">3 actifs</span>
      </div>
      {tickets.map((t) => (
        <div key={t.id} className="bg-[#0d0d1a] border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[#F1F0ED] text-sm font-medium">{t.name}</p>
            <p className="text-white/40 text-xs mt-0.5">{t.device}</p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.statusColor}`}>
              {t.statusLabel}
            </span>
            <p className="text-white/20 text-[10px] mt-1 font-mono">#{t.id}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Mockup : bulles SMS
 */
function NotifMockup() {
  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[#9CA3AF] text-xs">Notifications automatiques</span>
      </div>
      <div className="space-y-4">
        {/* Bulle reçue */}
        <div className="flex justify-start">
          <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
            <p className="text-white/70 text-xs">Bonjour, mon écran est fissuré depuis hier soir...</p>
          </div>
        </div>
        {/* Bulle envoyée (n8n) */}
        <div className="flex justify-end">
          <div className="bg-amber-500/90 rounded-2xl rounded-br-sm px-4 py-3 max-w-xs">
            <p className="text-black text-xs font-medium">Votre Samsung Galaxy S23 a bien été reçu ! Suivez votre réparation : reparflow.fr/track/A3FX9K</p>
          </div>
        </div>
        {/* Bulle envoyée 2 */}
        <div className="flex justify-end">
          <div className="bg-amber-500/90 rounded-2xl rounded-br-sm px-4 py-3 max-w-xs">
            <p className="text-black text-xs font-medium">Bonne nouvelle ! La réparation de votre appareil est en cours. 🔧</p>
          </div>
        </div>
        <div className="text-center">
          <span className="text-white/20 text-[10px]">Envoyé automatiquement par ReparFlow</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Mockup : multi-device
 */
function DeviceMockup() {
  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-6">
      <div className="flex items-end justify-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <Smartphone className="w-8 h-8 text-amber-500" />
          </div>
          <span className="text-white/40 text-xs">Mobile</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
            <Monitor className="w-12 h-12 text-amber-500" />
          </div>
          <span className="text-amber-400 text-xs font-medium">Bureau</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <Tablet className="w-8 h-8 text-amber-500" />
          </div>
          <span className="text-white/40 text-xs">Tablette</span>
        </div>
      </div>
      <div className="w-full bg-white/5 rounded-lg px-4 py-3 text-center">
        <p className="text-[#9CA3AF] text-xs">Synchronisé en temps réel · Aucune installation</p>
      </div>
    </div>
  )
}

const features = [
  {
    title: 'Tickets de réparation',
    subtitle: 'Créez un ticket en 30 secondes',
    description:
      'Assignez un appareil, notez le problème, fixez un devis. Tout est consigné, classé et accessible en un clic. Fini les post-its qui disparaissent.',
    perks: ['Création en 30 secondes', 'Historique client complet', 'Statuts clairs et filtrables'],
    mockup: <TicketsMockup />,
    reverse: false,
  },
  {
    title: 'Notifications automatiques',
    subtitle: 'Zéro appel entrant non nécessaire',
    description:
      'À chaque changement de statut, votre client reçoit un SMS et un email personnalisé. Fini les appels "c\'est prêt ?" — vos clients sont informés avant même de penser à vous appeler.',
    perks: ['SMS et email automatiques', 'Personnalisés à votre atelier', 'Zéro configuration supplémentaire'],
    mockup: <NotifMockup />,
    reverse: true,
  },
  {
    title: 'Accessible partout',
    subtitle: 'Smartphone, tablette, ordinateur',
    description:
      'Depuis votre comptoir, votre réserve ou votre bureau à la maison. Aucune installation requise, toujours synchronisé, toujours à jour. Votre atelier dans votre poche.',
    perks: ['Smartphone, tablette, PC', 'Aucune installation requise', 'Données sauvegardées en continu'],
    mockup: <DeviceMockup />,
    reverse: false,
  },
]

export default function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="py-20 bg-[#08080F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre */}
        <div className="text-center mb-20">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">Fonctionnalités</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F1F0ED]">
            Tout votre atelier sous contrôle
          </h2>
        </div>

        {/* Features alternées */}
        <div className="space-y-24">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`flex flex-col ${f.reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}
            >
              {/* Texte */}
              <div className="flex-1 space-y-5">
                <div>
                  <p className="text-amber-500 text-sm font-semibold mb-2">0{i + 1}</p>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#F1F0ED] mb-3">{f.title}</h3>
                  <p className="text-[#9CA3AF] text-sm font-medium mb-4">{f.subtitle}</p>
                  <p className="text-[#9CA3AF] leading-relaxed">{f.description}</p>
                </div>
                <ul className="space-y-3">
                  {f.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-[#F1F0ED] text-sm">{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mockup */}
              <div className="flex-1 w-full max-w-md mx-auto lg:mx-0">
                {f.mockup}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

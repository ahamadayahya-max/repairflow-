import { PhoneCall, FileText, Clock, BarChart2 } from 'lucide-react'

const problems = [
  {
    icon: PhoneCall,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-400/10',
    title: 'Clients qui rappellent sans cesse',
    description:
      'Votre téléphone sonne toute la journée : "C\'est prêt ?" Vous perdez un temps précieux à rassurer des clients que vous pourriez informer automatiquement.',
  },
  {
    icon: FileText,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-400/10',
    title: 'Post-its et Excel partout',
    description:
      'Entre les carnets, les feuilles volantes et les fichiers, retrouver l\'historique d\'un client tourne au casse-tête. Et les erreurs se multiplient.',
  },
  {
    icon: Clock,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-400/10',
    title: 'Des réparations qui s\'accumulent',
    description:
      'Sans suivi clair, certaines réparations traînent. Le client attend, vous cherchez. Tout le monde y perd — y compris la réputation de votre atelier.',
  },
  {
    icon: BarChart2,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-400/10',
    title: 'Zéro visibilité sur l\'activité',
    description:
      'Impossible de savoir en un coup d\'œil combien de tickets sont en cours, ce qui se bloque ou ce qui génère du chiffre. Vous pilotez à l\'aveugle.',
  },
]

export default function ProblemSection() {
  return (
    <section id="problemes" className="py-20 bg-[#08080F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F1F0ED] mb-4">
            Chaque jour, les mêmes problèmes...
          </h2>
          <p className="text-[#9CA3AF] text-lg max-w-xl mx-auto">
            La plupart des ateliers indépendants gèrent encore leurs réparations comme en 2005.
            Il est temps de changer ça.
          </p>
        </div>

        {/* Grille pain points */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
          {problems.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.title}
                className="bg-[#111118] border border-white/10 rounded-xl p-6 flex gap-4"
              >
                <div className={`${p.iconBg} rounded-lg p-3 h-fit flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${p.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-[#F1F0ED] font-semibold mb-2">{p.title}</h3>
                  <p className="text-[#9CA3AF] text-sm leading-relaxed">{p.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Transition */}
        <div className="text-center">
          <div className="inline-block bg-amber-500/10 border border-amber-500/20 rounded-2xl px-8 py-4">
            <p className="text-amber-400 text-lg font-semibold">
              Avec TickeeFlow, tout ça, c'est terminé.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

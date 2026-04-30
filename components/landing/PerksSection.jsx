import { Zap, Target, Headphones } from 'lucide-react'

const perks = [
  {
    icon: Zap,
    title: 'Prise en main immédiate',
    description:
      'La grande majorité de nos clients sont opérationnels en moins de 30 minutes. Pas de formation, pas de manuel, pas de consultant à payer.',
  },
  {
    icon: Target,
    title: "L'essentiel, rien de plus",
    description:
      "Chaque fonctionnalité résout un vrai problème de réparateur. Pas de menus cachés, pas d'options inutiles. Ce qui compte, et uniquement ça.",
  },
  {
    icon: Headphones,
    title: 'Support humain et réactif',
    description:
      'Une vraie personne vous répond sous 24h. Par email ou par téléphone. Pas de chatbot, pas de ticket numéro 4782. Une vraie conversation.',
  },
]

export default function PerksSection() {
  return (
    <section className="py-20 bg-[#111118] border-y border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre */}
        <div className="text-center mb-14">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">Pourquoi RepairFlow</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F1F0ED] mb-4">
            Conçu avec et pour les réparateurs
          </h2>
          <p className="text-[#9CA3AF] text-lg max-w-xl mx-auto">
            Pas une usine à gaz. Juste l'outil qu'il vous faut, ni plus ni moins.
          </p>
        </div>

        {/* 3 colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {perks.map((perk) => {
            const Icon = perk.icon
            return (
              <div key={perk.title} className="flex flex-col items-start gap-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <Icon className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-[#F1F0ED] font-semibold text-lg mb-2">{perk.title}</h3>
                  <p className="text-[#9CA3AF] text-sm leading-relaxed">{perk.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

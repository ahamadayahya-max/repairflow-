'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Est-ce simple à prendre en main ?',
    a: "Oui. La grande majorité de nos clients sont opérationnels en moins de 30 minutes. L'interface est pensée pour aller à l'essentiel, sans formation préalable ni guide de 50 pages.",
  },
  {
    q: 'Dois-je changer mes habitudes de travail ?',
    a: "Non. ReparFlow s'adapte à votre façon de travailler. Vous continuez à accueillir vos clients comme avant — c'est juste le suivi et les notifications qui sont automatisés à votre place.",
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    a: "Oui. Vos données sont hébergées en France, chiffrées en SSL, et sauvegardées automatiquement chaque jour. Vous restez propriétaire de vos données à tout moment et pouvez les exporter.",
  },
  {
    q: "Y a-t-il un engagement de durée ?",
    a: "Aucun. Vous pouvez résilier à tout moment, sans frais ni démarche compliquée. Votre abonnement s'arrête simplement à la fin de la période en cours.",
  },
  {
    q: "Combien ça coûte ?",
    a: "À partir de 29 €/mois, tout compris. L'essai gratuit de 14 jours ne nécessite aucune carte bancaire. Vous choisissez votre formule uniquement si vous souhaitez continuer.",
  },
]

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null)

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i)

  return (
    <section id="faq" className="py-20 bg-[#111118] border-t border-white/10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre */}
        <div className="text-center mb-12">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F1F0ED]">
            Questions fréquentes
          </h2>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={faq.q}
                className={`border rounded-xl overflow-hidden transition-colors duration-200 ${
                  isOpen ? 'border-amber-500/30 bg-[#0d0d1a]' : 'border-white/10 bg-[#111118]'
                }`}
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[#F1F0ED] font-medium text-sm sm:text-base pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-amber-500' : 'text-[#9CA3AF]'
                    }`}
                  />
                </button>

                {/* Réponse avec transition */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-5 border-t border-white/5">
                    <p className="text-[#9CA3AF] text-sm leading-relaxed pt-4">{faq.a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

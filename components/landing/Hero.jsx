'use client'

import { useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import DemoModal from './DemoModal'

export default function Hero() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <section className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden bg-[#08080F]">
        {/* Lueurs d'ambiance */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-amber-500/3 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Colonne texte */}
            <div className="flex flex-col gap-6">
              {/* Badge social proof */}
              <div className="inline-flex items-center gap-2 self-start bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm px-4 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Utilisé par +200 ateliers en France
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F1F0ED] leading-[1.1] tracking-tight">
                Gérez vos réparations.{' '}
                <span className="text-amber-500">Vos clients sont informés.</span>{' '}
                Automatiquement.
              </h1>

              <p className="text-lg text-[#9CA3AF] leading-relaxed max-w-xl">
                TickeeFlow suit chaque réparation, notifie vos clients par SMS et email,
                et vous fait gagner <strong className="text-[#F1F0ED]">2h par semaine</strong> sur
                les appels et les relances.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors text-base"
                >
                  Démarrer gratuitement
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-white/20 hover:border-white/40 hover:bg-white/5 text-[#F1F0ED] font-semibold rounded-xl transition-all text-base"
                >
                  <Play className="w-4 h-4 text-amber-500" />
                  Voir une démo
                </button>
              </div>

              {/* Stats rapides */}
              <div className="flex flex-wrap gap-6 pt-2">
                {[
                  { value: '200+', label: 'ateliers actifs' },
                  { value: '30s', label: 'pour créer un ticket' },
                  { value: '14j', label: "d'essai gratuit" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col">
                    <span className="text-xl font-bold text-amber-500">{stat.value}</span>
                    <span className="text-xs text-[#9CA3AF]">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup ticket */}
            <div className="relative lg:justify-self-end w-full max-w-md mx-auto lg:mx-0">
              <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 shadow-2xl">
                {/* Header ticket */}
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-xs text-white/30">#A3FX9K2M</span>
                  <span className="flex items-center gap-1.5 bg-amber-500/15 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    En réparation
                  </span>
                </div>

                {/* Client */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 text-xs font-bold">MD</span>
                  </div>
                  <div>
                    <p className="text-[#F1F0ED] text-sm font-semibold leading-none mb-1">Marie Dupont</p>
                    <p className="text-white/30 text-xs">+33 6 12 34 56 78</p>
                  </div>
                </div>

                {/* Appareil */}
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-white/40 text-xs mb-1">Appareil</p>
                  <p className="text-[#F1F0ED] text-sm font-medium">Samsung Galaxy S23</p>
                  <p className="text-white/50 text-xs mt-0.5">Écran fissuré, tactile inactif</p>
                </div>

                {/* Timeline statuts */}
                <div className="mb-5">
                  <p className="text-white/40 text-xs mb-3">Avancement</p>
                  <div className="flex items-center gap-0">
                    {[
                      { label: 'Reçu', done: true },
                      { label: 'Diagnostic', done: true },
                      { label: 'Réparation', active: true },
                      { label: 'Prêt', done: false },
                      { label: 'Livré', done: false },
                    ].map((step, i, arr) => (
                      <div key={step.label} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${
                              step.active
                                ? 'bg-amber-500 ring-4 ring-amber-500/20 animate-pulse'
                                : step.done
                                ? 'bg-amber-500'
                                : 'bg-white/10'
                            }`}
                          />
                          <span className={`text-[9px] whitespace-nowrap ${
                            step.active ? 'text-amber-400' : step.done ? 'text-white/60' : 'text-white/20'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`h-px flex-1 mx-1 mb-4 ${step.done ? 'bg-amber-500/50' : 'bg-white/10'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notif SMS */}
                <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-green-400 text-xs font-semibold">SMS envoyé automatiquement</span>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed">
                    &ldquo;Bonne nouvelle ! La réparation de votre Samsung Galaxy S23 est en cours...&rdquo;
                  </p>
                </div>
              </div>

              {/* Badge flottant */}
              <div className="absolute -top-4 -right-4 bg-[#111118] border border-white/10 rounded-xl px-3 py-2 shadow-xl hidden sm:block">
                <p className="text-amber-400 text-xs font-semibold">⚡ Ticket créé en 28s</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <DemoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}

import { ArrowRight } from 'lucide-react'

export default function CtaSection() {
  return (
    <section className="relative py-24 bg-[#08080F] overflow-hidden">
      {/* Lueur ambiante amber centrée */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-5">
          Lancez-vous
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F1F0ED] mb-5 leading-tight">
          Prêt à gagner du temps
          <br />
          chaque semaine ?
        </h2>

        <p className="text-[#9CA3AF] text-lg mb-10">
          14 jours d'essai gratuit. Aucune carte bancaire requise.
          <br />
          Configuration en moins de 30 minutes.
        </p>

        <a
          href="/register"
          className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-lg transition-colors shadow-lg shadow-amber-500/20"
        >
          Démarrer gratuitement — c'est gratuit
          <ArrowRight className="w-5 h-5" />
        </a>

        <p className="mt-6 text-[#9CA3AF] text-sm">
          Déjà +200 ateliers nous font confiance en France.
        </p>
      </div>
    </section>
  )
}

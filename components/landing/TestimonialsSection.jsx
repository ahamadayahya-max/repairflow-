const testimonials = [
  {
    quote:
      "Un gain de temps énorme sur les appels. Mes clients adorent le suivi SMS, ça fait vraiment pro. Je ne sais pas comment je faisais avant.",
    name: 'Cédric',
    shop: "L'Atelier du Tech",
    city: 'Lyon',
    initials: 'C',
  },
  {
    quote:
      "Mis en place en 20 minutes chrono. Mes clients trouvent ça très professionnel. Je ne reviendrais pas en arrière pour rien au monde.",
    name: 'Sébastien',
    shop: 'Mobil GSM',
    city: 'Bordeaux',
    initials: 'S',
  },
  {
    quote:
      "Je recommande les yeux fermés. Simple, efficace, et le support répond vraiment vite quand on a une question. Parfait.",
    name: 'Hugo',
    shop: 'Horepa',
    city: 'Nantes',
    initials: 'H',
  },
]

export default function TestimonialsSection() {
  return (
    <section id="temoignages" className="py-20 bg-[#08080F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Titre */}
        <div className="text-center mb-14">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-3">Témoignages</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F1F0ED]">
            Ils en parlent mieux que nous
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-[#111118] border border-white/10 rounded-xl p-6 flex flex-col gap-5"
            >
              {/* Étoiles */}
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-amber-500 text-base">★</span>
                ))}
              </div>

              {/* Citation */}
              <p className="text-[#F1F0ED] text-sm leading-relaxed italic flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Auteur */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 text-sm font-bold">{t.initials}</span>
                </div>
                <div>
                  <p className="text-[#F1F0ED] text-sm font-semibold">{t.name}</p>
                  <p className="text-[#9CA3AF] text-xs">{t.shop} · {t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

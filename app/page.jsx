// app/page.jsx
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import ProblemSection from '@/components/landing/ProblemSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import PerksSection from '@/components/landing/PerksSection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import FaqSection from '@/components/landing/FaqSection'
import CtaSection from '@/components/landing/CtaSection'
import Footer from '@/components/landing/Footer'

export const metadata = {
  title: 'RepairFlow — Gestion d\'ateliers de réparation',
  description:
    'RepairFlow suit chaque réparation, notifie vos clients par SMS et email, et vous fait gagner 2h par semaine sur les appels et relances. Essai gratuit 14 jours.',
}

export default function LandingPage() {
  return (
    <main className="scroll-smooth bg-[#08080F] text-[#F1F0ED]">
      <Navbar />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <PerksSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </main>
  )
}

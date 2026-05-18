// components/landing/Navbar.jsx
'use client'

import { useState, useEffect } from 'react'
import { Wrench, Menu, X } from 'lucide-react'
import DemoModal from './DemoModal'

/**
 * Barre de navigation principale avec gestion du scroll, menu mobile et modale démo.
 */
export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Détection du scroll pour appliquer le fond flouté
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Écoute de l'événement custom pour ouvrir la modale depuis n'importe quel composant
    const handleOpenDemo = () => setIsModalOpen(true)
    window.addEventListener('tickeeflow:open-demo', handleOpenDemo)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('tickeeflow:open-demo', handleOpenDemo)
    }
  }, [])

  const navLinks = [
    { label: 'Fonctionnalités', href: '#fonctionnalites' },
    { label: 'Témoignages', href: '#temoignages' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'backdrop-blur-md bg-[#08080F]/90 border-b border-white/10'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2 flex-shrink-0">
              <Wrench className="w-6 h-6 text-amber-500" />
              <span className="text-lg font-bold text-[#F1F0ED] tracking-tight">
                TickeeFlow
              </span>
            </a>

            {/* Liens de navigation — desktop */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[#9CA3AF] hover:text-[#F1F0ED] transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* CTAs — desktop */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-[#F1F0ED] border border-white/20 rounded-lg hover:border-white/40 hover:bg-white/5 transition-all duration-200"
              >
                Demander une démo
              </button>
              <a
                href="/register"
                className="px-4 py-2 text-sm font-medium text-[#08080F] bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors duration-200"
              >
                Essai gratuit
              </a>
            </div>

            {/* Bouton hamburger — mobile */}
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="md:hidden p-2 text-[#9CA3AF] hover:text-[#F1F0ED] transition-colors"
              aria-label="Ouvrir le menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        {isMenuOpen && (
          <div className="md:hidden bg-[#111118] border-t border-white/10">
            <nav className="flex flex-col px-4 py-4 gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="px-3 py-2 text-sm text-[#9CA3AF] hover:text-[#F1F0ED] hover:bg-white/5 rounded-lg transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t border-white/10 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsModalOpen(true)
                  }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-[#F1F0ED] border border-white/20 rounded-lg hover:bg-white/5 transition-all duration-200"
                >
                  Demander une démo
                </button>
                <a
                  href="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-center text-[#08080F] bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors duration-200"
                >
                  Essai gratuit
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <DemoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}

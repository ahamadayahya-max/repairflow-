
const legalLinks = [
  { label: 'Mentions légales', href: '#' },
  { label: 'CGU', href: '#' },
  { label: 'Politique de confidentialité', href: '#' },
  { label: 'Cookies', href: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-[#111118] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Logo + tagline */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <div>
            <a href="/" className="flex items-center mb-2">
              <img src="/logo-dark.svg" alt="ReparFlow" style={{ height: 32, width: 'auto' }} />
            </a>
            <p className="text-[#9CA3AF] text-sm max-w-xs">
              La solution de gestion pour les ateliers de réparation indépendants.
            </p>
          </div>
        </div>

        {/* Séparateur */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-[#9CA3AF] text-sm">
              © 2026 ReparFlow. Tous droits réservés.
            </p>
            <nav className="flex flex-wrap gap-4">
              {legalLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[#9CA3AF] hover:text-[#F1F0ED] text-sm transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

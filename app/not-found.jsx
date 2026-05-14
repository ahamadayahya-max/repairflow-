import Link from 'next/link'

/**
 * Page 404 globale Next.js.
 * Affichée automatiquement pour toutes les routes inexistantes.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0F0F1A] flex flex-col items-center justify-center
                    px-4 text-center">

      {/* Icône géante */}
      <div className="mb-6 select-none" style={{ fontSize: '80px', lineHeight: 1 }}>
        🔧
      </div>

      {/* Code d'erreur */}
      <h1 className="text-8xl font-black text-amber-400 mb-2 leading-none">404</h1>

      {/* Message principal */}
      <h2 className="text-xl font-bold text-white mb-3">Page introuvable</h2>

      {/* Description */}
      <p className="text-gray-500 text-sm max-w-sm mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
        Vérifiez l'URL ou retournez au tableau de bord.
      </p>

      {/* Bouton retour */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400
                   text-white font-semibold rounded-xl text-sm transition-colors"
      >
        Retour au tableau de bord
      </Link>

      {/* Lien landing page */}
      <Link
        href="/"
        className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        Accueil RepairFlow →
      </Link>
    </div>
  )
}

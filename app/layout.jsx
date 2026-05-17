import './globals.css'

export const metadata = {
  title: 'ReparFlow — Gérez vos réparations, informez vos clients automatiquement',
  description: 'ReparFlow suit chaque réparation, notifie vos clients par SMS et email, et vous fait gagner 2h par semaine sur les appels et relances.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/*
          Script anti-flash : applique le thème AVANT que React s'hydrate
          pour éviter le clignotement blanc→noir (ou inversement) au chargement.
          Ce script doit rester inline et synchrone — ne pas le déplacer.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('reparflow-theme')||'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

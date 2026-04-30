import './globals.css'

export const metadata = {
  title: 'RepairFlow — Gérez vos réparations, informez vos clients automatiquement',
  description: 'RepairFlow suit chaque réparation, notifie vos clients par SMS et email, et vous fait gagner 2h par semaine sur les appels et relances.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

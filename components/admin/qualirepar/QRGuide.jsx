'use client'

import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'

// ---------------------------------------------------------------------------
// Mode d'emploi QualiRépar — accordéon 4 étapes
// ---------------------------------------------------------------------------

const STEPS = [
  {
    num: '1', icon: '🔍', color: 'blue',
    title: 'Vérifiez l\'éligibilité',
    desc: 'Avant toute réparation, vérifiez si l\'appareil et la panne sont couverts par le bonus réparation.',
    details: [
      'Le produit doit figurer dans la liste officielle des équipements éligibles',
      'La marque détermine l\'éco-organisme payeur (Ecosystem ou Ecologic)',
      'Le montant du bonus varie selon le type d\'appareil',
    ],
    links: [
      { label: '📋 Tableau des produits éligibles', url: 'https://www.label-qualirepar.fr/les-produits-eligibles-au-fonds-reparation/', primary: true },
      { label: '💰 Montants de soutien par équipement', url: 'https://www.label-qualirepar.fr/wp-content/uploads/2022/07/soutiens-financiers-fonds-reparation.pdf', primary: false },
    ],
    tip: '💡 Dans RepairFlow, la vérification d\'éligibilité est automatique dès que vous créez un ticket — sélectionnez la marque et le type d\'appareil dans le panneau "Bonus QualiRépar".',
  },
  {
    num: '2', icon: '🧾', color: 'amber',
    title: 'Appliquez la réduction sur la facture',
    desc: 'Déduisez le montant du bonus directement sur la facture du client. C\'est vous qui avancez le montant.',
    details: [
      'La déduction se fait sur le montant TTC final',
      'Mentionnez explicitement "Bonus Réparation QualiRépar" sur la facture',
      'Indiquez le montant exact du bonus déduit',
      'Conservez une copie de la facture signée par le client',
    ],
    example: {
      label: 'Exemple de facture',
      lines: [
        { desc: 'Remplacement écran iPhone 13', price: '120,00 €', green: false, bold: false },
        { desc: 'Bonus Réparation QualiRépar',  price: '−25,00 €', green: true,  bold: false },
        { desc: 'NET À PAYER',                   price: '95,00 €',  green: false, bold: true  },
      ],
    },
    tip: '💡 RepairFlow génère automatiquement la facture PDF avec la mention "Bonus Réparation" et le bon montant déduit. Utilisez le bouton "Télécharger la facture PDF" sur la page du ticket.',
  },
  {
    num: '3', icon: '📸', color: 'purple',
    title: 'Photographiez et constituez le dossier',
    desc: 'Prenez les photos nécessaires pour justifier votre demande de remboursement auprès de l\'éco-organisme.',
    details: [
      'Photo de l\'appareil AVANT réparation',
      'Photo de l\'appareil APRÈS réparation',
      'Photo de la pièce remplacée (si applicable)',
      'Photo de la facture acquittée signée par le client',
    ],
    tip: '💡 Utilisez le bouton "📷 Prendre une photo" dans la section QualiRépar d\'un ticket. Les photos sont automatiquement attachées au dossier et incluses dans le PDF de facture.',
  },
  {
    num: '4', icon: '🏦', color: 'green',
    title: 'Demandez le remboursement',
    desc: 'Soumettez votre dossier à l\'éco-organisme correspondant. Le remboursement arrive sous 15 jours ouvrés.',
    details: [
      'Identifiez l\'éco-organisme selon la marque de l\'appareil',
      'Connectez-vous à la plateforme correspondante',
      'Soumettez le dossier avec toutes les pièces justificatives',
      'Le remboursement arrive par virement sous 15 jours ouvrés',
    ],
    platforms: [
      {
        name: 'Ecologic',
        logo: '🌱',
        brands: ['Huawei', 'LG', 'Bosch', 'Beko', 'Whirlpool', 'Dyson'],
        url: 'https://www.e-reparateur.eco/',
        color: 'green',
      },
      {
        name: 'Ecosystem',
        logo: '♻️',
        brands: ['Apple', 'Samsung', 'Sony', 'Xiaomi', 'Oppo', 'Nintendo'],
        url: 'https://portail-reparateurs.ecosystem.eco/',
        color: 'blue',
      },
    ],
    tip: '💡 RepairFlow détecte automatiquement l\'éco-organisme selon la marque et affiche le lien direct vers la bonne plateforme dans le panneau QualiRépar du ticket.',
  },
]

const BORDER_COLORS = {
  blue:   'border-blue-500/30',
  amber:  'border-amber-500/30',
  purple: 'border-purple-500/30',
  green:  'border-green-500/30',
}
const NUM_COLORS = {
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  green:  'bg-green-500/15 text-green-400 border-green-500/20',
}

/**
 * Mode d'emploi QualiRépar — accordéon 4 étapes.
 */
export default function QRGuide() {
  const [openStep, setOpenStep] = useState(0)

  return (
    <div className="space-y-4">

      {/* Intro */}
      <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🏷️</span>
        <div>
          <h2 className="font-bold text-amber-300 text-sm mb-1">
            Comment fonctionne le Bonus QualiRépar ?
          </h2>
          <p className="text-xs text-amber-400/80 leading-relaxed">
            En tant que réparateur labellisé, vous avancez le bonus à votre client en le déduisant
            de sa facture. Vous vous faites ensuite rembourser par l'éco-organisme sous 15 jours.
            RepairFlow automatise tout le processus.
          </p>
        </div>
      </div>

      {/* Étapes accordéon */}
      {STEPS.map((step, idx) => {
        const isOpen = openStep === idx
        return (
          <div
            key={idx}
            className={`border-2 rounded-xl overflow-hidden transition-all duration-200
              ${isOpen ? BORDER_COLORS[step.color] : 'border-white/8'}`}
          >
            {/* En-tête */}
            <button
              onClick={() => setOpenStep(isOpen ? -1 : idx)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold
                               border flex-shrink-0 ${NUM_COLORS[step.color]}`}>
                {step.num}
              </div>
              <span className="text-xl">{step.icon}</span>
              <span className="font-semibold text-white text-sm flex-1">{step.title}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200
                ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Contenu */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/5">

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed pt-3">{step.desc}</p>

                {/* Points clés */}
                <ul className="space-y-2">
                  {step.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-amber-400 font-bold flex-shrink-0 mt-0.5">✓</span>
                      {d}
                    </li>
                  ))}
                </ul>

                {/* Exemple facture (étape 2) */}
                {step.example && (
                  <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                    <div className="bg-white/8 px-4 py-2 text-xs font-semibold text-gray-400">
                      {step.example.label}
                    </div>
                    <div className="p-4 space-y-2 font-mono text-sm">
                      {step.example.lines.map((l, i) => (
                        <div
                          key={i}
                          className={`flex justify-between
                            ${l.bold ? 'font-bold border-t border-white/10 pt-2 text-white' : ''}
                            ${l.green ? 'text-green-400' : 'text-gray-300'}`}
                        >
                          <span>{l.desc}</span>
                          <span>{l.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plateformes (étape 4) */}
                {step.platforms && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {step.platforms.map(p => (
                      <a
                        key={p.name}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block border rounded-xl p-3.5 hover:border-opacity-60
                                    transition-all group
                                    ${p.color === 'green'
                                      ? 'border-green-500/20 bg-green-500/5 hover:bg-green-500/8'
                                      : 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/8'}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{p.logo}</span>
                          <div>
                            <p className="font-bold text-white text-sm">{p.name}</p>
                            <p className="text-xs text-gray-500">Plateforme de remboursement</p>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-600 ml-auto group-hover:text-amber-400 transition-colors" />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.brands.map(b => (
                            <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-full
                                                      bg-white/5 border border-white/10 text-gray-400">
                              {b}
                            </span>
                          ))}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Liens officiels (étape 1) */}
                {step.links && (
                  <div className="space-y-2">
                    {step.links.map(l => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
                                    font-medium transition-colors
                                    ${l.primary
                                      ? 'bg-amber-500 hover:bg-amber-400 text-gray-900'
                                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'}`}
                      >
                        {l.label}
                        <ExternalLink className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Astuce RepairFlow */}
                <div className="flex items-start gap-2 bg-white/3 border border-white/8 rounded-lg p-3">
                  <span className="text-base flex-shrink-0">🔧</span>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.tip}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Bonus PIEC */}
      <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">♻️</span>
        <div className="flex-1">
          <h3 className="font-bold text-purple-300 text-sm mb-1">+20 % avec une pièce PIEC</h3>
          <p className="text-xs text-purple-300/70 leading-relaxed mb-3">
            Si vous utilisez une <strong>Pièce Issue de l'Économie Circulaire (PIEC)</strong>,
            le bonus est majoré de 20 %. Vous devez fournir l'accord signé du client.
          </p>
          <a
            href="https://www.label-qualirepar.fr/piec"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500
                       text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            En savoir plus sur les PIEC
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

    </div>
  )
}

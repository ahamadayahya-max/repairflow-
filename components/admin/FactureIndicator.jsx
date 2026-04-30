'use client'

import { FileText, Info } from 'lucide-react'

/**
 * Indicateur de facture PDF dans le formulaire de création de ticket.
 * Affiche un résumé des prix et pièces si des données sont disponibles,
 * ou un message informatif si rien n'est encore renseigné.
 *
 * @param {{
 *   priceEstimate: number|null,
 *   priceFinal: number|null,
 *   selectedParts: Array<{ part: object, quantity: number, unitPrice: number }>,
 * }} props
 */
export default function FactureIndicator({ priceEstimate, priceFinal, selectedParts = [] }) {
  const laborPrice = priceFinal ?? priceEstimate ?? 0
  const partsCost  = selectedParts.reduce((sum, sp) => sum + sp.unitPrice * sp.quantity, 0)
  const totalHT    = laborPrice + partsCost
  const hasData    = laborPrice > 0 || selectedParts.length > 0

  if (!hasData) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-white/3 border border-white/8 rounded-xl">
        <Info className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          La facture PDF sera disponible après la création du ticket, une fois le prix
          et/ou les pièces renseignés.
        </p>
      </div>
    )
  }

  const tva      = totalHT * 0.2
  const totalTTC = totalHT + tva

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 space-y-2">
      {/* En-tête */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-300">Aperçu facture</span>
      </div>

      {/* Lignes de détail */}
      <div className="space-y-1 text-xs">
        {laborPrice > 0 && (
          <div className="flex justify-between text-gray-400">
            <span>Main d'œuvre</span>
            <span>{laborPrice.toFixed(2)} €</span>
          </div>
        )}
        {selectedParts.map((sp, i) => (
          <div key={i} className="flex justify-between text-gray-400">
            <span className="truncate max-w-[200px]">
              {sp.part.part_name}
              {sp.quantity > 1 && <span className="text-gray-600 ml-1">× {sp.quantity}</span>}
            </span>
            <span>{(sp.unitPrice * sp.quantity).toFixed(2)} €</span>
          </div>
        ))}
      </div>

      {/* Séparateur + totaux */}
      <div className="border-t border-white/10 pt-2 space-y-1 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>Sous-total HT</span>
          <span>{totalHT.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>TVA 20 %</span>
          <span>{tva.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between font-semibold text-amber-300">
          <span>Total TTC</span>
          <span>{totalTTC.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  )
}

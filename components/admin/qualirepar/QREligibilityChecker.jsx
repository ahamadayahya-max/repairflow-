'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'

// ---------------------------------------------------------------------------
// Widget de vérification d'éligibilité QualiRépar
// Utilisable dans la page QualiRépar ET dans le formulaire nouveau ticket
// ---------------------------------------------------------------------------

/**
 * Vérifie si une marque/type d'appareil est éligible au bonus QualiRépar.
 *
 * @param {{
 *   onResult?: (result: object|null) => void,
 *   defaultBrand?: string,
 * }} props
 */
export default function QREligibilityChecker({ onResult, defaultBrand = '' }) {
  const supabase = getSupabaseClient()

  const [brands,      setBrands]      = useState([])
  const [products,    setProducts]    = useState([])
  const [brand,       setBrand]       = useState(defaultBrand)
  const [productType, setProductType] = useState('')
  const [result,      setResult]      = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Charge les marques au montage
  useEffect(() => {
    supabase
      .from('qualirepar_brands')
      .select('id, name, eco_org')
      .order('name')
      .then(({ data }) => {
        setBrands(data ?? [])
        setLoadingData(false)
      })
  }, [])

  // Charge les types de produits quand la marque change
  useEffect(() => {
    if (!brand) { setProducts([]); setProductType(''); setResult(null); return }
    const selectedBrand = brands.find(b => b.id === brand)
    if (!selectedBrand) return

    supabase
      .from('qualirepar_product_types')
      .select('id, label, bonus_amount, has_threshold, threshold_amt')
      .eq('eco_org', selectedBrand.eco_org)
      .order('label')
      .then(({ data }) => setProducts(data ?? []))
  }, [brand, brands])

  async function checkEligibility() {
    if (!brand || !productType) return
    setLoading(true)

    const selectedBrand   = brands.find(b => b.id === brand)
    const selectedProduct = products.find(p => p.id === productType)

    if (selectedBrand && selectedProduct) {
      const res = {
        eligible:      true,
        eco_org:       selectedBrand.eco_org,
        brand_id:      selectedBrand.id,
        brand_name:    selectedBrand.name,
        product_id:    selectedProduct.id,
        product_label: selectedProduct.label,
        bonus_amount:  selectedProduct.bonus_amount,
        has_threshold: selectedProduct.has_threshold,
        threshold_amt: selectedProduct.threshold_amt,
        platform_url:  selectedBrand.eco_org === 'ecologic'
          ? 'https://www.e-reparateur.eco/'
          : 'https://portail-reparateurs.ecosystem.eco/',
        platform_name: selectedBrand.eco_org === 'ecologic' ? 'Ecologic' : 'Ecosystem',
      }
      setResult(res)
      onResult?.(res)
    } else {
      const res = { eligible: false }
      setResult(res)
      onResult?.(res)
    }

    setLoading(false)
  }

  if (loadingData) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement des données QualiRépar…
      </div>
    )
  }

  return (
    <div className="bg-[#111118] border border-white/10 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
          🔍 Vérifier l'éligibilité QualiRépar
        </h3>
        <p className="text-xs text-gray-500">
          Sélectionnez la marque et le type d'appareil pour connaître le bonus applicable.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Sélecteur marque */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Marque *</label>
          <select
            value={brand}
            onChange={e => { setBrand(e.target.value); setProductType(''); setResult(null) }}
            className="w-full bg-white/5 border border-white/10 text-sm text-white rounded-lg
                       px-3 py-2.5 focus:outline-none focus:border-amber-500/50 transition-colors"
          >
            <option value="" className="bg-[#111118]">Sélectionner une marque…</option>
            {brands.map(b => (
              <option key={b.id} value={b.id} className="bg-[#111118]">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sélecteur type de produit */}
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1 block">Type d'appareil *</label>
          <select
            value={productType}
            onChange={e => { setProductType(e.target.value); setResult(null) }}
            disabled={!brand || products.length === 0}
            className="w-full bg-white/5 border border-white/10 text-sm text-white rounded-lg
                       px-3 py-2.5 focus:outline-none focus:border-amber-500/50 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="" className="bg-[#111118]">
              {brand ? 'Sélectionner un type…' : 'Choisissez d\'abord une marque'}
            </option>
            {products.map(p => (
              <option key={p.id} value={p.id} className="bg-[#111118]">
                {p.label}{p.bonus_amount ? ` — ${p.bonus_amount} €` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bouton vérifier */}
      <button
        onClick={checkEligibility}
        disabled={!brand || !productType || loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm
                   font-semibold bg-amber-500 hover:bg-amber-400 text-gray-900 transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification…</>
          : '🔍 Vérifier l\'éligibilité'}
      </button>

      {/* ── Résultat ── */}
      {result && (
        <div className={`rounded-xl p-4 border ${result.eligible
          ? 'bg-green-500/8 border-green-500/20'
          : 'bg-red-500/8 border-red-500/20'}`}>

          {result.eligible ? (
            <div className="space-y-3">
              {/* Éligible */}
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-400 text-sm">Éligible au Bonus QualiRépar !</p>
                  <p className="text-xs text-green-500/80">{result.brand_name} — {result.product_label}</p>
                </div>
              </div>

              {/* Montant bonus */}
              <div className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                <span className="text-sm text-gray-400">Montant du bonus</span>
                <span className="text-2xl font-bold text-amber-400">{result.bonus_amount} €</span>
              </div>

              {/* Seuil si applicable */}
              {result.has_threshold && result.threshold_amt && (
                <div className="flex items-start gap-2 text-xs text-orange-400 bg-orange-500/8
                                border border-orange-500/20 rounded-lg p-2.5">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>
                    Seuil de déclenchement : la réparation doit coûter au minimum{' '}
                    <strong>{result.threshold_amt} €</strong> pour bénéficier du bonus.
                  </span>
                </div>
              )}

              {/* Éco-organisme + lien plateforme */}
              <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border
                ${result.eco_org === 'ecologic'
                  ? 'bg-green-500/8 border-green-500/20'
                  : 'bg-blue-500/8 border-blue-500/20'}`}>
                <div>
                  <p className="text-xs text-gray-500">Remboursement via</p>
                  <p className="text-sm font-bold text-white">{result.platform_name}</p>
                </div>
                <a
                  href={result.platform_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-400
                             hover:text-amber-300 transition-colors"
                >
                  Accéder <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-400 text-sm">Non éligible</p>
                <p className="text-xs text-red-400/70">
                  Ce type d'appareil ou cette marque ne fait pas partie du dispositif QualiRépar actuellement.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { printThermalTicket } from '@/lib/utils/thermalPrint'
import AIAssistant from '@/components/admin/AIAssistant'
import PartSearchDropdown from '@/components/admin/PartSearchDropdown'
import BrandDropdown from '@/components/admin/BrandDropdown'
import ModelDropdown from '@/components/admin/ModelDropdown'
import PhotoGallery from '@/components/admin/PhotoGallery'
import QualiReparPanel from '@/components/admin/QualiReparPanel'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft, Loader2, Smartphone, Laptop, Tablet,
  Tv, Package, Clock, CheckCircle2, Wrench, Truck,
  ExternalLink, AlertCircle, ChevronRight, RotateCcw, ChevronDown,
  Mail, MessageSquare, Send, Trash2, Plus, Minus, AlertTriangle,
  QrCode, FileText, Download, Printer, Receipt
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Config statuts
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  pending:   { label: 'En attente',    icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  in_repair: { label: 'En réparation', icon: Wrench,       color: 'text-blue-400',   bg: 'bg-blue-400/10   border-blue-400/20'   },
  ready:     { label: 'Prêt',          icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-400/10  border-green-400/20'  },
  delivered: { label: 'Livré',         icon: Truck,        color: 'text-gray-400',   bg: 'bg-gray-400/10   border-gray-400/20'   },
}

// Transitions autorisées — règle métier non-négociable
const NEXT_STATUS = {
  pending:   { value: 'in_repair', label: 'Passer en réparation', color: 'bg-blue-500 hover:bg-blue-400'   },
  in_repair: { value: 'ready',     label: 'Marquer comme prêt',   color: 'bg-green-500 hover:bg-green-400' },
  ready:     { value: 'delivered', label: 'Marquer comme livré',  color: 'bg-gray-500 hover:bg-gray-400'  },
  delivered: null,
}

const DEVICE_ICONS = { smartphone: Smartphone, tablet: Tablet, laptop: Laptop, tv: Tv }

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-200 text-right">{value ?? '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stepper visuel des statuts
// ---------------------------------------------------------------------------
const STATUS_STEPS = ['pending', 'in_repair', 'ready', 'delivered']

function StatusStepper({ currentStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(currentStatus)
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((s, i) => {
        const cfg  = STATUS_CONFIG[s]
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
              ${active ? `${cfg.bg} ${cfg.color}` :
                done   ? 'bg-white/10 border-white/20 text-gray-400' :
                         'bg-transparent border-white/5 text-gray-600'}`}>
              {active && <cfg.icon className="w-3 h-3" />}
              {done   && <CheckCircle2 className="w-3 h-3 text-gray-400" />}
              {cfg.label}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <ChevronRight className={`w-3 h-3 ${i < currentIdx ? 'text-gray-400' : 'text-gray-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TicketDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const supabase = getSupabaseClient()

  const [ticket,   setTicket]   = useState(null)
  const [parts,    setParts]    = useState([])
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState(null)
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionStatus, setCorrectionStatus] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  // État du panneau de notification client
  const [deleting,      setDeleting]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Pièces utilisées pour ce ticket
  const [ticketParts,   setTicketParts]   = useState([])
  const [partsLoading,  setPartsLoading]  = useState(false)

  const [notifChannel,  setNotifChannel]  = useState('email')  // 'email' | 'sms'
  const [notifTemplate, setNotifTemplate] = useState('')
  const [notifCustom,   setNotifCustom]   = useState('')
  const [notifSubject,  setNotifSubject]  = useState('')
  const [notifSending,  setNotifSending]  = useState(false)
  const [notifMsg,      setNotifMsg]      = useState(null)

  // SMS Twilio (Edge Function send-sms)
  const [smsTemplate, setSmsTemplate] = useState('')
  const [smsSending,  setSmsSending]  = useState(false)
  const [smsMsg,      setSmsMsg]      = useState(null)

  // État du QR code
  const [showQR, setShowQR] = useState(false)

  // Données shop (pour la facture PDF)
  const [shop, setShop] = useState({})

  // Photos du ticket (pour l'annexe PDF)
  const [ticketPhotos, setTicketPhotos] = useState([])

  // Facture liée au ticket (si déjà générée)
  const [ticketInvoice,      setTicketInvoice]      = useState(null)
  const [generatingInvoice,  setGeneratingInvoice]  = useState(false)

  // Génération PDF à la demande
  const [pdfGenerating,   setPdfGenerating]   = useState(false)
  // Impression thermique en cours
  const [thermalPrinting, setThermalPrinting] = useState(false)

  // Édition inline marque / modèle
  const [editingDevice, setEditingDevice] = useState(false)
  const [editBrand,     setEditBrand]     = useState(null)
  const [editModel,     setEditModel]     = useState(null)
  const [savingDevice,  setSavingDevice]  = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: ticketData, error: tErr } = await supabase
        .from('tickets')
        .select(`
          id, status, device_type, device_brand, device_model,
          issue_desc, issue_description, received_at, estimated_ready_at,
          tracking_token, shop_id, intake_channel, closed_at,
          price_estimate, price_final,
          qr_eligible, qr_montant, qr_eco_org, qr_status,
          qr_claim_id, qr_support_request_id, qr_invoice_url,
          qr_soumis_at, qr_paid_at, qr_error_message,
          qr_imei, qr_symptom_code, qr_repair_code,
          photos_count, qr_photos_count,
          ifixit_device_name, ifixit_category, ifixit_subcategory,
          ifixit_image_url, ifixit_device_id,
          clients!tickets_client_id_fkey ( id, full_name, first_name, last_name, phone, email )
        `)
        .eq('id', id)
        .single()

      if (tErr || !ticketData) {
        setError('Ticket introuvable.')
        setLoading(false)
        return
      }

      setTicket(ticketData)

      // Charge les données de l'atelier pour la facture PDF
      if (ticketData.shop_id) {
        const { data: shopData } = await supabase
          .from('shops')
          .select('name, phone, address, email, logo_url')
          .eq('id', ticketData.shop_id)
          .single()
        if (shopData) setShop(shopData)
      }

      if (ticketData.shop_id) {
        const { data: partsData } = await supabase
          .from('parts_inventory')
          .select('id, part_name, sku, qty_stock, unit_price')
          .eq('shop_id', ticketData.shop_id)
          .gt('qty_stock', 0)
          .order('part_name')
        // Normalise pour l'assistant IA
        if (partsData) setParts(partsData.map(p => ({
          id:        p.id,
          name:      p.part_name,
          reference: p.sku,
          stock:     p.qty_stock,
          price:     p.unit_price,
        })))
      }

      // Pièces déjà associées à ce ticket
      const { data: tpData } = await supabase
        .from('ticket_parts')
        .select('id, quantity, unit_price, part_id, parts_inventory(part_name, sku, qty_stock)')
        .eq('ticket_id', id)
        .order('added_at')
      if (tpData) setTicketParts(tpData)

      const { data: histData } = await supabase
        .from('ticket_status_history')
        .select('old_status, new_status, changed_at')
        .eq('ticket_id', id)
        .order('changed_at', { ascending: false })
      if (histData) setHistory(histData)

      // Photos avant/après/QualiRépar pour l'annexe PDF
      const { data: photosData } = await supabase
        .from('ticket_photos')
        .select('id, url, thumbnail_url, type, taken_at')
        .eq('ticket_id', id)
        .in('type', ['before', 'after', 'qualirepar'])
        .order('taken_at', { ascending: true })
      if (photosData) setTicketPhotos(photosData)

      // Vérifie si une facture a déjà été générée pour ce ticket
      const { data: invData } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total_net')
        .eq('ticket_id', id)
        .maybeSingle()
      if (invData) setTicketInvoice(invData)

      setLoading(false)
    }
    load()
  }, [id])

  // Changement de statut via l'API route (flux normal)
  const handleStatusChange = useCallback(async (newStatus) => {
    setUpdating(true)
    setUpdateMsg(null)

    try {
      const res = await fetch(`/api/tickets/${id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newStatus }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setTicket(prev => ({ ...prev, status: newStatus }))
      setUpdateMsg({ type: 'success', text: `Statut mis à jour : ${STATUS_CONFIG[newStatus].label}` })
      setTimeout(() => setUpdateMsg(null), 3000)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setUpdating(false)
    }
  }, [id])

  // Sauvegarde inline de la marque et du modèle
  async function handleSaveDevice() {
    if (!editBrand && !editModel) { setEditingDevice(false); return }
    setSavingDevice(true)
    try {
      const { error: uErr } = await supabase
        .from('tickets')
        .update({
          device_brand: editBrand  ?? ticket.device_brand,
          device_model: editModel  ?? ticket.device_model,
        })
        .eq('id', id)
      if (uErr) throw new Error(uErr.message)
      setTicket(prev => ({
        ...prev,
        device_brand: editBrand ?? prev.device_brand,
        device_model: editModel ?? prev.device_model,
      }))
      setEditingDevice(false)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: 'Impossible de mettre à jour l\'appareil : ' + err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setSavingDevice(false)
    }
  }

  // Correction admin : force n'importe quel statut avec motif obligatoire
  const handleForceStatus = useCallback(async () => {
    if (!correctionStatus || !correctionReason.trim() || correctionReason.trim().length < 5) return
    setUpdating(true)
    setUpdateMsg(null)

    try {
      const res = await fetch(`/api/tickets/${id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ newStatus: correctionStatus, force: true, reason: correctionReason.trim() }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setTicket(prev => ({ ...prev, status: correctionStatus }))
      setUpdateMsg({ type: 'success', text: `Correction appliquée : ${STATUS_CONFIG[correctionStatus].label}` })
      setShowCorrection(false)
      setCorrectionStatus('')
      setCorrectionReason('')
      setTimeout(() => setUpdateMsg(null), 3000)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setUpdating(false)
    }
  }, [id, correctionStatus, correctionReason])

  // Génération automatique d'une facture depuis le ticket (avec déduction QR si éligible)
  const generateInvoice = useCallback(async () => {
    if (!ticket) return
    setGeneratingInvoice(true)
    try {
      const { data: numData, error: numErr } = await supabase.rpc('next_document_number', {
        p_shop_id: ticket.shop_id,
        p_type:    'invoice',
      })
      if (numErr) throw numErr

      const labourCost  = Number(ticket.price_final ?? ticket.price_estimate ?? 0)
      const partsCost   = ticketParts.reduce(
        (s, tp) => s + (Number(tp.quantity) || 0) * (Number(tp.unit_price) || 0), 0
      )
      const qrDeduction = (ticket.qr_eligible && ticket.qr_montant) ? Number(ticket.qr_montant) : 0
      const today       = new Date().toISOString().split('T')[0]
      const dueDate     = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          shop_id:        ticket.shop_id,
          client_id:      ticket.client_id ?? ticket.contact_id,
          ticket_id:      ticket.id,
          invoice_number: numData,
          labour_cost:    labourCost,
          parts_cost:     partsCost,
          qr_deduction:   qrDeduction,
          tax_rate:       20,
          // total_ht / total_ttc / total_net sont GENERATED ALWAYS AS — PostgreSQL les calcule
          issue_date:     today,
          due_date:       dueDate,
          status:         'draft',
        })
        .select().single()
      if (invErr) throw invErr

      setTicketInvoice(inv)
      router.push(`/admin/factures/${inv.id}`)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: 'Erreur génération facture : ' + err.message })
      setTimeout(() => setUpdateMsg(null), 5000)
    } finally {
      setGeneratingInvoice(false)
    }
  }, [ticket, ticketParts, supabase, router])

  // Suppression définitive du ticket
  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const res  = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.replace('/admin/tickets')
    } catch (err) {
      setUpdateMsg({ type: 'error', text: `Erreur suppression : ${err.message}` })
      setTimeout(() => setUpdateMsg(null), 4000)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }, [id, router])

  // Envoi d'une notification (email ou SMS) au client
  const handleNotify = useCallback(async () => {
    if (!notifTemplate) return
    setNotifSending(true)
    setNotifMsg(null)

    try {
      const res = await fetch(`/api/tickets/${id}/notify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          channel:   notifChannel,
          template:  notifTemplate,
          customMsg: notifCustom,
          subject:   notifSubject,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      const label = notifChannel === 'email' ? 'Email envoyé ✅' : 'SMS envoyé ✅'
      setNotifMsg({ type: 'success', text: label, link: null })
      setNotifCustom('')
      setNotifSubject('')
      setTimeout(() => setNotifMsg(null), 4000)
    } catch (err) {
      // Détecte l'erreur de crédits SMS et extrait le lien
      const msg  = err.message ?? ''
      const link = msg.includes('http') ? msg.match(/https?:\/\/\S+/)?.[0] : null
      const text = link ? msg.replace(link, '').replace('Achetez des crédits ici :', '').trim() : msg
      setNotifMsg({ type: 'error', text, link })
      setTimeout(() => setNotifMsg(null), 10000)
    } finally {
      setNotifSending(false)
    }
  }, [id, notifChannel, notifTemplate, notifCustom, notifSubject])

  // ---------------------------------------------------------------------------
  // SMS Twilio via Edge Function send-sms
  // ---------------------------------------------------------------------------

  const handleSmsTwilio = useCallback(async () => {
    if (!smsTemplate) return
    setSmsSending(true)
    setSmsMsg(null)

    try {
      const res  = await fetch('/api/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticket_id: id, template: smsTemplate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const label = data.status === 'simulated'
        ? 'SMS simulé ✅ (Twilio non configuré)'
        : 'SMS envoyé ✅'
      setSmsMsg({ type: 'success', text: label })
      setSmsTemplate('')
      setTimeout(() => setSmsMsg(null), 4000)
    } catch (err) {
      setSmsMsg({ type: 'error', text: err.message })
      setTimeout(() => setSmsMsg(null), 5000)
    } finally {
      setSmsSending(false)
    }
  }, [id, smsTemplate])

  // ---------------------------------------------------------------------------
  // Gestion des pièces utilisées
  // ---------------------------------------------------------------------------

  const handleAddPart = useCallback(async (part) => {
    // Vérifie si la pièce est déjà dans la liste
    if (ticketParts.some(tp => tp.part_id === part.id)) return

    setPartsLoading(true)
    const { data, error } = await supabase
      .from('ticket_parts')
      .insert({
        ticket_id:  id,
        part_id:    part.id,
        quantity:   1,
        unit_price: part.unit_price,
      })
      .select('id, quantity, unit_price, part_id, parts_inventory(part_name, sku, qty_stock)')
      .single()

    if (!error && data) {
      setTicketParts(prev => [...prev, data])
    }
    setPartsLoading(false)
  }, [id, ticketParts, supabase])

  const handleRemovePart = useCallback(async (ticketPartId) => {
    setPartsLoading(true)
    const { error } = await supabase
      .from('ticket_parts')
      .delete()
      .eq('id', ticketPartId)

    if (!error) {
      setTicketParts(prev => prev.filter(tp => tp.id !== ticketPartId))
    }
    setPartsLoading(false)
  }, [supabase])

  const handleChangeQty = useCallback(async (ticketPartId, delta) => {
    const tp  = ticketParts.find(t => t.id === ticketPartId)
    if (!tp) return
    const newQty = Math.max(1, tp.quantity + delta)

    const { error } = await supabase
      .from('ticket_parts')
      .update({ quantity: newQty })
      .eq('id', ticketPartId)

    if (!error) {
      setTicketParts(prev =>
        prev.map(t => t.id === ticketPartId ? { ...t, quantity: newQty } : t)
      )
    }
  }, [ticketParts, supabase])

  // Génération et téléchargement du PDF de facture côté client
  const handleDownloadPDF = useCallback(async () => {
    setPdfGenerating(true)
    try {
      const [{ default: InvoicePDFComp }, { pdf }, { createElement }] = await Promise.all([
        import('@/components/admin/InvoicePDF'),
        import('@react-pdf/renderer'),
        import('react'),
      ])
      const blob = await pdf(
        createElement(InvoicePDFComp, {
          ticket:      ticket,
          shop:        shop,
          client:      ticket.clients,
          ticketParts: ticketParts,
          photos:      ticketPhotos,
        })
      ).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const name = [ticket.clients?.first_name, ticket.clients?.last_name]
        .filter(Boolean).join('-') || ticket.clients?.full_name || 'client'
      a.href     = url
      a.download = `facture-RF-${(ticket.id ?? '').slice(0, 8).toUpperCase()}-${name}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: 'Erreur génération PDF : ' + err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setPdfGenerating(false)
    }
  }, [ticket, shop, ticketParts, ticketPhotos])

  // Aperçu du PDF dans un nouvel onglet (sans téléchargement)
  const handlePreviewPDF = useCallback(async () => {
    setPdfGenerating(true)
    try {
      const [{ default: InvoicePDFComp }, { pdf }, { createElement }] = await Promise.all([
        import('@/components/admin/InvoicePDF'),
        import('@react-pdf/renderer'),
        import('react'),
      ])
      const blob = await pdf(
        createElement(InvoicePDFComp, {
          ticket:      ticket,
          shop:        shop,
          client:      ticket.clients,
          ticketParts: ticketParts,
          photos:      ticketPhotos,
        })
      ).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Libère l'URL après 60 s — le temps que le nouvel onglet charge le PDF
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: 'Erreur aperçu PDF : ' + err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setPdfGenerating(false)
    }
  }, [ticket, shop, ticketParts, ticketPhotos])

  // Impression du bon de dépôt client (ouvre le dialogue d'impression natif)
  const handlePrintReceipt = useCallback(async () => {
    setPdfGenerating(true)
    try {
      const [{ TicketReceiptPDF }, { pdf }, { createElement }, QRCode] = await Promise.all([
        import('@/components/admin/pdf/TicketReceiptPDF'),
        import('@react-pdf/renderer'),
        import('react'),
        import('qrcode').then(m => m.default),
      ])
      const trackingUrl = `https://repairflow-app.vercel.app/suivi/${ticket.tracking_token}`
      const qrDataUrl   = await QRCode.toDataURL(trackingUrl, { width: 200, margin: 1 })
      const blob = await pdf(
        createElement(TicketReceiptPDF, { ticket, shop, qrCodeDataUrl: qrDataUrl })
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.onload = () => {
          win.print()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
        }
      }
    } catch (err) {
      setUpdateMsg({ type: 'error', text: 'Erreur impression bon de dépôt : ' + err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setPdfGenerating(false)
    }
  }, [ticket, shop])

  // Téléchargement du bon de dépôt en PDF
  const handleDownloadReceipt = useCallback(async () => {
    setPdfGenerating(true)
    try {
      const [{ TicketReceiptPDF }, { pdf }, { createElement }, QRCode] = await Promise.all([
        import('@/components/admin/pdf/TicketReceiptPDF'),
        import('@react-pdf/renderer'),
        import('react'),
        import('qrcode').then(m => m.default),
      ])
      const trackingUrl = `https://repairflow-app.vercel.app/suivi/${ticket.tracking_token}`
      const qrDataUrl   = await QRCode.toDataURL(trackingUrl, { width: 200, margin: 1 })
      const blob = await pdf(
        createElement(TicketReceiptPDF, { ticket, shop, qrCodeDataUrl: qrDataUrl })
      ).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `bon-depot-RF-${(ticket.id ?? '').slice(0, 8).toUpperCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: 'Erreur téléchargement bon de dépôt : ' + err.message })
      setTimeout(() => setUpdateMsg(null), 4000)
    } finally {
      setPdfGenerating(false)
    }
  }, [ticket, shop])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-red-400 font-medium">{error}</p>
        <Link href="/admin/tickets" className="text-sm text-gray-400 hover:text-white">← Retour</Link>
      </div>
    )
  }

  const statusCfg  = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending
  const nextStatus = NEXT_STATUS[ticket.status]
  const DeviceIcon = DEVICE_ICONS[ticket.device_type] ?? Package
  const issueText  = ticket.issue_desc ?? ticket.issue_description ?? null

  // Génération PDF possible uniquement si un prix est renseigné ou des pièces sont présentes
  const canGenerateInvoice =
    (ticket.price_final    != null && ticket.price_final    > 0) ||
    (ticket.price_estimate != null && ticket.price_estimate > 0) ||
    ticketParts.length > 0

  const ticketForAI = {
    id:                 ticket.id,
    device_type:        ticket.device_type,
    device_brand:       ticket.device_brand,
    device_model:       ticket.device_model,
    issue_description:  issueText,
    status:             ticket.status,
    received_at:        ticket.received_at,
    estimated_ready_at: ticket.estimated_ready_at,
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-white font-bold text-xl">Détail du ticket</h1>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{ticket.id}</p>
          </div>
        </div>

        {/* Bouton supprimer */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                       bg-red-500/10 border border-red-500/20 text-red-400
                       hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400 font-medium">Confirmer ?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                         bg-red-500 hover:bg-red-400 text-white transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Suppression…</>
                : <><Trash2 className="w-3 h-3" /> Oui, supprimer</>
              }
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10
                         text-gray-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Stepper statuts */}
      <div className="mb-6 overflow-x-auto">
        <StatusStepper currentStatus={ticket.status} />
      </div>

      {/* Message de confirmation */}
      {updateMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border
          ${updateMsg.type === 'success'
            ? 'bg-green-400/10 border-green-400/20 text-green-400'
            : 'bg-red-400/10 border-red-400/20 text-red-400'
          }`}>
          {updateMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* ── Colonne gauche ── */}
        <div className="space-y-4">

          {/* Carte statut + appareil */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Image iFixit si disponible, sinon icône générique */}
                {ticket.ifixit_image_url ? (
                  <img
                    src={ticket.ifixit_image_url}
                    alt={ticket.ifixit_device_name ?? ticket.device_model}
                    className="w-8 h-8 rounded object-cover bg-white/5 flex-shrink-0"
                  />
                ) : (
                  <DeviceIcon className="w-5 h-5 text-amber-400" />
                )}
                <h2 className="text-white font-semibold">
                  {ticket.ifixit_device_name
                    || [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ')
                    || ticket.device_type}
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
                <statusCfg.icon className="w-3 h-3" />
                {statusCfg.label}
              </span>
            </div>

            <InfoRow label="Type d'appareil" value={ticket.device_type} />

            {/* Marque + Modèle — éditables en ligne */}
            {editingDevice ? (
              <div className="py-3 border-b border-white/5 space-y-3">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Marque</p>
                  <BrandDropdown
                    value={editBrand ?? ticket.device_brand}
                    onChange={v => { setEditBrand(v); setEditModel(null) }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Modèle</p>
                  <ModelDropdown
                    brand={editBrand ?? ticket.device_brand}
                    value={editModel ?? ticket.device_model}
                    onChange={setEditModel}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveDevice}
                    disabled={savingDevice}
                    className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50
                               text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    {savingDevice ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Enregistrer'}
                  </button>
                  <button
                    onClick={() => { setEditingDevice(false); setEditBrand(null); setEditModel(null) }}
                    className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10
                               text-gray-400 text-xs font-semibold hover:bg-white/10 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                  <span className="text-xs text-gray-500 shrink-0">Marque</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200">{ticket.device_brand ?? '—'}</span>
                    <button
                      onClick={() => {
                        setEditBrand(ticket.device_brand ?? null)
                        setEditModel(ticket.device_model ?? null)
                        setEditingDevice(true)
                      }}
                      className="text-[10px] text-gray-600 hover:text-amber-400 transition-colors"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                  <span className="text-xs text-gray-500 shrink-0">Modèle</span>
                  <span className="text-sm text-gray-200">{ticket.device_model ?? '—'}</span>
                </div>
              </>
            )}

            {/* Lien iFixit si appareil identifié */}
            {ticket.ifixit_device_id && (
              <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                <span className="text-xs text-gray-500 shrink-0">iFixit</span>
                <a
                  href={`https://www.ifixit.com/Device/${ticket.ifixit_device_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                >
                  Guide de réparation
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <InfoRow label="Reçu le"         value={formatDate(ticket.received_at)} />
            <InfoRow label="Prêt estimé"     value={formatDate(ticket.estimated_ready_at)} />
            <InfoRow label="Canal d'entrée"  value={ticket.intake_channel} />

            {/* Bouton changement de statut */}
            {nextStatus && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => handleStatusChange(nextStatus.value)}
                  disabled={updating}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                    text-white text-sm font-semibold transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${nextStatus.color}`}
                >
                  {updating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mise à jour…</>
                    : <><ChevronRight className="w-4 h-4" /> {nextStatus.label}</>
                  }
                </button>
              </div>
            )}

            {ticket.status === 'delivered' && (
              <div className="mt-4 pt-4 border-t border-white/5 text-center">
                <p className="text-xs text-gray-500">✅ Ticket clôturé — aucune action disponible</p>
              </div>
            )}

            {/* Panneau de correction admin */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowCorrection(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Correction admin
                <ChevronDown className={`w-3 h-3 transition-transform ${showCorrection ? 'rotate-180' : ''}`} />
              </button>

              {showCorrection && (
                <div className="mt-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-3">
                  <p className="text-xs text-orange-400 font-medium">
                    ⚠️ Action exceptionnelle — choisissez le statut cible et indiquez le motif
                  </p>

                  {/* Sélecteur de statut */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      key !== ticket.status && (
                        <button
                          key={key}
                          onClick={() => setCorrectionStatus(key)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all
                            ${correctionStatus === key
                              ? `${cfg.bg} ${cfg.color} border-current`
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </button>
                      )
                    ))}
                  </div>

                  {/* Motif obligatoire */}
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={e => setCorrectionReason(e.target.value)}
                    placeholder="Motif de la correction (obligatoire)…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                               placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />

                  {/* Bouton de confirmation */}
                  <button
                    onClick={handleForceStatus}
                    disabled={!correctionStatus || correctionReason.trim().length < 5 || updating}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold
                               bg-orange-500 hover:bg-orange-400 text-white transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {updating
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Application…</>
                      : <><RotateCcw className="w-3 h-3" /> Appliquer la correction</>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Problème signalé */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Problème signalé</h3>
            <p className="text-gray-200 text-sm leading-relaxed">
              {issueText ?? <span className="text-gray-500 italic">Non renseigné</span>}
            </p>
          </div>

          {/* Client */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Client</h3>
            <InfoRow label="Nom"       value={ticket.clients?.full_name} />
            <InfoRow label="Téléphone" value={ticket.clients?.phone} />
            <InfoRow label="Email"     value={ticket.clients?.email} />
          </div>

          {/* Panneau de notification client */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Send className="w-3.5 h-3.5" />
              Notifier le client
            </h3>

            {/* Sélecteur canal */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNotifChannel('email')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${notifChannel === 'email'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
              >
                <Mail className="w-3 h-3" /> Email
              </button>
              <button
                onClick={() => setNotifChannel('sms')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${notifChannel === 'sms'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
              >
                <MessageSquare className="w-3 h-3" /> SMS
              </button>
            </div>

            {/* Sélecteur de template */}
            <select
              value={notifTemplate}
              onChange={e => setNotifTemplate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                         focus:outline-none focus:border-amber-500/50 transition-colors mb-3"
            >
              <option value="">— Choisir un message —</option>
              <option value="received">✅ Confirmation de réception</option>
              <option value="in_repair">🔧 Réparation en cours</option>
              <option value="waiting_parts">⏳ En attente d'une pièce</option>
              <option value="ready">🎉 Appareil prêt à récupérer</option>
              <option value="delivered">⭐ Merci + demande d'avis</option>
              <option value="diagnosed">🔍 Diagnostic terminé — devis</option>
              <option value="cancelled">❌ Dossier clôturé</option>
              <option value="custom">✏️ Message personnalisé</option>
            </select>

            {/* Champs message personnalisé */}
            {notifTemplate === 'custom' && (
              <div className="space-y-2 mb-3">
                {notifChannel === 'email' && (
                  <input
                    type="text"
                    value={notifSubject}
                    onChange={e => setNotifSubject(e.target.value)}
                    placeholder="Objet de l'email…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                               placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                )}
                <textarea
                  value={notifCustom}
                  onChange={e => setNotifCustom(e.target.value)}
                  placeholder={notifChannel === 'sms' ? 'Votre SMS (max 160 caractères)…' : 'Corps de l\'email…'}
                  rows={3}
                  maxLength={notifChannel === 'sms' ? 160 : undefined}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                             placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                />
                {notifChannel === 'sms' && (
                  <p className="text-right text-[10px] text-gray-600">{notifCustom.length}/160</p>
                )}
              </div>
            )}

            {/* Message de retour */}
            {notifMsg && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-xs border
                ${notifMsg.type === 'success'
                  ? 'bg-green-400/10 border-green-400/20 text-green-400'
                  : 'bg-red-400/10 border-red-400/20 text-red-400'
                }`}>
                {notifMsg.text}
                {notifMsg.link && (
                  <a
                    href={notifMsg.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1 underline font-semibold hover:opacity-80"
                  >
                    👉 Acheter des crédits SMS Brevo
                  </a>
                )}
              </div>
            )}

            {/* Bouton d'envoi */}
            <button
              onClick={handleNotify}
              disabled={
                !notifTemplate ||
                notifSending ||
                (notifTemplate === 'custom' && !notifCustom.trim())
              }
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold
                         text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                         ${notifChannel === 'email'
                           ? 'bg-blue-500 hover:bg-blue-400'
                           : 'bg-green-500 hover:bg-green-400'}`}
            >
              {notifSending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi en cours…</>
                : notifChannel === 'email'
                  ? <><Mail className="w-3.5 h-3.5" /> Envoyer l'email</>
                  : <><MessageSquare className="w-3.5 h-3.5" /> Envoyer le SMS</>
              }
            </button>
          </div>

          {/* Pièces utilisées pour ce ticket */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" />
              Pièces utilisées
              {partsLoading && <Loader2 className="w-3 h-3 text-amber-400 animate-spin ml-auto" />}
            </h3>

            {/* Autocomplete pour ajouter une pièce */}
            <PartSearchDropdown
              filterShopId={ticket.shop_id}
              onSelect={handleAddPart}
              placeholder="Ajouter une pièce…"
              className="mb-3"
            />

            {/* Liste des pièces associées */}
            {ticketParts.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-3">Aucune pièce ajoutée</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {ticketParts.map(tp => {
                  const info      = tp.parts_inventory
                  const inStock   = info?.qty_stock > 0
                  const lineTotal = (tp.unit_price ?? 0) * tp.quantity

                  return (
                    <div
                      key={tp.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5"
                    >
                      {/* Indicateur stock */}
                      {inStock
                        ? <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" title="En stock" />
                        : <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" title="Rupture de stock" />
                      }

                      {/* Nom + ref */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 truncate">{info?.part_name ?? '—'}</p>
                        {info?.sku && <p className="text-[10px] text-gray-600 font-mono">{info.sku}</p>}
                      </div>

                      {/* Quantité */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleChangeQty(tp.id, -1)}
                          disabled={tp.quantity <= 1}
                          className="w-5 h-5 flex items-center justify-center rounded bg-white/5
                                     text-gray-400 hover:text-white hover:bg-white/10 transition-colors
                                     disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-gray-200 w-5 text-center font-mono">{tp.quantity}</span>
                        <button
                          onClick={() => handleChangeQty(tp.id, +1)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-white/5
                                     text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Prix total ligne */}
                      {tp.unit_price != null && (
                        <span className="text-xs text-gray-400 w-14 text-right shrink-0">
                          {lineTotal.toFixed(2)} €
                        </span>
                      )}

                      {/* Supprimer */}
                      <button
                        onClick={() => handleRemovePart(tp.id)}
                        className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-white/5 transition-colors"
                        title="Retirer la pièce"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}

                {/* Total */}
                {ticketParts.some(tp => tp.unit_price != null) && (
                  <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-1">
                    <span className="text-xs text-gray-500">Total pièces</span>
                    <span className="text-sm font-semibold text-amber-400">
                      {ticketParts.reduce((acc, tp) => acc + (tp.unit_price ?? 0) * tp.quantity, 0).toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Photos de réparation ── */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>📸</span>
              Photos
              {ticket.photos_count > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded-full font-semibold">
                  {ticket.photos_count}
                </span>
              )}
            </h3>
            {ticket.shop_id && (
              <PhotoGallery
                ticketId={ticket.id}
                shopId={ticket.shop_id}
                mode="full"
              />
            )}
          </div>

          {/* ── QualiRépar ── */}
          <QualiReparPanel
            ticketId={ticket.id}
            shopId={ticket.shop_id}
            qualirepar_status={ticket.qr_status}
            qr_eligible={ticket.qr_eligible}
            qr_montant={ticket.qr_montant}
            qr_eco_org={ticket.qr_eco_org}
            qr_claim_id={ticket.qr_claim_id}
            qr_support_request_id={ticket.qr_support_request_id}
            qr_invoice_url={ticket.qr_invoice_url}
            qr_soumis_at={ticket.qr_soumis_at}
            qr_paid_at={ticket.qr_paid_at}
            qr_error_message={ticket.qr_error_message}
            qr_imei={ticket.qr_imei}
            qr_symptom_code={ticket.qr_symptom_code}
            qr_repair_code={ticket.qr_repair_code}
            device_type={ticket.device_type}
            device_brand={ticket.device_brand}
            qr_photos_count={ticket.qr_photos_count ?? 0}
          />

          {/* ── Facturation — génération depuis le ticket ── */}
          <div className="space-y-2">
            {!ticketInvoice && ticket.qr_eligible && (
              <button
                onClick={generateInvoice}
                disabled={generatingInvoice}
                className="w-full flex items-center gap-3 px-4 py-4
                           bg-amber-500/15 border border-amber-500/25
                           hover:bg-amber-500/25 rounded-xl transition-colors
                           disabled:opacity-50 text-left"
              >
                {generatingInvoice
                  ? <Loader2 className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
                  : <span className="text-xl flex-shrink-0">🧾</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-amber-300">
                    Générer la facture avec Bonus QualiRépar
                  </div>
                  <div className="text-xs text-amber-400/70 mt-0.5">
                    Réduction de {ticket.qr_montant} € appliquée automatiquement
                  </div>
                </div>
                {!generatingInvoice && <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />}
              </button>
            )}

            {!ticketInvoice && !ticket.qr_eligible && (
              <Link
                href={`/admin/factures/nouvelle?ticket=${ticket.id}`}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium
                           text-gray-400 bg-white/5 border border-white/10
                           hover:bg-white/10 hover:text-white rounded-xl transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Créer une facture
              </Link>
            )}

            {ticketInvoice && (
              <Link
                href={`/admin/factures/${ticketInvoice.id}`}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold
                           text-amber-300 bg-amber-500/10 border border-amber-500/20
                           hover:bg-amber-500/20 rounded-xl transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Voir la facture {ticketInvoice.invoice_number}
              </Link>
            )}
          </div>

          {/* ── Liens suivi + QR code ── */}
          {ticket.tracking_token && (
            <div className="bg-[#111118] rounded-xl border border-white/10 p-4 space-y-3">

              {/* Lien page de suivi */}
              <a
                href={`/suivi/${ticket.tracking_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Voir la page de suivi client
              </a>

              {/* Toggle QR code */}
              <button
                onClick={() => setShowQR(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <QrCode className="w-4 h-4" />
                {showQR ? 'Masquer le QR code' : 'Afficher le QR code'}
              </button>

              {showQR && (
                <div className="flex flex-col items-center gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl" id="qr-print-zone">
                    <QRCodeSVG
                      value={`https://repairflow-app.vercel.app/suivi/${ticket.tracking_token}`}
                      size={160}
                      level="M"
                      includeMargin={false}
                    />
                    <p className="text-center text-[10px] text-gray-500 mt-1 font-mono">
                      {ticket.tracking_token}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Ouvre une fenêtre d'impression ciblée sur le QR code
                      const zone = document.getElementById('qr-print-zone')
                      const win  = window.open('', '_blank', 'width=300,height=300')
                      win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh">${zone.innerHTML}</body></html>`)
                      win.document.close()
                      win.print()
                    }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer le QR code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Bon de dépôt ── */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Printer className="w-3.5 h-3.5" />
              Bon de dépôt
            </h3>
            <div className="flex gap-2 flex-wrap">
              {/* Impression thermique 58mm — priorité si imprimante thermique branchée */}
              <button
                onClick={async () => {
                  setThermalPrinting(true)
                  try {
                    await printThermalTicket(ticket, shop)
                  } finally {
                    setThermalPrinting(false)
                  }
                }}
                disabled={thermalPrinting || pdfGenerating}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                           bg-gray-800 hover:bg-gray-700 text-white transition-colors
                           disabled:opacity-50 disabled:cursor-wait"
              >
                {thermalPrinting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Impression…</>
                  : <>🖨️ Ticket thermique</>
                }
              </button>
              <button
                onClick={handlePrintReceipt}
                disabled={pdfGenerating || thermalPrinting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                           bg-amber-500 hover:bg-amber-400 text-white transition-colors
                           disabled:opacity-50 disabled:cursor-wait"
              >
                {pdfGenerating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</>
                  : <><Printer className="w-3.5 h-3.5" /> Imprimer le bon</>
                }
              </button>
              <button
                onClick={handleDownloadReceipt}
                disabled={pdfGenerating || thermalPrinting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                           bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300
                           transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {pdfGenerating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</>
                  : <><Download className="w-3.5 h-3.5" /> Télécharger PDF</>
                }
              </button>
            </div>
          </div>

          {/* ── Facture PDF ── */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Facture
            </h3>
            {canGenerateInvoice ? (
              <div className="flex gap-2 flex-wrap">
                {/* Aperçu dans un nouvel onglet */}
                <button
                  onClick={handlePreviewPDF}
                  disabled={pdfGenerating}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                             bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300
                             transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {pdfGenerating
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</>
                    : <>👁 Aperçu facture</>
                  }
                </button>
                {/* Téléchargement direct */}
                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfGenerating}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold
                             bg-amber-500 hover:bg-amber-400 text-white transition-colors
                             disabled:opacity-50 disabled:cursor-wait"
                >
                  {pdfGenerating
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</>
                    : <><Download className="w-3.5 h-3.5" /> Télécharger la facture PDF</>
                  }
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">
                Renseignez le prix final ou ajoutez des pièces pour générer la facture.
              </p>
            )}
          </div>

          {/* ── SMS Twilio ── */}
          <div className="bg-[#111118] rounded-xl border border-white/10 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Envoyer un SMS
            </h3>

            <select
              value={smsTemplate}
              onChange={e => setSmsTemplate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                         focus:outline-none focus:border-amber-500/50 transition-colors mb-3"
            >
              <option value="">— Choisir un message —</option>
              <option value="received">📥 Appareil reçu</option>
              <option value="in_repair">🔧 En cours de réparation</option>
              <option value="ready">✅ Prêt à récupérer</option>
              <option value="devis">💬 Envoyer le devis</option>
            </select>

            {smsMsg && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-xs border
                ${smsMsg.type === 'success'
                  ? 'bg-green-400/10 border-green-400/20 text-green-400'
                  : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
                {smsMsg.text}
              </div>
            )}

            <button
              onClick={handleSmsTwilio}
              disabled={!smsTemplate || smsSending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold
                         bg-green-500 hover:bg-green-400 text-white transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {smsSending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi…</>
                : <><Send className="w-3.5 h-3.5" /> Envoyer le SMS</>
              }
            </button>
          </div>

        </div>

        {/* ── Colonne droite : Assistant IA ── */}
        <div className="flex flex-col" style={{ minHeight: '560px' }}>
          <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            Assistant IA
          </h2>
          <div className="flex-1">
            <AIAssistant ticket={ticketForAI} parts={parts} statusHistory={history} />
          </div>
        </div>

      </div>
    </div>
  )
}

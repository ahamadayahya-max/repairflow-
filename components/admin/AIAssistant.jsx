'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Copy, Check, Trash2, Loader2, Zap } from 'lucide-react'

// ---------------------------------------------------------------------------
// Raccourcis prédéfinis — injectent un message utilisateur instantanément
// ---------------------------------------------------------------------------
const SHORTCUTS = [
  { label: 'Aide au diagnostic',  icon: '🔍', prompt: 'Aide-moi à diagnostiquer ce problème. Quelles sont les causes les plus probables et comment les tester ?' },
  { label: 'Suggérer des pièces', icon: '🔧', prompt: 'Quelles pièces de rechange me conseilles-tu pour cette réparation, en tenant compte du stock disponible ?' },
  { label: 'Rédiger un SMS',      icon: '📱', prompt: 'Rédige un SMS professionnel à envoyer au client pour l\'informer du statut de sa réparation.' },
  { label: 'Rédiger un email',    icon: '✉️',  prompt: 'Rédige un email professionnel à envoyer au client concernant sa réparation.' },
  { label: 'Estimer le délai',    icon: '⏱️',  prompt: 'Estime le délai réaliste pour cette réparation et explique les étapes nécessaires.' },
]

// ---------------------------------------------------------------------------
// Composant CopyButton — bouton copier avec feedback visuel
// ---------------------------------------------------------------------------

/**
 * Bouton de copie avec état "copié" temporaire.
 * @param {{ text: string }} props
 */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [text])

  return (
    <button
      onClick={handleCopy}
      title="Copier le message"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-white/5"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-400" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  )
}

// ---------------------------------------------------------------------------
// Composant MessageBubble — affiche un message utilisateur ou assistant
// ---------------------------------------------------------------------------

/**
 * Bulle de message individuelle.
 * @param {{ role: 'user'|'assistant', content: string, isStreaming?: boolean }} props
 */
function MessageBubble({ role, content, isStreaming = false }) {
  const isAssistant = role === 'assistant'

  return (
    <div className={`flex gap-2.5 ${isAssistant ? 'items-start' : 'items-start flex-row-reverse'}`}>

      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5
        ${isAssistant ? 'bg-amber-500/20' : 'bg-white/10'}
      `}>
        {isAssistant
          ? <Bot className="w-4 h-4 text-amber-400" />
          : <User className="w-4 h-4 text-gray-300" />
        }
      </div>

      {/* Bulle de texte */}
      <div className={`
        group relative max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed
        ${isAssistant
          ? 'bg-[#1A1A27] text-gray-100 rounded-tl-sm'
          : 'bg-amber-500/10 text-gray-100 rounded-tr-sm border border-amber-500/20'
        }
      `}>
        {/* Indicateur de frappe en cours */}
        {isStreaming && content === '' ? (
          <span className="flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : (
          <p className="whitespace-pre-wrap">{content}{isStreaming && <span className="inline-block w-0.5 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />}</p>
        )}

        {/* Bouton copier (uniquement pour les messages assistant terminés) */}
        {isAssistant && !isStreaming && content && (
          <div className="absolute -bottom-5 right-0 flex">
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant principal AIAssistant
// ---------------------------------------------------------------------------

/**
 * Assistant IA interne pour les réparateurs.
 * Envoie les messages à /api/ai-assistant et affiche la réponse en streaming.
 *
 * @param {{
 *   ticket?:        object,
 *   parts?:         array,
 *   statusHistory?: array
 * }} props
 */
export default function AIAssistant({ ticket = null, parts = [], statusHistory = [] }) {
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const scrollRef    = useRef(null)
  const textareaRef  = useRef(null)
  const abortRef     = useRef(null)

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize du textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  /**
   * Envoie un message et consomme le flux SSE de réponse.
   * @param {string} userText — texte à envoyer
   */
  const sendMessage = useCallback(async (userText) => {
    const trimmed = userText.trim()
    if (!trimmed || isStreaming) return

    const userMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')

    setMessages(prev => [...prev, { role: 'assistant', content: '', _streaming: true }])
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai-assistant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({ messages: newMessages, ticket, parts, statusHistory }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'delta') {
              setMessages(prev => {
                const updated = [...prev]
                const last    = updated[updated.length - 1]
                if (last?._streaming) {
                  updated[updated.length - 1] = { ...last, content: last.content + event.text }
                }
                return updated
              })
            } else if (event.type === 'done') {
              setMessages(prev => {
                const updated = [...prev]
                const last    = updated[updated.length - 1]
                if (last?._streaming) {
                  updated[updated.length - 1] = { role: 'assistant', content: last.content }
                }
                return updated
              })
            } else if (event.type === 'error') {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role:    'assistant',
                  content: event.error ?? 'Une erreur est survenue.',
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setMessages(prev => {
        const updated = [...prev]
        const last    = updated[updated.length - 1]
        if (last?._streaming) {
          updated[updated.length - 1] = {
            role:    'assistant',
            content: "Impossible de contacter l'assistant. Vérifiez la configuration de la clé API Anthropic.",
          }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, isStreaming, ticket, parts, statusHistory])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }, [input, sendMessage])

  const clearConversation = useCallback(() => {
    if (isStreaming && abortRef.current) abortRef.current.abort()
    setMessages([])
    setInput('')
  }, [isStreaming])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-[#111118] rounded-xl border border-white/10 overflow-hidden">

      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Assistant IA</p>
            <p className="text-xs text-gray-500 mt-0.5">Propulsé par Claude</p>
          </div>
        </div>

        {hasMessages && (
          <button
            onClick={clearConversation}
            title="Effacer la conversation"
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Zone de messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0"
        style={{ height: '400px', maxHeight: '400px' }}
      >
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">Assistant technique</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                {ticket
                  ? `Ticket chargé : ${[ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || ticket.device_type}`
                  : 'Posez une question ou utilisez un raccourci'
                }
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            isStreaming={msg._streaming === true}
          />
        ))}
      </div>

      {/* Raccourcis */}
      <div className="px-3 py-2 border-t border-white/10 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            onClick={() => sendMessage(shortcut.prompt)}
            disabled={isStreaming}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       bg-white/5 text-gray-300 border border-white/10
                       hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>{shortcut.icon}</span>
            <span>{shortcut.label}</span>
          </button>
        ))}
      </div>

      {/* Zone de saisie */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex gap-2 items-end bg-white/5 rounded-xl border border-white/10 px-3 py-2
                        focus-within:border-amber-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question technique…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600
                       resize-none outline-none py-0.5 leading-relaxed disabled:opacity-50"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center
                       hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Entrée pour envoyer · Maj+Entrée pour sauter une ligne
        </p>
      </div>

    </div>
  )
}

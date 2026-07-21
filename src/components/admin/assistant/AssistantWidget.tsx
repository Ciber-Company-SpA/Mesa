"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useVisibleModules } from "@/hooks/useVisibleModules"
import { MarkdownLite } from "@/components/admin/assistant/MarkdownLite"
import { ManuelAvatar } from "@/components/admin/assistant/ManuelAvatar"

/**
 * Asistente IA del panel admin: botón flotante + panel de chat. Ejecuta tareas
 * reales (crear categorías/productos, cupones, promos, precios, disponibilidad)
 * y da recomendaciones con los datos del negocio. Backend: /api/assistant
 * (bucle agéntico Gemini con la sesión del admin; NDJSON streaming).
 * Togglable por el operador vía platform_modules (clave 'asistente', fail-open).
 */

type ActionChip = { label: string; write: boolean; status: "run" | "ok" | "error" }
type ChatMessage = { role: "user" | "assistant"; text: string; actions?: ActionChip[] }

const STORAGE_KEY = "mesa-assistant-chat"

const SUGGESTIONS = [
  "Créame las categorías típicas para mi tipo de restaurante",
  "¿Qué me recomiendas para vender más?",
  "Revisa mi inventario y dime qué tengo que reponer",
  "Crea un cupón de 10% de descuento para los lunes",
]

function loadStored(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ChatMessage[]).slice(-40) : []
  } catch {
    return []
  }
}

export function AssistantWidget() {
  const { isVisible } = useVisibleModules()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cargar historial de la sesión al montar (evita hydration mismatch).
  useEffect(() => {
    const stored = loadStored()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee sessionStorage tras montar
    setMessages(stored)
    setHydrated(true)
  }, [])

  // Persistir + autoscroll.
  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      // storage lleno: ignorar
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, hydrated])

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || busy) return

      const nextMessages: ChatMessage[] = [...messages, { role: "user", text: clean }]
      setMessages(nextMessages)
      setInput("")
      setBusy(true)

      // Placeholder del asistente que se va llenando con el stream.
      setMessages((prev) => [...prev, { role: "assistant", text: "", actions: [] }])

      const controller = new AbortController()
      abortRef.current = controller

      function patchLast(patch: (m: ChatMessage) => ChatMessage) {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = patch(copy[copy.length - 1])
          return copy
        })
      }

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              text: m.text,
            })),
          }),
        })

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null)
          patchLast((m) => ({
            ...m,
            text: (data as { error?: string } | null)?.error ?? "El asistente no está disponible ahora.",
          }))
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let idx = buffer.indexOf("\n")
          while (idx !== -1) {
            const line = buffer.slice(0, idx).trim()
            buffer = buffer.slice(idx + 1)
            idx = buffer.indexOf("\n")
            if (!line) continue

            let event: Record<string, unknown>
            try {
              event = JSON.parse(line)
            } catch {
              continue
            }

            if (event.type === "tool") {
              const chip: ActionChip = {
                label: String(event.label ?? event.name ?? "Acción"),
                write: Boolean(event.write),
                status: (event.status as ActionChip["status"]) ?? "run",
              }
              patchLast((m) => {
                const actions = [...(m.actions ?? [])]
                // La actualización 'ok'/'error' reemplaza al 'run' de la misma acción.
                const runIdx = actions.findIndex((a) => a.label === chip.label && a.status === "run")
                if (chip.status !== "run" && runIdx !== -1) actions[runIdx] = chip
                else actions.push(chip)
                return { ...m, actions }
              })
            } else if (event.type === "reply") {
              patchLast((m) => ({ ...m, text: String(event.text ?? "") }))
            } else if (event.type === "error") {
              patchLast((m) => ({
                ...m,
                text: m.text || String(event.message ?? "Error del asistente."),
              }))
            }
          }
        }
      } catch {
        patchLast((m) => ({
          ...m,
          text: m.text || "Se cortó la conexión con el asistente. Probá de nuevo.",
        }))
      } finally {
        setBusy(false)
        abortRef.current = null
      }
    },
    [busy, messages]
  )

  // Ocultable por el operador desde el portal (fail-open mientras carga).
  if (!isVisible("admin", "asistente")) return null

  return (
    <>
      {/* Botón flotante: la cara de Manuel (flota y parpadea) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir a Manuel, tu asistente"
          className="manuel-float fixed right-5 bottom-5 z-40 rounded-full shadow-xl shadow-orange-500/30 ring-2 ring-white transition hover:shadow-orange-500/50"
        >
          <ManuelAvatar size={56} animated className="block" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Cerrar asistente"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/20 sm:bg-transparent"
          />
          <aside className="relative z-10 flex h-full w-full flex-col border-l border-stone-200 bg-white shadow-2xl sm:w-[420px]">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
              <ManuelAvatar size={38} animated className="manuel-hello shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-stone-900">Manuel</p>
                <p className="text-[11px] text-stone-500">
                  Tu asistente de MESA · ejecuta tareas y recomienda
                </p>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort()
                    setMessages([])
                    setBusy(false)
                  }}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                >
                  Nueva
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <ManuelAvatar size={72} animated className="manuel-hello" />
                  <div>
                    <p className="text-sm font-bold text-stone-800">¡Hola! Soy Manuel 👋</p>
                    <p className="mx-auto mt-1 max-w-[260px] text-xs text-stone-500">
                      Pedime crear categorías, productos, cupones o promos — o consejos
                      con tus ventas e inventario. También te explico cómo usar MESA.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left text-xs font-medium text-stone-700 transition hover:border-orange-200 hover:bg-orange-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user" ? "flex justify-end" : "flex items-end justify-start gap-2"
                    }
                  >
                    {m.role === "assistant" && (
                      <ManuelAvatar size={24} className="mb-0.5 shrink-0" />
                    )}
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-orange-500 px-3.5 py-2.5 text-sm text-white"
                          : "max-w-[88%] rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm text-stone-800"
                      }
                    >
                      {/* Log de acciones ejecutadas */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {m.actions.map((a, j) => (
                            <span
                              key={j}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                a.status === "run"
                                  ? "bg-white text-stone-500 ring-1 ring-stone-200"
                                  : a.status === "error"
                                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                                    : a.write
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                      : "bg-white text-stone-600 ring-1 ring-stone-200"
                              }`}
                            >
                              {a.status === "run" ? (
                                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                              ) : a.status === "error" ? (
                                "✗"
                              ) : (
                                "✓"
                              )}
                              {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.text ? (
                        m.role === "assistant" ? (
                          <MarkdownLite text={m.text} />
                        ) : (
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        )
                      ) : m.role === "assistant" && busy && i === messages.length - 1 ? (
                        <span className="inline-flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:240ms]" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="flex items-end gap-2 border-t border-stone-200 p-3"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                placeholder={busy ? "Manuel está trabajando…" : "Pedile algo a Manuel…"}
                disabled={busy}
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Enviar"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-40"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                </svg>
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  )
}

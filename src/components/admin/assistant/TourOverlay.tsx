"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ManuelAvatar } from "@/components/admin/assistant/ManuelAvatar"
import { TOUR_STEPS } from "@/lib/assistant/tour-steps"
import { speakText, stopSpeaking } from "@/lib/assistant/voice"

/**
 * TOUR GUIADO de Manuel: recorre los módulos del panel navegando a cada ruta
 * y mostrando una tarjeta con la explicación. Motor determinístico (los pasos
 * viven en tour-steps.ts), lanzado desde el chat vía la herramienta
 * `iniciar_tour`. Vive junto al AssistantWidget en el layout de /admin, así
 * que sobrevive a la navegación entre rutas.
 */
export function TourOverlay({
  onClose,
  isModuleVisible,
  voiceEnabled = false,
}: {
  onClose: () => void
  isModuleVisible: (area: "admin", key: string) => boolean
  /** true = Manuel narra cada paso en voz alta (TTS del navegador). */
  voiceEnabled?: boolean
}) {
  const router = useRouter()
  // El overlay se monta SOLO mientras el tour está activo (el padre lo
  // renderiza condicionalmente), así que el índice arranca en 0 cada vez.
  const [idx, setIdx] = useState(0)
  const [talking, setTalking] = useState(false)

  // Saltar los módulos que el operador apagó para este restaurante.
  const steps = useMemo(
    () => TOUR_STEPS.filter((s) => s.moduleKey === null || isModuleVisible("admin", s.moduleKey)),
    [isModuleVisible]
  )

  const step = steps[idx]

  // Navegar a la ruta del paso actual.
  useEffect(() => {
    if (step?.route) router.push(step.route)
  }, [step, router])

  // Narrar el paso si la voz está activada (y callar al salir del tour).
  useEffect(() => {
    if (!voiceEnabled || !step) return
    speakText(`${step.title}. ${step.text}`, {
      onStart: () => setTalking(true),
      onEnd: () => setTalking(false),
    })
    return () => {
      stopSpeaking()
      setTalking(false)
    }
  }, [voiceEnabled, step])

  // Salir con Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!step) return null

  const isLast = idx === steps.length - 1

  return (
    <div className="fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      <div className="animate-card-entrance w-full max-w-md rounded-3xl border border-stone-200 bg-white p-4 shadow-2xl shadow-stone-900/15">
        <div className="flex items-start gap-3">
          <ManuelAvatar size={44} animated talking={talking} className="manuel-hello shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-stone-900">
                {step.emoji} {step.title}
              </p>
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">
                {idx + 1} / {steps.length}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-stone-600">{step.text}</p>
          </div>
        </div>

        {/* Progreso */}
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-300"
            style={{ width: `${((idx + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            Salir del tour
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setIdx((i) => i + 1))}
              className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
            >
              {isLast ? "Terminar" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

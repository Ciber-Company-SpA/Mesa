"use client"

import { useEffect, useRef, useState } from "react"
import { MarkdownLite } from "@/components/admin/assistant/MarkdownLite"

/**
 * Efecto máquina de escribir para las respuestas de Manuel en el chat: el
 * markdown se revela carácter a carácter con el cursor de terminal al final
 * (mismo efecto del tour), mientras la voz narra. Velocidad adaptativa: las
 * respuestas largas teclean más rápido para no hacer esperar. Clic sobre el
 * texto = mostrarlo completo. Con prefers-reduced-motion aparece completo.
 *
 * Se monta cuando la respuesta ya llegó completa (el stream muestra shimmer
 * antes), así que el texto es estable durante toda la animación. `animate`
 * en false (historial restaurado, mensajes viejos) lo renderiza directo.
 */
export function TypewriterMarkdown({
  text,
  animate,
  onProgress,
  onDone,
}: {
  text: string
  animate: boolean
  /** Se llama en cada avance del tecleo (para acompañar con el scroll). */
  onProgress?: () => void
  /** Se llama una vez al terminar de teclear (o de inmediato si no anima). */
  onDone?: () => void
}) {
  const [shown, setShown] = useState(() => {
    if (!animate) return text.length
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return text.length
    }
    return 0
  })
  const doneNotified = useRef(false)

  const done = shown >= text.length

  useEffect(() => {
    if (done) {
      if (!doneNotified.current) {
        doneNotified.current = true
        onDone?.()
      }
      return
    }
    // Respuestas largas teclean más rápido (caracteres por tick).
    const step = text.length > 700 ? 4 : text.length > 300 ? 2 : 1
    const id = setInterval(() => {
      setShown((prev) => {
        if (prev >= text.length) {
          clearInterval(id)
          return prev
        }
        return Math.min(text.length, prev + step)
      })
      onProgress?.()
    }, 14)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una vez por montaje; el texto llega completo antes de montar
  }, [done])

  if (done) return <MarkdownLite text={text} />

  return (
    <span onClick={() => setShown(text.length)} className="block cursor-pointer">
      <MarkdownLite text={text.slice(0, shown)} caret />
    </span>
  )
}

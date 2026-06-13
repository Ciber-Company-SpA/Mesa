"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import { readImageHasBackground, setImageHasBackground } from "@/lib/customer/image-bg"

// useLayoutEffect aplica el valor conocido ANTES del paint (sin parpadeo); en
// SSR no existe, así que caemos a useEffect para no romper el render del server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/**
 * Detecta si una imagen tiene FONDO (`true`) o es un recorte transparente
 * (`false`), muestreando el canal alfa del borde en un canvas.
 *
 * Regla de negocio (pedido del usuario): las fotos CON fondo SIEMPRE llevan el
 * efecto (blur + degradado). Por eso el valor por defecto es `true`:
 * - Conocido (memoria/localStorage): se aplica antes del paint → sin parpadeo.
 * - Desconocido: se mantiene el efecto y se analiza en segundo plano. Si resulta
 *   ser un recorte, se baja a "sin efecto" y queda persistido, así que solo
 *   puede parpadear UNA vez (la primera que se ve esa imagen), nunca más.
 */
export function useImageHasBackground(src: string | null): boolean {
  const [hasBackground, setHasBackground] = useState(true)

  useIsomorphicLayoutEffect(() => {
    if (!src) {
      setHasBackground(true)
      return
    }

    // Conocido: aplicar de inmediato (antes del paint si es layout effect).
    const known = readImageHasBackground(src)
    if (known !== null) {
      setHasBackground(known)
      return
    }

    // Desconocido: mantener el efecto (con fondo) y analizar en segundo plano.
    setHasBackground(true)
    if (typeof window === "undefined") return

    let cancelled = false
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => {
      if (cancelled) return
      try {
        if (!img.naturalWidth || !img.naturalHeight) return
        const S = 48
        const canvas = document.createElement("canvas")
        canvas.width = S
        canvas.height = S
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, S, S)
        const { data } = ctx.getImageData(0, 0, S, S)
        const alphaAt = (x: number, y: number) => data[(y * S + x) * 4 + 3]

        let edge = 0
        let transparent = 0
        for (let x = 0; x < S; x++) {
          for (const y of [0, S - 1]) {
            edge++
            if (alphaAt(x, y) < 16) transparent++
          }
        }
        for (let y = 1; y < S - 1; y++) {
          for (const x of [0, S - 1]) {
            edge++
            if (alphaAt(x, y) < 16) transparent++
          }
        }
        // Recorte si más de la mitad del marco es transparente.
        const value = transparent / edge < 0.5
        setImageHasBackground(src, value)
        if (!cancelled) setHasBackground(value)
      } catch {
        // Sin CORS no se puede leer: mantenemos el efecto (con fondo) y NO
        // persistimos, para reintentar la próxima vez.
      }
    }
    img.onerror = () => undefined
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return hasBackground
}

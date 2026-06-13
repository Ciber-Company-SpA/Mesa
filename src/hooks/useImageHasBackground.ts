"use client"

import { useEffect, useState } from "react"
import { readImageHasBackground, setImageHasBackground } from "@/lib/customer/image-bg"

/**
 * Detecta si una imagen tiene FONDO (`true`) o es un recorte transparente
 * (`false`), muestreando el canal alfa del borde en un canvas.
 *
 * - Estado inicial SIEMPRE `false` (sin efecto) para que el primer render —y la
 *   hidratación SSR— sean deterministas y los recortes nunca parpadeen con el
 *   blur/degradado. Solo se aplica el efecto cuando se CONFIRMA que tiene fondo.
 * - El resultado se persiste (image-bg → localStorage), así que en cada F5 una
 *   imagen ya analizada se resuelve al instante sin volver a analizar.
 */
export function useImageHasBackground(src: string | null): boolean {
  const [hasBackground, setHasBackground] = useState(false)

  useEffect(() => {
    if (!src) {
      setHasBackground(false)
      return
    }

    // Conocido (memoria o localStorage): aplicar al instante, sin re-analizar.
    const known = readImageHasBackground(src)
    if (known !== null) {
      setHasBackground(known)
      return
    }

    if (typeof window === "undefined") return

    let cancelled = false
    const settle = (value: boolean) => {
      setImageHasBackground(src, value)
      if (!cancelled) setHasBackground(value)
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => {
      if (cancelled) return
      try {
        if (!img.naturalWidth || !img.naturalHeight) return settle(false)
        const S = 48
        const canvas = document.createElement("canvas")
        canvas.width = S
        canvas.height = S
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return settle(false)
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
        // Si más de la mitad del marco es transparente, es un recorte sin fondo.
        settle(transparent / edge < 0.5)
      } catch {
        // Canvas contaminado (sin CORS) u otro fallo: tratar como sin fondo
        // (no aplicar el efecto) para no arriesgar un recorte feo.
        settle(false)
      }
    }
    img.onerror = () => settle(false)
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return hasBackground
}

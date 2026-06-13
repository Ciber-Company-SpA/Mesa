"use client"

import { useEffect, useState } from "react"
import {
  getImageHasBackground,
  isImageBackgroundCached,
  setImageHasBackground,
} from "@/lib/customer/image-bg"

/**
 * Detecta si una imagen tiene FONDO (`true`) o es un recorte con transparencia
 * (`false`), muestreando el canal alfa del borde en un canvas. El resultado se
 * guarda en el caché compartido (image-bg) para que flyToCart pueda consultarlo.
 *
 * - Mientras analiza (o si no se puede leer por CORS) devuelve `true`: asumimos
 *   "con fondo" para no recortar el efecto por error.
 * - Requiere que la imagen permita CORS (Cloudinary lo hace).
 */
export function useImageHasBackground(src: string | null): boolean {
  const [hasBackground, setHasBackground] = useState<boolean>(() => getImageHasBackground(src))

  useEffect(() => {
    if (!src) {
      setHasBackground(true)
      return
    }
    if (isImageBackgroundCached(src)) {
      setHasBackground(getImageHasBackground(src))
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
        if (!img.naturalWidth || !img.naturalHeight) return settle(true)
        const S = 48
        const canvas = document.createElement("canvas")
        canvas.width = S
        canvas.height = S
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return settle(true)
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
        // Canvas contaminado (sin CORS) u otro fallo: asumir con fondo.
        settle(true)
      }
    }
    img.onerror = () => settle(true)
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return hasBackground
}

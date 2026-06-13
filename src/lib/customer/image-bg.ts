// Caché compartido de "¿la imagen tiene fondo?" (true) vs recorte transparente
// (false). Lo llena useImageHasBackground al renderizar cada imagen; flyToCart
// lo consulta para decidir si la imagen vuela recortada en círculo o completa.
const cache = new Map<string, boolean>()

/** Devuelve el valor cacheado; si no se analizó aún, asume con fondo (true). */
export function getImageHasBackground(src: string | null | undefined): boolean {
  if (!src) return true
  return cache.get(src) ?? true
}

export function setImageHasBackground(src: string, value: boolean): void {
  cache.set(src, value)
}

export function isImageBackgroundCached(src: string): boolean {
  return cache.has(src)
}

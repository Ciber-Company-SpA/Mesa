// Caché de "¿la imagen tiene fondo?" (true) vs recorte transparente (false).
// - En memoria (Map) + persistido en localStorage, para que en cada F5 el
//   resultado ya conocido se resuelva al instante (sin re-analizar y sin que
//   parpadee el efecto sobre los recortes).
// - "Desconocido" se trata como SIN efecto: readImageHasBackground devuelve null
//   y los consumidores renderizan limpio hasta confirmar que sí tiene fondo.
const mem = new Map<string, boolean>()
const LS_PREFIX = "imgbg:"

function fromLocalStorage(src: string): boolean | null {
  try {
    const v = window.localStorage.getItem(LS_PREFIX + src)
    return v === null ? null : v === "1"
  } catch {
    return null
  }
}

/** Valor conocido (memoria o localStorage), o `null` si aún no se analizó. */
export function readImageHasBackground(src: string | null | undefined): boolean | null {
  if (!src) return null
  const cached = mem.get(src)
  if (cached !== undefined) return cached
  if (typeof window === "undefined") return null
  const stored = fromLocalStorage(src)
  if (stored !== null) mem.set(src, stored)
  return stored
}

export function setImageHasBackground(src: string, value: boolean): void {
  mem.set(src, value)
  try {
    window.localStorage.setItem(LS_PREFIX + src, value ? "1" : "0")
  } catch {
    // localStorage no disponible: queda solo en memoria.
  }
}

/**
 * Para consumidores no-React (flyToCart): circular salvo que SEPAMOS que es un
 * recorte sin fondo. Por defecto (desconocido) se trata como con fondo, igual
 * que el render.
 */
export function getImageHasBackground(src: string | null | undefined): boolean {
  return readImageHasBackground(src) !== false
}

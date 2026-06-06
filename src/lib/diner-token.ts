// Token persistente por mesa que identifica al dispositivo del comensal.
// Se usa para reclamar el slot "Comensal N" en table_diners de manera
// idempotente: el mismo token siempre devuelve el mismo slot mientras la
// mesa tenga pedidos activos.

const KEY_PREFIX = "diner-token-"

function generateToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback simple para entornos sin crypto.randomUUID.
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function getOrCreateDinerToken(tableId: number): string | null {
  if (typeof window === "undefined" || !tableId) return null
  const key = `${KEY_PREFIX}${tableId}`
  try {
    const existing = window.localStorage.getItem(key)
    if (existing && existing.length >= 8) return existing
    const fresh = generateToken()
    window.localStorage.setItem(key, fresh)
    return fresh
  } catch {
    return null
  }
}

export function clearDinerToken(tableId: number) {
  if (typeof window === "undefined" || !tableId) return
  try {
    window.localStorage.removeItem(`${KEY_PREFIX}${tableId}`)
  } catch {
    // ignore
  }
}

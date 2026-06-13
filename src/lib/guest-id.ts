const KEY = "guest_id"

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback para contextos no seguros (dev server por IP de LAN sobre HTTP) o
  // navegadores sin crypto.randomUUID. El guest id solo etiqueta quién agregó
  // cada ítem, no necesita aleatoriedad criptográfica.
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function getGuestId(): string {
  if (typeof window === "undefined") return ""

  let id = window.localStorage.getItem(KEY)
  if (!id) {
    id = generateId()
    window.localStorage.setItem(KEY, id)
  }
  return id
}

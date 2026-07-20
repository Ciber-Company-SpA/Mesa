// Monitor de inactividad COMPARTIDO (singleton a nivel de módulo). Una sola
// fuente de verdad para el auto-cierre (AdminSessionTimeout) y el cronómetro del
// sidebar (IdleCountdown), así ambos muestran exactamente el mismo tiempo.
//
// Registra los listeners de actividad una única vez. Durante el aviso final se
// "pausa" (idlePause) para que mover el mouse hacia el botón no reinicie la
// cuenta; idleReset lo reactiva al confirmar "Seguir conectado".

const IDLE_MS = 30 * 60 * 1000
const ACTIVITY = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"]

let lastActivity = 0
let paused = false
let started = false

function onActivity() {
  if (!paused) lastActivity = Date.now()
}

function ensureStarted() {
  if (started || typeof window === "undefined") return
  started = true
  lastActivity = Date.now()
  ACTIVITY.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
}

export const IDLE_TOTAL_MS = IDLE_MS

/** Milisegundos restantes antes del cierre por inactividad (0 = expirado). */
export function idleRemainingMs(): number {
  ensureStarted()
  return Math.max(0, IDLE_MS - (Date.now() - lastActivity))
}

/** Reinicia el contador y reanuda la detección (al confirmar presencia). */
export function idleReset(): void {
  ensureStarted()
  lastActivity = Date.now()
  paused = false
}

/** Congela el contador (durante el aviso de 15 s). */
export function idlePause(): void {
  paused = true
}

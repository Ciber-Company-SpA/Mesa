// Beep generado on-the-fly con Web Audio API: dos tonos cortos tipo "ding-dong"
// fácilmente audibles en una cocina con ruido de fondo. No requiere asset
// externo y respeta la política de autoplay (el navegador permite sonido
// luego de cualquier interacción del usuario, que en el dashboard sucede
// al loguearse o al hacer click).

type AudioContextCtor = typeof AudioContext

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor()
  } catch {
    return null
  }
}

let cachedContext: AudioContext | null = null

function getOrCreateContext(): AudioContext | null {
  if (cachedContext) return cachedContext
  cachedContext = getAudioContext()
  return cachedContext
}

function beep(ctx: AudioContext, frequency: number, startOffset: number, durationMs: number, gainValue = 0.25) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.value = frequency
  osc.connect(gain)
  gain.connect(ctx.destination)

  const start = ctx.currentTime + startOffset
  const end = start + durationMs / 1000
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.start(start)
  osc.stop(end + 0.05)
}

export function playNewOrderSound() {
  const ctx = getOrCreateContext()
  if (!ctx) return
  // Resume si el contexto está suspendido por la política de autoplay.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => undefined)
  }
  // Patrón "ding-dong" de dos notas.
  beep(ctx, 880, 0, 150)
  beep(ctx, 660, 0.18, 220)
}

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

function beep(ctx: AudioContext, frequency: number, startOffset: number, durationMs: number, gainValue = 0.9) {
  // Oscilador principal + uno una octava arriba mezclado bajito → suena
  // más "rico" y se escucha mejor sobre ruido de cocina que un sine puro.
  const oscA = ctx.createOscillator()
  const oscB = ctx.createOscillator()
  const gain = ctx.createGain()
  oscA.type = "square"
  oscA.frequency.value = frequency
  oscB.type = "triangle"
  oscB.frequency.value = frequency * 2
  oscA.connect(gain)
  oscB.connect(gain)
  gain.connect(ctx.destination)

  const start = ctx.currentTime + startOffset
  const end = start + durationMs / 1000
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.015)
  gain.gain.setValueAtTime(gainValue, end - 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  oscA.start(start)
  oscB.start(start)
  oscA.stop(end + 0.05)
  oscB.stop(end + 0.05)
}

export function playNewOrderSound() {
  const ctx = getOrCreateContext()
  if (!ctx) return
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => undefined)
  }
  // Tres beeps tipo "ding-ding-ding" más fuertes para que se escuchen
  // sobre el ruido de cocina.
  beep(ctx, 880, 0.0, 200)
  beep(ctx, 880, 0.28, 200)
  beep(ctx, 1175, 0.56, 320)
}

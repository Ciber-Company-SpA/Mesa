/**
 * Voz de MANUEL: text-to-speech con la Web Speech API del navegador (sin
 * servicios externos ni costo). Elige la mejor voz en español disponible,
 * limpia el markdown/emojis antes de leer y trocea el texto en oraciones
 * cortas (evita el bug de Chrome que corta utterances largas).
 */

let cachedVoice: SpeechSynthesisVoice | null = null

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null

  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // Preferencia por cercanía al español de Chile; dentro de cada dialecto,
  // las voces "Google/Natural/Neural" suenan mejor que las del sistema.
  const prefs = ["es-cl", "es-419", "es-us", "es-mx", "es-ar", "es-es", "es"]
  for (const pref of prefs) {
    const matches = voices.filter((v) =>
      v.lang.toLowerCase().replace("_", "-").startsWith(pref)
    )
    if (matches.length > 0) {
      cachedVoice =
        matches.find((v) => /google|natural|neural|online/i.test(v.name)) ?? matches[0]
      return cachedVoice
    }
  }
  return null
}

// Las voces cargan async en Chrome: refrescar el caché cuando estén listas.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = null
    pickSpanishVoice()
  })
}

/** Quita markdown, emojis y viñetas: lo que se lee debe sonar natural. */
function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/️/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Trocea por oraciones en bloques cortos (~máx 200 chars). */
function chunkSentences(text: string, max = 200): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/)
  const chunks: string[] = []
  let current = ""
  for (const s of sentences) {
    if ((current + " " + s).trim().length > max && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = (current + " " + s).trim()
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

export function stopSpeaking() {
  if (!speechAvailable()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // navegadores viejos: ignorar
  }
}

/**
 * Lee un texto en voz alta. Devuelve false si el navegador no soporta TTS o
 * no quedó nada que leer tras la limpieza. onStart/onEnd permiten animar la
 * boca de Manuel mientras habla.
 */
export function speakText(
  text: string,
  cb?: { onStart?: () => void; onEnd?: () => void }
): boolean {
  if (!speechAvailable()) return false
  stopSpeaking()

  const clean = stripForSpeech(text)
  if (!clean) return false

  const chunks = chunkSentences(clean)
  const voice = pickSpanishVoice()
  let started = false
  let ended = false
  const endOnce = () => {
    if (!ended) {
      ended = true
      cb?.onEnd?.()
    }
  }

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? "es-CL"
    u.rate = 1.05
    u.pitch = 1.03
    u.onstart = () => {
      if (!started) {
        started = true
        cb?.onStart?.()
      }
    }
    if (i === chunks.length - 1) {
      u.onend = endOnce
    }
    // Un cancel() dispara error en las pendientes: cerrar la animación.
    u.onerror = endOnce
    window.speechSynthesis.speak(u)
  })

  return true
}
